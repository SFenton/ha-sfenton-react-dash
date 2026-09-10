import { execFileSync } from 'node:child_process'
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  calculateReleaseScopeHash,
  sha256,
  validateReleaseContext,
} from './contracts'
import { executeDriver } from './driver'

const originalPath = process.env.PATH
const originalRemote = process.env.FAKE_GIT_REMOTE

afterEach(() => {
  process.env.PATH = originalPath
  if (originalRemote === undefined) delete process.env.FAKE_GIT_REMOTE
  else process.env.FAKE_GIT_REMOTE = originalRemote
})

function git(cwd: string, ...args: string[]) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()
}

describe('repository release driver integration', () => {
  it('releases, builds, reverts, verifies, and cleans up against local Git and fake GitHub', async () => {
    const root = await mkdtemp(join(tmpdir(), 'release-driver-integration-'))
    const repository = join(root, 'repository')
    const remote = join(root, 'remote.git')
    const fakeBin = join(root, 'bin')
    const machineWorktrees = join(dirname(repository), '.release-worktrees')
    const evidenceDirectory = join(repository, 'artifacts', 'release', 'integration')
    await mkdir(repository)
    await mkdir(fakeBin)
    git(root, 'init', '--bare', remote)
    git(repository, 'init', '-b', 'master')
    git(repository, 'config', 'user.name', 'Release Test')
    git(repository, 'config', 'user.email', 'release-test@example.invalid')
    await writeFile(
      join(repository, 'package.json'),
      JSON.stringify({
        private: true,
        scripts: { build: 'node build.mjs' },
      }),
    )
    await writeFile(
      join(repository, 'build.mjs'),
      "import { mkdirSync, writeFileSync } from 'node:fs'; mkdirSync('dist', { recursive: true }); writeFileSync('dist/index.html', '<h1>built</h1>');\n",
    )
    await writeFile(join(repository, 'README.md'), 'before\n')
    await writeFile(join(repository, '.gitignore'), 'node_modules\n')
    await mkdir(join(repository, 'node_modules'))
    git(repository, 'add', '.')
    git(repository, 'commit', '-m', 'Initial')
    git(repository, 'remote', 'add', 'origin', remote)
    git(repository, 'push', '-u', 'origin', 'master')
    const baseRevision = git(repository, 'rev-parse', 'HEAD')

    await writeFile(join(repository, 'README.md'), 'after\n')
    const patchPath = join(repository, 'release.patch')
    await writeFile(
      patchPath,
      execFileSync('git', ['diff', '--binary', '--', 'README.md'], {
        cwd: repository,
      }),
    )
    await writeFile(join(repository, 'README.md'), 'before\n')

    const ghPath = join(fakeBin, 'gh')
    await writeFile(
      ghPath,
      `#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
const args = process.argv.slice(2)
if (args[0] === 'pr' && args[1] === 'list') {
  console.log('[]')
} else if (args[0] === 'pr' && args[1] === 'create') {
  const branch = execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim()
  console.log(\`https://github.com/SFenton/ha-sfenton-react-dash/pull/\${branch.endsWith('-revert') ? '1000' : '999'}\`)
} else if (args[0] === 'pr' && args[1] === 'merge') {
  const branch = execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim()
  const head = execFileSync('git', ['--git-dir', process.env.FAKE_GIT_REMOTE, 'rev-parse', \`refs/heads/\${branch}\`], { encoding: 'utf8' }).trim()
  const base = execFileSync('git', ['--git-dir', process.env.FAKE_GIT_REMOTE, 'rev-parse', 'refs/heads/master'], { encoding: 'utf8' }).trim()
  const tree = execFileSync('git', ['--git-dir', process.env.FAKE_GIT_REMOTE, 'rev-parse', \`\${head}^{tree}\`], { encoding: 'utf8' }).trim()
  const merge = execFileSync('git', ['--git-dir', process.env.FAKE_GIT_REMOTE, 'commit-tree', tree, '-p', base, '-p', head], {
    encoding: 'utf8',
    input: 'Fake merge\\n',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'Fake GitHub',
      GIT_AUTHOR_EMAIL: 'fake@example.invalid',
      GIT_COMMITTER_NAME: 'Fake GitHub',
      GIT_COMMITTER_EMAIL: 'fake@example.invalid',
    },
  }).trim()
  execFileSync('git', ['--git-dir', process.env.FAKE_GIT_REMOTE, 'update-ref', 'refs/heads/master', merge])
} else if (args[0] === 'pr' && args[1] === 'view') {
  const branch = args[2].endsWith('/1000')
    ? 'copilot/release-driver-integration-revert'
    : 'copilot/release-driver-integration'
  const head = execFileSync('git', ['--git-dir', process.env.FAKE_GIT_REMOTE, 'rev-parse', \`refs/heads/\${branch}\`], { encoding: 'utf8' }).trim()
  const base = execFileSync('git', ['rev-parse', \`\${head}^\`], { encoding: 'utf8' }).trim()
  const master = execFileSync('git', ['--git-dir', process.env.FAKE_GIT_REMOTE, 'rev-parse', 'refs/heads/master'], { encoding: 'utf8' }).trim()
  const masterLine = execFileSync('git', ['--git-dir', process.env.FAKE_GIT_REMOTE, 'rev-list', '--parents', '-n', '1', master], { encoding: 'utf8' }).trim().split(/\\s+/)
  const merged = masterLine.length === 3 && masterLine[2] === head
  const jq = args[args.indexOf('--jq') + 1]
  if (jq === '.headRefOid') console.log(head)
  else if (jq === '.baseRefOid') console.log(base)
  else if (jq === '.mergeCommit.oid') console.log(master)
  else if (jq === '.state') console.log(merged ? 'MERGED' : 'OPEN')
  else throw new Error(\`Unsupported fake gh jq: \${jq}\`)
} else if (args[0] === 'pr' && args[1] === 'close') {
  console.log('closed')
} else {
  throw new Error(\`Unsupported fake gh arguments: \${args.join(' ')}\`)
}
`,
    )
    await chmod(ghPath, 0o755)
    process.env.PATH = `${fakeBin}:${originalPath}`
    process.env.FAKE_GIT_REMOTE = remote

    const contextInput = {
      version: 1,
      variant: 'repository-only',
      repository,
      baseRevision,
      scopePaths: ['README.md'],
      branch: 'copilot/release-driver-integration',
      evidenceDirectory,
      patch: { path: patchPath, sha256: sha256(await readFile(patchPath)) },
      releaseWorktree: join(machineWorktrees, 'integration-release'),
      buildWorktree: join(machineWorktrees, 'integration-build'),
      dependencyWorktree: repository,
      githubRepository: 'SFenton/ha-sfenton-react-dash',
      commit: { title: 'Integration release', body: 'Exercise local release.' },
      pullRequest: { title: 'Integration release', body: 'Exercise local release.' },
    } as const
    const context = await validateReleaseContext({
      ...contextInput,
      scopeHash: await calculateReleaseScopeHash(contextInput),
    })

    const released = await executeDriver('git-release', context)
    expect(released.releaseCommit).toMatch(/^[a-f0-9]{40}$/)
    expect(
      git(repository, 'merge-base', '--is-ancestor', released.releaseCommit!, 'origin/master'),
    ).toBe('')

    const built = await executeDriver('build-merged', context)
    expect(built.buildManifestHash).toMatch(/^[a-f0-9]{64}$/)
    expect(
      JSON.parse(
        await readFile(join(evidenceDirectory, 'build-manifest.json'), 'utf8'),
      ).files,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'index.html' }),
      ]),
    )

    const rolledBack = await executeDriver('rollback-git', context)
    expect(rolledBack.rollbackCommit).toMatch(/^[a-f0-9]{40}$/)
    await expect(
      executeDriver('verify-git-rollback', context),
    ).resolves.toMatchObject({
      rollbackPullRequestUrl:
        'https://github.com/SFenton/ha-sfenton-react-dash/pull/1000',
    })

    await expect(executeDriver('cleanup', context)).resolves.toMatchObject({
      cleaned: true,
    })
  }, 30_000)
})
