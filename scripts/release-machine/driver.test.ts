import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { mkdirSync, rmSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  calculateReleaseScopeHash,
  sha256,
  validateReleaseContext,
} from './contracts'
import {
  executeDriver,
  type DriverRuntime,
} from './driver'

async function executableContext(root: string) {
  const evidenceDirectory = join(root, 'artifacts', 'release', 'driver-test')
  const patchPath = join(root, 'release.patch')
  const machineWorktreeRoot = join(dirname(root), '.release-worktrees')
  const worktreeName = basename(root)
  await mkdir(evidenceDirectory, { recursive: true })
  await mkdir(join(`${root}-deps`, 'node_modules'), { recursive: true })
  await writeFile(patchPath, 'patch')
  const context = {
    version: 1,
    variant: 'repository-only',
    repository: root,
    baseRevision: 'a'.repeat(40),
    scopePaths: ['README.md'],
    branch: 'copilot/release-driver-test',
    evidenceDirectory,
    patch: { path: patchPath, sha256: sha256(await readFile(patchPath)) },
    releaseWorktree: join(machineWorktreeRoot, worktreeName),
    buildWorktree: join(machineWorktreeRoot, `${worktreeName}-build`),
    dependencyWorktree: `${root}-deps`,
    githubRepository: 'SFenton/ha-sfenton-react-dash',
    commit: { title: 'Test release driver', body: 'Exercise release flow.' },
    pullRequest: { title: 'Test release driver', body: 'Exercise release flow.' },
  } as const
  return validateReleaseContext({
    ...context,
    scopeHash: await calculateReleaseScopeHash(context),
  })
}

function fakeRuntime(
  root: string,
  initiallyMerged: string[] = [],
) {
  const commands: string[] = []
  const branches = new Set<string>()
  const mergedPullRequests = new Set(initiallyMerged)
  let revisionCalls = 0
  let committed = false
  let rollbackCommitted = false
  const run = vi.fn<DriverRuntime['run']>((command, args, options) => {
    commands.push([command, ...args].join(' '))
    if (command === 'git' && args[0] === 'rev-parse') {
      revisionCalls += 1
      if (args[1] === 'HEAD') {
        return {
          status: 0,
          stdout: `${
            options?.cwd?.endsWith('-revert') && rollbackCommitted
              ? 'e'.repeat(40)
              : options?.cwd === root
                ? 'a'.repeat(40)
                : committed
                  ? 'd'.repeat(40)
                  : 'a'.repeat(40)
          }\n`,
          stderr: '',
        }
      }
      if (args[1] === 'origin/master') {
        return {
          status: 0,
          stdout: `${
            mergedPullRequests.has(
              'https://github.com/SFenton/ha-sfenton-react-dash/pull/1000',
            )
              ? 'f'.repeat(40)
              : mergedPullRequests.has(
                    'https://github.com/SFenton/ha-sfenton-react-dash/pull/999',
                  )
                ? 'c'.repeat(40)
                : 'a'.repeat(40)
          }\n`,
          stderr: '',
        }
      }
      return { status: 0, stdout: `${'d'.repeat(40)}\n`, stderr: '' }
    }
    if (command === 'git' && args[0] === 'apply' && args[1] === '--numstat') {
      return { status: 0, stdout: '1\t0\tREADME.md\n', stderr: '' }
    }
    if (command === 'git' && args[0] === 'diff') {
      if (!args.includes('--cached')) {
        return { status: 0, stdout: '', stderr: '' }
      }
      return {
        status: 0,
        stdout: args.includes('--name-only')
          ? 'README.md\n'
          : 'authorized binary patch\n',
        stderr: '',
      }
    }
    if (command === 'git' && args[0] === 'ls-files') {
      return { status: 0, stdout: '', stderr: '' }
    }
    if (command === 'git' && args[0] === 'show-ref') {
      const branch = args.at(-1)?.replace('refs/heads/', '') ?? ''
      return {
        status: branches.has(branch) ? 0 : 1,
        stdout: '',
        stderr: '',
      }
    }
    if (command === 'git' && args[0] === 'worktree' && args[1] === 'add') {
      const branchIndex = args.indexOf('-b')
      if (branchIndex >= 0) branches.add(args[branchIndex + 1] ?? '')
      mkdirSync(args.at(-2) ?? '', { recursive: true })
    }
    if (command === 'git' && args[0] === 'worktree' && args[1] === 'remove') {
      rmSync(args[2] ?? '', { recursive: true, force: true })
    }
    if (command === 'git' && args[0] === 'branch' && args[1] === '-D') {
      branches.delete(args[2] ?? '')
    }
    if (command === 'git' && args[0] === 'commit') committed = true
    if (command === 'git' && args[0] === 'revert') {
      rollbackCommitted = true
    }
    if (command === 'git' && args[0] === 'rev-list') {
      const revision = args.at(-1)
      return {
        status: 0,
        stdout:
          revision === 'f'.repeat(40)
            ? `${'f'.repeat(40)} ${'c'.repeat(40)} ${'e'.repeat(40)}\n`
            : `${'c'.repeat(40)} ${'a'.repeat(40)} ${'d'.repeat(40)}\n`,
        stderr: '',
      }
    }
    if (command === 'gh' && args[0] === 'pr' && args[1] === 'list') {
      return { status: 0, stdout: '[]\n', stderr: '' }
    }
    if (command === 'gh' && args[0] === 'pr' && args[1] === 'create') {
      const rollback = args.includes('Revert: Test release driver')
      return {
        status: 0,
        stdout:
          `https://github.com/SFenton/ha-sfenton-react-dash/pull/${rollback ? '1000' : '999'}\n`,
        stderr: '',
      }
    }
    if (command === 'gh' && args[0] === 'pr' && args[1] === 'view') {
      const url = args[2]
      const rollback = url?.endsWith('/1000')
      const jq = args.at(-1)
      if (jq === '.headRefOid') {
        return {
          status: 0,
          stdout: `${rollback ? 'e'.repeat(40) : 'd'.repeat(40)}\n`,
          stderr: '',
        }
      }
      if (jq === '.baseRefOid') {
        return {
          status: 0,
          stdout: `${rollback ? 'c'.repeat(40) : 'a'.repeat(40)}\n`,
          stderr: '',
        }
      }
      if (jq === '.mergeCommit.oid') {
        return {
          status: 0,
          stdout: `${rollback ? 'f'.repeat(40) : 'c'.repeat(40)}\n`,
          stderr: '',
        }
      }
      return {
        status: 0,
        stdout: `${mergedPullRequests.has(url ?? '') ? 'MERGED' : 'OPEN'}\n`,
        stderr: '',
      }
    }
    if (command === 'gh' && args[0] === 'pr' && args[1] === 'merge') {
      mergedPullRequests.add(args[2] ?? '')
    }
    return { status: 0, stdout: '', stderr: '' }
  })
  return { runtime: { run } satisfies DriverRuntime, commands, revisionCalls, root }
}

describe('repository release driver', () => {
  it('validates, commits, merges, and records immutable release evidence', async () => {
    const root = await import('node:fs/promises').then(({ mkdtemp }) =>
      mkdtemp('/tmp/release-driver-'),
    )
    const context = await executableContext(root)
    const fake = fakeRuntime(root)
    const state = await executeDriver('git-release', context, fake.runtime)

    expect(state.releaseCommit).toBe('d'.repeat(40))
    expect(state.mergedRevision).toBe('c'.repeat(40))
    expect(state.pullRequestUrl).toContain('/pull/999')
    expect(fake.commands).toContain(
      `git worktree add -b ${context.branch} ${context.releaseWorktree} ${context.baseRevision}`,
    )
    expect(fake.commands).toContain(
      `gh pr merge ${state.pullRequestUrl} --repo ${context.githubRepository} --merge --match-head-commit ${state.releaseCommit}`,
    )
  })

  describe('dashboard release validation drivers', () => {
    it('runs the exact layout assessment and affected Playwright specs', async () => {
      const root = await import('node:fs/promises').then(({ mkdtemp }) =>
        mkdtemp('/tmp/release-driver-'),
      )
      const repository = await executableContext(root)
      const candidate = {
        ...repository,
        variant: 'dashboard-production' as const,
        layoutRun: 'artifacts/layout/release-driver-test',
        affectedPlaywrightSpecs: [
          'e2e/react-dash.spec.ts',
          'e2e/modal-sheet-gestures.spec.ts',
        ],
        attestationPublicKeySha256: 'f'.repeat(64),
      }
      const context = await validateReleaseContext({
        ...candidate,
        scopeHash: await calculateReleaseScopeHash(candidate),
      })
      const fake = fakeRuntime(root)
      await executeDriver('verify-layout', context, fake.runtime)
      await executeDriver('verify-playwright', context, fake.runtime)
      expect(fake.commands).toEqual([
        'npm run layout:verify -- --run artifacts/layout/release-driver-test',
        'npm run test:e2e -- e2e/react-dash.spec.ts e2e/modal-sheet-gestures.spec.ts',
      ])
    })
  })

  it('uses a revert pull request for a merged release rollback', async () => {
    const root = await import('node:fs/promises').then(({ mkdtemp }) =>
      mkdtemp('/tmp/release-driver-'),
    )
    const context = await executableContext(root)
    await writeFile(
      join(context.evidenceDirectory, 'driver-state.json'),
      JSON.stringify({
        version: 1,
        releaseCommit: 'd'.repeat(40),
        pullRequestUrl: 'https://github.com/SFenton/ha-sfenton-react-dash/pull/999',
        mergedRevision: 'c'.repeat(40),
      }),
    )
    const fake = fakeRuntime(root, [
      'https://github.com/SFenton/ha-sfenton-react-dash/pull/999',
    ])
    const state = await executeDriver('rollback-git', context, fake.runtime)
    expect(state.rollbackPullRequestUrl).toContain('/pull/1000')
    expect(fake.commands).toContain(`git revert --no-edit ${'d'.repeat(40)}`)
    expect(
      fake.commands.some((command) =>
        command.includes('gh pr merge') && command.includes('--merge'),
      ),
    ).toBe(true)
    await expect(
      executeDriver('verify-git-rollback', context, fake.runtime),
    ).resolves.toMatchObject({
      rollbackPullRequestUrl: expect.stringContaining('/pull/1000'),
    })
  })

  it('verifies rollback before a release pull request exists', async () => {
    const root = await import('node:fs/promises').then(({ mkdtemp }) =>
      mkdtemp('/tmp/release-driver-'),
    )
    const context = await executableContext(root)
    await writeFile(
      join(context.evidenceDirectory, 'driver-state.json'),
      JSON.stringify({
        version: 1,
        releaseCommit: 'd'.repeat(40),
        releasePushRequested: true,
      }),
    )
    const fake = fakeRuntime(root)
    await expect(
      executeDriver('rollback-git', context, fake.runtime),
    ).resolves.toMatchObject({ releaseCommit: 'd'.repeat(40) })
    await expect(
      executeDriver('verify-git-rollback', context, fake.runtime),
    ).resolves.toMatchObject({ releaseCommit: 'd'.repeat(40) })
  })

  it('reconciles an authoritative merged PR after a local crash', async () => {
    const root = await import('node:fs/promises').then(({ mkdtemp }) =>
      mkdtemp('/tmp/release-driver-'),
    )
    const context = await executableContext(root)
    await writeFile(
      join(context.evidenceDirectory, 'driver-state.json'),
      JSON.stringify({
        version: 1,
        releaseCommit: 'd'.repeat(40),
        pullRequestUrl:
          'https://github.com/SFenton/ha-sfenton-react-dash/pull/999',
        mergeRequested: true,
      }),
    )
    const fake = fakeRuntime(root, [
      'https://github.com/SFenton/ha-sfenton-react-dash/pull/999',
    ])
    const state = await executeDriver(
      'rollback-git',
      context,
      fake.runtime,
    )
    expect(state.mergedRevision).toBe('c'.repeat(40))
    expect(state.rollbackPullRequestUrl).toContain('/pull/1000')
    expect(fake.commands).toContain(`git revert --no-edit ${'d'.repeat(40)}`)
  })
})
