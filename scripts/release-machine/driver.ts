import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  lstat,
  mkdir,
  readdir,
  readFile,
  readlink,
  symlink,
  writeFile,
} from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import {
  loadReleaseContext,
  verifyAuthorizedReleaseContext,
  verifyPatch,
  type ReleaseContext,
} from './contracts'
import { validateChangedTestPolicy } from '../test-change-policy'

type DriverAction =
  | 'validate-scope'
  | 'validate-change'
  | 'verify-layout'
  | 'verify-playwright'
  | 'git-release'
  | 'build-merged'
  | 'rollback-git'
  | 'verify-git-rollback'
  | 'cleanup'

type CommandResult = {
  status: number
  stdout: string
  stderr: string
}

export type DriverRuntime = {
  run: (
    command: string,
    args: string[],
    options?: { cwd?: string; allowFailure?: boolean },
  ) => CommandResult
}

type DriverState = {
  version: 1
  releasePreparationRequested?: boolean
  releaseWorktreePrepared?: boolean
  stagedDiffHash?: string
  releaseCommit?: string
  releasePushRequested?: boolean
  releasePushed?: boolean
  pullRequestRequested?: boolean
  pullRequestUrl?: string
  mergeRequested?: boolean
  mergedRevision?: string
  buildWorktreeRequested?: boolean
  buildManifestHash?: string
  rollbackPreparationRequested?: boolean
  rollbackBaseRevision?: string
  rollbackCommit?: string
  rollbackPushRequested?: boolean
  rollbackPushed?: boolean
  rollbackPullRequestRequested?: boolean
  rollbackPullRequestUrl?: string
  rollbackMergeRequested?: boolean
  rollbackMergedRevision?: string
  cleaned?: boolean
}

const COAUTHOR = 'Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function defaultRuntime(): DriverRuntime {
  return {
    run(command, args, options = {}) {
      const result = spawnSync(command, args, {
        cwd: options.cwd,
        encoding: 'utf8',
        env: process.env,
        maxBuffer: 2_000_000,
      })
      const status = result.status ?? 1
      if (status !== 0 && !options.allowFailure) {
        throw new Error(
          `${command} ${args.join(' ')} failed: ${result.stderr || result.error?.message || 'unknown error'}`,
        )
      }
      return {
        status,
        stdout: result.stdout ?? '',
        stderr: result.stderr ?? '',
      }
    },
  }
}

function requireGitDriverContext(context: ReleaseContext) {
  assert(context.patch, 'Repository driver requires a patch artifact')
  assert(context.releaseWorktree, 'Repository driver requires a release worktree')
  assert(context.buildWorktree, 'Repository driver requires a build worktree')
  assert(context.dependencyWorktree, 'Repository driver requires a dependency worktree')
  assert(context.githubRepository, 'Repository driver requires a GitHub repository')
  assert(context.commit, 'Repository driver requires commit copy')
  assert(context.pullRequest, 'Repository driver requires pull request copy')
}

async function linkDependencies(
  context: ReleaseContext,
  worktree: string,
) {
  assert(context.dependencyWorktree, 'Dependency worktree is required')
  const source = join(context.dependencyWorktree, 'node_modules')
  const target = join(worktree, 'node_modules')
  const sourceStats = await lstat(source)
  assert(sourceStats.isDirectory(), 'Dependency source node_modules is not a directory')
  try {
    const targetStats = await lstat(target)
    assert(targetStats.isSymbolicLink(), 'Worktree node_modules is not a machine-owned link')
    assert(
      resolve(dirname(target), await readlink(target)) === resolve(source),
      'Worktree node_modules link targets an unauthorized dependency source',
    )
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    await symlink(source, target, 'dir')
  }
}

function statePath(context: ReleaseContext) {
  return join(context.evidenceDirectory, 'driver-state.json')
}

async function readState(context: ReleaseContext): Promise<DriverState> {
  try {
    return JSON.parse(await readFile(statePath(context), 'utf8')) as DriverState
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { version: 1 }
    throw error
  }
}

async function updateState(
  context: ReleaseContext,
  change: Partial<DriverState>,
) {
  const state = { ...(await readState(context)), ...change, version: 1 as const }
  await mkdir(context.evidenceDirectory, { recursive: true })
  await writeFile(statePath(context), `${JSON.stringify(state, null, 2)}\n`)
  return state
}

function git(runtime: DriverRuntime, cwd: string, args: string[], allowFailure = false) {
  return runtime.run('git', args, { cwd, allowFailure })
}

async function listFiles(directory: string, prefix = ''): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const childPrefix = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      files.push(...(await listFiles(join(directory, entry.name), childPrefix)))
    } else if (entry.isFile()) {
      files.push(childPrefix)
    }
  }
  return files
}

async function directoryManifest(directory: string) {
  const files = await listFiles(directory)
  const records = []
  for (const file of files) {
    const content = await readFile(join(directory, file))
    records.push({
      path: file,
      size: content.length,
      sha256: createHash('sha256').update(content).digest('hex'),
    })
  }
  return records
}

async function pathExists(path: string) {
  try {
    await lstat(path)
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw error
  }
}

function cachedDiff(context: ReleaseContext, runtime: DriverRuntime) {
  return git(runtime, context.releaseWorktree!, [
    'diff',
    '--cached',
    '--binary',
    '--full-index',
  ]).stdout
}

function pullRequestField(
  context: ReleaseContext,
  runtime: DriverRuntime,
  url: string,
  field: 'baseRefOid' | 'headRefOid' | 'mergeCommit' | 'state',
) {
  return runtime.run(
    'gh',
    [
      'pr',
      'view',
      url,
      '--repo',
      context.githubRepository!,
      '--json',
      field,
      '--jq',
      field === 'mergeCommit' ? '.mergeCommit.oid' : `.${field}`,
    ],
    { cwd: context.repository },
  ).stdout.trim()
}

function findPullRequest(
  context: ReleaseContext,
  runtime: DriverRuntime,
  branch: string,
  headRevision: string,
  baseRevision: string,
) {
  const output = runtime.run(
    'gh',
    [
      'pr',
      'list',
      '--repo',
      context.githubRepository!,
      '--head',
      branch,
      '--base',
      'master',
      '--state',
      'all',
      '--json',
      'url,headRefOid,baseRefOid',
    ],
    { cwd: context.repository },
  ).stdout.trim()
  const matches = (output ? JSON.parse(output) : []) as Array<{
    url?: unknown
    headRefOid?: unknown
    baseRefOid?: unknown
  }>
  const match = matches.find(
    (candidate) =>
      candidate.headRefOid === headRevision &&
      candidate.baseRefOid === baseRevision &&
      typeof candidate.url === 'string',
  )
  return match?.url ?? null
}

function assertMergeParents(
  context: ReleaseContext,
  runtime: DriverRuntime,
  mergeRevision: string,
  baseRevision: string,
  headRevision: string,
) {
  const revisions = git(runtime, context.repository, [
    'rev-list',
    '--parents',
    '-n',
    '1',
    mergeRevision,
  ]).stdout.trim().split(/\s+/)
  assert(
    revisions.length === 3 &&
      revisions[0] === mergeRevision &&
      revisions[1] === baseRevision &&
      revisions[2] === headRevision,
    'Pull request merge commit parents do not match the authorized revisions',
  )
}

function assertNoCollateralChanges(
  context: ReleaseContext,
  runtime: DriverRuntime,
) {
  const unstaged = git(runtime, context.releaseWorktree!, [
    'diff',
    '--name-only',
  ]).stdout.trim()
  const untracked = git(runtime, context.releaseWorktree!, [
    'ls-files',
    '--others',
    '--exclude-standard',
  ]).stdout.trim()
  assert(!unstaged, `Release validation modified tracked files: ${unstaged}`)
  assert(!untracked, `Release validation created untracked files: ${untracked}`)
}

async function validateScope(context: ReleaseContext, runtime: DriverRuntime) {
  requireGitDriverContext(context)
  await verifyPatch(context)
  const head = git(runtime, context.repository, ['rev-parse', 'HEAD']).stdout.trim()
  assert(head === context.baseRevision, 'Repository HEAD does not match the release base revision')
  const state = await readState(context)
  if (!state.releaseWorktreePrepared) {
    assert(
      !state.releasePreparationRequested,
      'Release worktree preparation was interrupted; run cleanup before retrying',
    )
    assert(
      !(await pathExists(context.releaseWorktree)),
      'Release worktree path already exists without machine ownership',
    )
    const branch = git(
      runtime,
      context.repository,
      ['show-ref', '--verify', '--quiet', `refs/heads/${context.branch}`],
      true,
    )
    assert(branch.status !== 0, 'Release branch already exists')
    await updateState(context, { releasePreparationRequested: true })
    git(runtime, context.repository, [
      'worktree',
      'add',
      '-b',
      context.branch,
      context.releaseWorktree,
      context.baseRevision,
    ])
    git(runtime, context.releaseWorktree, [
      'apply',
      '--index',
      '--binary',
      context.patch.path,
    ])
  }
  await linkDependencies(context, context.releaseWorktree)
  const preparedHead = git(runtime, context.releaseWorktree, [
    'rev-parse',
    'HEAD',
  ]).stdout.trim()
  assert(
    preparedHead === context.baseRevision,
    'Prepared release worktree does not match the authorized base revision',
  )
  const staged = git(runtime, context.releaseWorktree, [
    'diff',
    '--cached',
    '--name-only',
  ]).stdout
    .trim()
    .split('\n')
    .filter(Boolean)
    .sort()
  assert(
    JSON.stringify(staged) === JSON.stringify([...context.scopePaths].sort()),
    'Prepared release worktree does not match the authorized scope',
  )
  assertNoCollateralChanges(context, runtime)
  validateChangedTestPolicy(context.scopePaths, {
    root: context.releaseWorktree,
  })
  const stagedDiffHash = createHash('sha256')
    .update(cachedDiff(context, runtime))
    .digest('hex')
  if (state.stagedDiffHash) {
    assert(
      stagedDiffHash === state.stagedDiffHash,
      'Prepared staged bytes differ from the journaled patch',
    )
  }
  return updateState(context, {
    releaseWorktreePrepared: true,
    stagedDiffHash,
  })
}

async function validateChange(
  context: ReleaseContext,
  runtime: DriverRuntime,
) {
  requireGitDriverContext(context)
  const state = await readState(context)
  assert(
    state.releaseWorktreePrepared && state.stagedDiffHash,
    'Scope validation must prepare the release worktree before validation',
  )
  runtime.run('npm', ['run', 'check'], { cwd: context.releaseWorktree })
  assertNoCollateralChanges(context, runtime)
  assert(
    createHash('sha256').update(cachedDiff(context, runtime)).digest('hex') ===
      state.stagedDiffHash,
    'Validated staged bytes differ from the authorized patch',
  )
  return state
}

async function verifyLayout(context: ReleaseContext, runtime: DriverRuntime) {
  requireGitDriverContext(context)
  assert(
    context.variant === 'dashboard-production' && context.layoutRun,
    'Layout verification requires dashboard-production context',
  )
  runtime.run(
    'npm',
    ['run', 'layout:verify', '--', '--run', context.layoutRun],
    { cwd: context.releaseWorktree },
  )
  return updateState(context, {})
}

async function verifyPlaywright(
  context: ReleaseContext,
  runtime: DriverRuntime,
) {
  requireGitDriverContext(context)
  assert(
    context.variant === 'dashboard-production' &&
      context.affectedPlaywrightSpecs?.length,
    'Affected Playwright verification requires dashboard-production context',
  )
  runtime.run(
    'npm',
    ['run', 'test:e2e', '--', ...context.affectedPlaywrightSpecs],
    { cwd: context.releaseWorktree },
  )
  return updateState(context, {})
}

async function gitRelease(context: ReleaseContext, runtime: DriverRuntime) {
  requireGitDriverContext(context)
  let state = await readState(context)
  if (!state.releaseCommit) {
    await validateScope(context, runtime)
    state = await readState(context)
  }
  git(runtime, context.repository, ['fetch', 'origin', 'master'])
  const remoteBase = git(runtime, context.repository, [
    'rev-parse',
    'origin/master',
  ]).stdout.trim()
  assert(
    remoteBase === context.baseRevision,
    'origin/master moved after authorization; create a new release context',
  )
  if (!state.releaseCommit) {
    const staged = git(runtime, context.releaseWorktree, [
      'diff',
      '--cached',
      '--name-only',
    ]).stdout
      .trim()
      .split('\n')
      .filter(Boolean)
      .sort()
    assert(
      JSON.stringify(staged) ===
        JSON.stringify([...context.scopePaths].sort()),
      'Staged paths do not match the authorized release scope',
    )
    assert(state.stagedDiffHash, 'Authorized staged-diff evidence is missing')
    assertNoCollateralChanges(context, runtime)
    assert(
      createHash('sha256').update(cachedDiff(context, runtime)).digest('hex') ===
        state.stagedDiffHash,
      'Staged bytes changed after validation',
    )
    git(runtime, context.releaseWorktree, [
      'commit',
      '-m',
      context.commit.title,
      '-m',
      context.commit.body,
      '-m',
      COAUTHOR,
    ])
    const releaseCommit = git(runtime, context.releaseWorktree, [
      'rev-parse',
      'HEAD',
    ]).stdout.trim()
    state = await updateState(context, { releaseCommit })
  } else {
    const current = git(runtime, context.releaseWorktree, [
      'rev-parse',
      'HEAD',
    ]).stdout.trim()
    assert(
      current === state.releaseCommit,
      'Release worktree no longer matches the journaled commit',
    )
  }
  const releaseCommit = state.releaseCommit

  if (!state.releasePushed) {
    if (!state.releasePushRequested) {
      await updateState(context, { releasePushRequested: true })
    }
    git(runtime, context.releaseWorktree, [
      'push',
      '--set-upstream',
      'origin',
      context.branch,
    ])
    await updateState(context, { releasePushed: true })
  }

  let pullRequestUrl = state.pullRequestUrl
  if (!pullRequestUrl) {
    pullRequestUrl = findPullRequest(
      context,
      runtime,
      context.branch,
      releaseCommit,
      context.baseRevision,
    )
  }
  if (!pullRequestUrl) {
    if (!state.pullRequestRequested) {
      await updateState(context, { pullRequestRequested: true })
    }
    pullRequestUrl = runtime.run(
      'gh',
      [
        'pr',
        'create',
        '--repo',
        context.githubRepository,
        '--base',
        'master',
        '--head',
        context.branch,
        '--title',
        context.pullRequest.title,
        '--body',
        context.pullRequest.body,
      ],
      { cwd: context.releaseWorktree },
    ).stdout.trim()
  }
  await updateState(context, { pullRequestUrl })
  const pullRequestHead = pullRequestField(
    context,
    runtime,
    pullRequestUrl,
    'headRefOid',
  )
  const pullRequestBase = pullRequestField(
    context,
    runtime,
    pullRequestUrl,
    'baseRefOid',
  )
  assert(
    pullRequestHead === releaseCommit &&
      pullRequestBase === context.baseRevision,
    'Pull request revisions do not match the authorized release',
  )
  let pullRequestState = pullRequestField(
    context,
    runtime,
    pullRequestUrl,
    'state',
  )
  if (pullRequestState !== 'MERGED') {
    await updateState(context, { mergeRequested: true })
    runtime.run(
      'gh',
      [
        'pr',
        'merge',
        pullRequestUrl,
        '--repo',
        context.githubRepository,
        '--merge',
        '--match-head-commit',
        releaseCommit,
      ],
      { cwd: context.releaseWorktree },
    )
    pullRequestState = pullRequestField(
      context,
      runtime,
      pullRequestUrl,
      'state',
    )
  }
  git(runtime, context.repository, ['fetch', 'origin', 'master'])
  assert(pullRequestState === 'MERGED', 'Release pull request is not merged')
  const mergedRevision = pullRequestField(
    context,
    runtime,
    pullRequestUrl,
    'mergeCommit',
  )
  assert(/^[a-f0-9]{40}$/.test(mergedRevision), 'Merged pull request commit is unavailable')
  assertMergeParents(
    context,
    runtime,
    mergedRevision,
    context.baseRevision,
    releaseCommit,
  )
  git(runtime, context.repository, [
    'merge-base',
    '--is-ancestor',
    releaseCommit,
    'origin/master',
  ])
  return updateState(context, { mergedRevision })
}

async function buildMerged(context: ReleaseContext, runtime: DriverRuntime) {
  requireGitDriverContext(context)
  const state = await readState(context)
  assert(state.releaseCommit && state.mergedRevision, 'Merged release evidence is required before build')
  git(runtime, context.repository, [
    'merge-base',
    '--is-ancestor',
    state.releaseCommit,
    state.mergedRevision,
  ])
  git(runtime, context.repository, [
    'merge-base',
    '--is-ancestor',
    state.mergedRevision,
    'origin/master',
  ])
  if (await pathExists(context.buildWorktree)) {
    assert(
      state.buildWorktreeRequested,
      'Build worktree path already exists without machine ownership',
    )
    const topLevel = git(runtime, context.buildWorktree, [
      'rev-parse',
      '--show-toplevel',
    ]).stdout.trim()
    const revision = git(runtime, context.buildWorktree, [
      'rev-parse',
      'HEAD',
    ]).stdout.trim()
    assert(
      resolve(topLevel) === resolve(context.buildWorktree) &&
        revision === state.mergedRevision,
      'Interrupted build worktree does not match the journaled merge',
    )
  } else {
    await updateState(context, { buildWorktreeRequested: true })
    git(runtime, context.repository, [
      'worktree',
      'add',
      '--detach',
      context.buildWorktree,
      state.mergedRevision,
    ])
  }
  await linkDependencies(context, context.buildWorktree)
  runtime.run('npm', ['run', 'build'], { cwd: context.buildWorktree })
  const dist = resolve(context.buildWorktree, 'dist')
  const manifest = await directoryManifest(dist)
  assert(manifest.some((entry) => entry.path === 'index.html'), 'Merged build did not produce dist/index.html')
  const buildManifestHash = createHash('sha256')
    .update(JSON.stringify(manifest))
    .digest('hex')
  await writeFile(
    join(context.evidenceDirectory, 'build-manifest.json'),
    `${JSON.stringify({ revision: state.mergedRevision, files: manifest }, null, 2)}\n`,
  )
  return updateState(context, { buildManifestHash })
}

async function rollbackGit(context: ReleaseContext, runtime: DriverRuntime) {
  requireGitDriverContext(context)
  let state = await readState(context)
  if (!state.pullRequestUrl && state.releaseCommit && state.releasePushRequested) {
    const recovered = findPullRequest(
      context,
      runtime,
      context.branch,
      state.releaseCommit,
      context.baseRevision,
    )
    if (recovered) {
      state = await updateState(context, { pullRequestUrl: recovered })
    } else {
      git(
        runtime,
        context.repository,
        ['push', 'origin', '--delete', context.branch],
        true,
      )
      return state
    }
  }
  if (!state.pullRequestUrl) return state

  if (!state.mergedRevision) {
    const pullRequestState = pullRequestField(
      context,
      runtime,
      state.pullRequestUrl,
      'state',
    )
    if (pullRequestState === 'MERGED') {
      const mergedRevision = pullRequestField(
        context,
        runtime,
        state.pullRequestUrl,
        'mergeCommit',
      )
      assert(
        /^[a-f0-9]{40}$/.test(mergedRevision),
        'Merged pull request commit is unavailable during rollback recovery',
      )
      assert(state.releaseCommit, 'Release commit is missing during rollback recovery')
      git(runtime, context.repository, ['fetch', 'origin', 'master'])
      assertMergeParents(
        context,
        runtime,
        mergedRevision,
        context.baseRevision,
        state.releaseCommit,
      )
      state = await updateState(context, { mergedRevision })
    }
  }

  if (!state.mergedRevision) {
    runtime.run(
      'gh',
      ['pr', 'close', state.pullRequestUrl, '--repo', context.githubRepository],
      { cwd: context.repository, allowFailure: true },
    )
    git(
      runtime,
      context.repository,
      ['push', 'origin', '--delete', context.branch],
      true,
    )
    return state
  }

  assert(state.releaseCommit, 'Release commit is required for a merged rollback')
  const rollbackBranch = `${context.branch}-revert`
  const rollbackWorktree = `${context.releaseWorktree}-revert`
  if (!state.rollbackCommit) {
    assert(
      !(await pathExists(rollbackWorktree)),
      'Rollback worktree path already exists without machine ownership',
    )
    const rollbackBranchState = git(
      runtime,
      context.repository,
      ['show-ref', '--verify', '--quiet', `refs/heads/${rollbackBranch}`],
      true,
    )
    assert(rollbackBranchState.status !== 0, 'Rollback branch already exists')
    git(runtime, context.repository, ['fetch', 'origin', 'master'])
    const rollbackBaseRevision = git(runtime, context.repository, [
      'rev-parse',
      'origin/master',
    ]).stdout.trim()
    state = await updateState(context, {
      rollbackPreparationRequested: true,
      rollbackBaseRevision,
    })
    git(runtime, context.repository, [
      'worktree',
      'add',
      '-b',
      rollbackBranch,
      rollbackWorktree,
      rollbackBaseRevision,
    ])
    git(runtime, rollbackWorktree, ['revert', '--no-edit', state.releaseCommit])
    const rollbackCommit = git(runtime, rollbackWorktree, [
      'rev-parse',
      'HEAD',
    ]).stdout.trim()
    state = await updateState(context, { rollbackCommit })
  }
  assert(
    state.rollbackCommit && state.rollbackBaseRevision,
    'Rollback commit journal is incomplete',
  )
  if (!state.rollbackPushed) {
    await updateState(context, { rollbackPushRequested: true })
    git(runtime, rollbackWorktree, [
      'push',
      '--set-upstream',
      'origin',
      rollbackBranch,
    ])
    state = await updateState(context, { rollbackPushed: true })
  }
  let rollbackPullRequestUrl = state.rollbackPullRequestUrl
  if (!rollbackPullRequestUrl) {
    rollbackPullRequestUrl = findPullRequest(
      context,
      runtime,
      rollbackBranch,
      state.rollbackCommit,
      state.rollbackBaseRevision,
    )
  }
  if (!rollbackPullRequestUrl) {
    state = await updateState(context, {
      rollbackPullRequestRequested: true,
    })
    rollbackPullRequestUrl = runtime.run(
      'gh',
      [
        'pr',
        'create',
        '--repo',
        context.githubRepository,
        '--base',
        'master',
        '--head',
        rollbackBranch,
        '--title',
        `Revert: ${context.pullRequest.title}`,
        '--body',
        `Automated rollback of ${state.pullRequestUrl}.`,
      ],
      { cwd: rollbackWorktree },
    ).stdout.trim()
  }
  state = await updateState(context, { rollbackPullRequestUrl })
  const rollbackHead = pullRequestField(
    context,
    runtime,
    rollbackPullRequestUrl,
    'headRefOid',
  )
  const rollbackBase = pullRequestField(
    context,
    runtime,
    rollbackPullRequestUrl,
    'baseRefOid',
  )
  assert(
    rollbackHead === state.rollbackCommit &&
      rollbackBase === state.rollbackBaseRevision,
    'Rollback pull request revisions do not match the journaled rollback',
  )
  let rollbackState = pullRequestField(
    context,
    runtime,
    rollbackPullRequestUrl,
    'state',
  )
  if (rollbackState !== 'MERGED') {
    state = await updateState(context, { rollbackMergeRequested: true })
    runtime.run(
      'gh',
      [
        'pr',
        'merge',
        rollbackPullRequestUrl,
        '--repo',
        context.githubRepository,
        '--merge',
        '--match-head-commit',
        state.rollbackCommit,
      ],
      { cwd: rollbackWorktree },
    )
    rollbackState = pullRequestField(
      context,
      runtime,
      rollbackPullRequestUrl,
      'state',
    )
  }
  assert(rollbackState === 'MERGED', 'Rollback pull request is not merged')
  git(runtime, context.repository, ['fetch', 'origin', 'master'])
  const rollbackMergedRevision = pullRequestField(
    context,
    runtime,
    rollbackPullRequestUrl,
    'mergeCommit',
  )
  assert(
    /^[a-f0-9]{40}$/.test(rollbackMergedRevision),
    'Rollback pull request merge commit is unavailable',
  )
  assertMergeParents(
    context,
    runtime,
    rollbackMergedRevision,
    state.rollbackBaseRevision,
    state.rollbackCommit,
  )
  return updateState(context, {
    rollbackPullRequestUrl,
    rollbackMergedRevision,
  })
}

async function verifyGitRollback(
  context: ReleaseContext,
  runtime: DriverRuntime,
) {
  requireGitDriverContext(context)
  const state = await readState(context)
  if (!state.pullRequestUrl) {
    assert(
      !state.mergedRevision,
      'Merged release evidence is missing its pull request',
    )
    const remoteBranch = git(
      runtime,
      context.repository,
      ['ls-remote', '--heads', 'origin', context.branch],
      true,
    ).stdout.trim()
    assert(!remoteBranch, 'Release branch still exists on origin')
    return state
  }

  if (!state.mergedRevision) {
    const status = runtime.run(
      'gh',
      [
        'pr',
        'view',
        state.pullRequestUrl,
        '--repo',
        context.githubRepository,
        '--json',
        'state',
        '--jq',
        '.state',
      ],
      { cwd: context.repository },
    ).stdout.trim()
    assert(status === 'CLOSED', 'Unmerged release pull request is not closed')
    const remoteBranch = git(
      runtime,
      context.repository,
      ['ls-remote', '--heads', 'origin', context.branch],
      true,
    ).stdout.trim()
    assert(!remoteBranch, 'Unmerged release branch still exists on origin')
    return state
  }

  assert(
    state.rollbackPullRequestUrl &&
      state.rollbackCommit &&
      state.rollbackMergedRevision,
    'Merged rollback evidence is incomplete',
  )
  const status = runtime.run(
    'gh',
    [
      'pr',
      'view',
      state.rollbackPullRequestUrl,
      '--repo',
      context.githubRepository,
      '--json',
      'state',
      '--jq',
      '.state',
    ],
    { cwd: context.repository },
  ).stdout.trim()
  assert(status === 'MERGED', 'Rollback pull request is not merged')
  git(runtime, context.repository, [
    'merge-base',
    '--is-ancestor',
    state.rollbackCommit,
    state.rollbackMergedRevision,
  ])
  git(runtime, context.repository, [
    'merge-base',
    '--is-ancestor',
    state.rollbackMergedRevision,
    'origin/master',
  ])
  return state
}

async function cleanup(context: ReleaseContext, runtime: DriverRuntime) {
  requireGitDriverContext(context)
  const state = await readState(context)
  const registeredWorktrees = new Set(
    git(runtime, context.repository, ['worktree', 'list', '--porcelain']).stdout
      .split('\n')
      .filter((line) => line.startsWith('worktree '))
      .map((line) => resolve(line.slice('worktree '.length))),
  )
  const worktrees = [
    context.buildWorktree,
    `${context.releaseWorktree}-revert`,
    context.releaseWorktree,
  ]
  for (const worktree of worktrees) {
    if (registeredWorktrees.has(resolve(worktree))) {
      git(runtime, context.repository, [
        'worktree',
        'remove',
        '--force',
        worktree,
      ])
    }
    assert(
      !(await pathExists(worktree)),
      `Machine-owned worktree was not removed: ${worktree}`,
    )
  }
  const branches = [
    ...(state.rollbackPreparationRequested
      ? [`${context.branch}-revert`]
      : []),
    ...(state.releasePreparationRequested ? [context.branch] : []),
  ]
  for (const branch of branches) {
    const exists = git(
      runtime,
      context.repository,
      ['show-ref', '--verify', '--quiet', `refs/heads/${branch}`],
      true,
    )
    if (exists.status === 0) {
      git(runtime, context.repository, ['branch', '-D', branch])
    }
    const remaining = git(
      runtime,
      context.repository,
      ['show-ref', '--verify', '--quiet', `refs/heads/${branch}`],
      true,
    )
    assert(remaining.status !== 0, `Machine-owned branch was not removed: ${branch}`)
  }
  return updateState(context, { cleaned: true })
}

export async function executeDriver(
  action: DriverAction,
  context: ReleaseContext,
  runtime: DriverRuntime = defaultRuntime(),
) {
  switch (action) {
    case 'validate-scope':
      return validateScope(context, runtime)
    case 'validate-change':
      return validateChange(context, runtime)
    case 'verify-layout':
      return verifyLayout(context, runtime)
    case 'verify-playwright':
      return verifyPlaywright(context, runtime)
    case 'git-release':
      return gitRelease(context, runtime)
    case 'build-merged':
      return buildMerged(context, runtime)
    case 'rollback-git':
      return rollbackGit(context, runtime)
    case 'verify-git-rollback':
      return verifyGitRollback(context, runtime)
    case 'cleanup':
      return cleanup(context, runtime)
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const action = process.argv[2] as DriverAction | undefined
  const contextPath = process.env.DASHBOARD_RELEASE_CONTEXT
  assert(action, 'Release driver action is required')
  assert(contextPath, 'DASHBOARD_RELEASE_CONTEXT is required')
  const context = await loadReleaseContext(contextPath)
  await verifyAuthorizedReleaseContext(context)
  const result = await executeDriver(action, context)
  console.log(JSON.stringify({ status: 'accepted', action, state: result }))
}
