import { createHash } from 'node:crypto'
import { readFile, realpath } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve } from 'node:path'
import { validateChangedTestPolicy } from '../test-change-policy'

export type ReleaseVariant = 'repository-only' | 'dashboard-production'

export type ReleaseContext = {
  version: 1
  variant: ReleaseVariant
  repository: string
  baseRevision: string
  scopeHash: string
  scopePaths: string[]
  branch: string
  evidenceDirectory: string
  patch?: {
    path: string
    sha256: string
  }
  releaseWorktree?: string
  buildWorktree?: string
  dependencyWorktree?: string
  githubRepository?: string
  commit?: {
    title: string
    body: string
  }
  pullRequest?: {
    title: string
    body: string
  }
  layoutRun?: string
  affectedPlaywrightSpecs?: string[]
  attestationPublicKeySha256?: string
}

export type ReleaseStep = {
  id: string
  label: string
  sideEffect: 'none' | 'workspace' | 'github' | 'production'
  evidence: string[]
  failure: 'rejected' | 'rollback-git' | 'rollback-production' | 'abnormal'
  rollbackOnly?: true
}

export type ReleasePlan = {
  version: 1
  variant: ReleaseVariant
  repository: string
  baseRevision: string
  scopeHash: string
  scopePaths: string[]
  branch: string
  steps: ReleaseStep[]
  planHash: string
}

const SAFE_BRANCH = /^copilot\/[a-z0-9]+(?:-[a-z0-9]+)*$/
const SHA_1 = /^[a-f0-9]{40}$/
const SHA_256 = /^[a-f0-9]{64}$/
const SAFE_PATH = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))(?!.*(?:^|\/)\.git(?:\/|$))(?!.*(?:^|\/)\.env(?:\.|\/|$)).+/

const BASE_STEPS: ReleaseStep[] = [
  {
    id: 'validate-scope',
    label: 'Validate the exact release scope',
    sideEffect: 'workspace',
    evidence: ['base revision', 'scope hash', 'patch hash', 'changed paths'],
    failure: 'rejected',
  },
  {
    id: 'validate-change',
    label: 'Run release-owned validation',
    sideEffect: 'workspace',
    evidence: ['test, lint, build and policy results'],
    failure: 'rejected',
  },
]

const REPOSITORY_STEPS: ReleaseStep[] = [
  ...BASE_STEPS,
  {
    id: 'create-merge-pr',
    label: 'Create and merge the scoped pull request',
    sideEffect: 'github',
    evidence: ['branch', 'commit', 'pull request', 'merge commit'],
    failure: 'rollback-git',
  },
  {
    id: 'build-merged-master',
    label: 'Build the isolated merged origin/master revision',
    sideEffect: 'workspace',
    evidence: ['release commit ancestry', 'detached merged revision', 'build result'],
    failure: 'rollback-git',
  },
  {
    id: 'rollback-git',
    label: 'Close or revert the release',
    sideEffect: 'github',
    evidence: ['closed pull request or merged revert pull request'],
    failure: 'abnormal',
    rollbackOnly: true,
  },
  {
    id: 'cleanup-release',
    label: 'Remove exact temporary release artifacts',
    sideEffect: 'workspace',
    evidence: ['removed worktrees', 'preserved primary worktree'],
    failure: 'abnormal',
  },
]

const DASHBOARD_STEPS: ReleaseStep[] = [
  ...BASE_STEPS,
  {
    id: 'verify-layout-review',
    label: 'Verify provenance-bound layout and manual review evidence',
    sideEffect: 'workspace',
    evidence: ['layout assessment', 'manual interaction and image review'],
    failure: 'rejected',
  },
  {
    id: 'verify-affected-playwright',
    label: 'Run affected Playwright tests with an owned server',
    sideEffect: 'workspace',
    evidence: ['affected specs', 'owned build and server', 'browser results'],
    failure: 'rejected',
  },
  {
    id: 'create-merge-pr',
    label: 'Create and merge the scoped pull request',
    sideEffect: 'github',
    evidence: ['branch', 'commit', 'pull request', 'merge commit'],
    failure: 'rollback-git',
  },
  {
    id: 'build-merged-master',
    label: 'Build the isolated merged origin/master revision',
    sideEffect: 'workspace',
    evidence: ['detached merged revision', 'bundle manifest and hashes'],
    failure: 'rollback-git',
  },
  {
    id: 'capture-production',
    label: 'Capture the current production bundle and host metadata',
    sideEffect: 'production',
    evidence: ['asset backup', 'legacy wrapper version', 'panel registration'],
    failure: 'rollback-git',
  },
  {
    id: 'deploy-both-hosts',
    label: 'Deploy the merged bundle to both Home Assistant hosts',
    sideEffect: 'production',
    evidence: ['raw app', 'legacy wrapper', 'custom panel', 'deployment version'],
    failure: 'rollback-production',
  },
  {
    id: 'verify-production',
    label: 'Verify production behavior and required human attestations',
    sideEffect: 'production',
    evidence: ['bundle parity', 'host checks', 'responsive review', 'real-phone attestation'],
    failure: 'rollback-production',
  },
  {
    id: 'rollback-production',
    label: 'Restore the prior production bundle and host metadata',
    sideEffect: 'production',
    evidence: ['restored bundle', 'restored wrapper', 'healthy hosts'],
    failure: 'abnormal',
    rollbackOnly: true,
  },
  {
    id: 'rollback-git',
    label: 'Close or revert the release',
    sideEffect: 'github',
    evidence: ['closed pull request or merged revert pull request'],
    failure: 'abnormal',
    rollbackOnly: true,
  },
  {
    id: 'cleanup-release',
    label: 'Remove exact temporary release artifacts',
    sideEffect: 'workspace',
    evidence: ['removed worktrees', 'preserved primary worktree'],
    failure: 'abnormal',
  },
]

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

export function sha256(value: unknown) {
  if (Buffer.isBuffer(value)) {
    return createHash('sha256').update(value).digest('hex')
  }
  const serialized = typeof value === 'string' ? value : JSON.stringify(value)
  return createHash('sha256').update(serialized).digest('hex')
}

export async function calculateReleaseScopeHash(
  context: Omit<ReleaseContext, 'scopeHash'>,
) {
  const repository = await realpath(context.repository)
  return sha256({
    version: context.version,
    variant: context.variant,
    repository,
    baseRevision: context.baseRevision,
    scopePaths: [...context.scopePaths].sort(),
    branch: context.branch,
    evidenceDirectory: context.evidenceDirectory,
    patch: context.patch
      ? {
          path: context.patch.path,
          sha256: context.patch.sha256,
        }
      : null,
    releaseWorktree: context.releaseWorktree ?? null,
    buildWorktree: context.buildWorktree ?? null,
    dependencyWorktree: context.dependencyWorktree ?? null,
    githubRepository: context.githubRepository ?? null,
    commit: context.commit ?? null,
    pullRequest: context.pullRequest ?? null,
    layoutRun: context.layoutRun ?? null,
    affectedPlaywrightSpecs: context.affectedPlaywrightSpecs
      ? [...context.affectedPlaywrightSpecs].sort()
      : null,
    attestationPublicKeySha256:
      context.attestationPublicKeySha256 ?? null,
  })
}

export async function loadReleaseContext(contextPath: string) {
  assert(isAbsolute(contextPath), 'Release context path must be absolute')
  return validateReleaseContext(
    JSON.parse(await readFile(contextPath, 'utf8')) as unknown,
  )
}

export async function verifyAuthorizedReleaseContext(
  context: ReleaseContext,
  environment: NodeJS.ProcessEnv = process.env,
) {
  const authorizedRepository = environment.RELEASE_AUTHORIZED_REPOSITORY
  const authorizedBaseRevision =
    environment.RELEASE_AUTHORIZED_BASE_REVISION
  const authorizedScopeHash = environment.RELEASE_AUTHORIZED_SCOPE_HASH
  const authorizedVariant = environment.RELEASE_AUTHORIZED_VARIANT
  const authorizedWorkflowId =
    environment.RELEASE_AUTHORIZED_WORKFLOW_ID
  const authorizedPlanHash = environment.RELEASE_AUTHORIZED_PLAN_HASH
  const authorizationHash = environment.RELEASE_AUTHORIZATION_HASH
  assert(
    authorizedRepository &&
      authorizedBaseRevision &&
      authorizedScopeHash &&
      authorizedVariant &&
      authorizedWorkflowId &&
      authorizedPlanHash &&
      authorizationHash,
    'Trusted release authorization environment is required',
  )
  assert(
    (await realpath(authorizedRepository)) === context.repository,
    'Authorized repository does not match the release context',
  )
  assert(
    authorizedBaseRevision === context.baseRevision,
    'Authorized base revision does not match the release context',
  )
  assert(
    authorizedScopeHash === context.scopeHash,
    'Authorized scope hash does not match the release context',
  )
  assert(
    authorizedVariant === context.variant,
    'Authorized variant does not match the release context',
  )
  assert(
    SHA_256.test(authorizedPlanHash) && SHA_256.test(authorizationHash),
    'Trusted release authorization hashes are invalid',
  )
}

export async function validateReleaseContext(value: unknown): Promise<ReleaseContext> {
  assert(value && typeof value === 'object', 'Release context must be an object')
  const context = value as Partial<ReleaseContext>
  assert(context.version === 1, 'Release context version must be 1')
  assert(
    context.variant === 'repository-only' ||
      context.variant === 'dashboard-production',
    'Release variant is invalid',
  )
  assert(typeof context.repository === 'string' && isAbsolute(context.repository), 'Repository path must be absolute')
  const repository = await realpath(context.repository)
  assert(SHA_1.test(context.baseRevision ?? ''), 'Base revision must be a full commit SHA')
  assert(SHA_256.test(context.scopeHash ?? ''), 'Scope hash must be SHA-256')
  assert(Array.isArray(context.scopePaths) && context.scopePaths.length > 0, 'Release scope paths are required')
  const scopePaths = [...new Set(context.scopePaths)]
  assert(scopePaths.length === context.scopePaths.length, 'Release scope paths must be unique')
  assert(scopePaths.every((path) => typeof path === 'string' && SAFE_PATH.test(path)), 'Release scope contains an unsafe path')
  assert(
    !scopePaths.some((path) =>
      ['package.json', 'package-lock.json'].includes(path),
    ),
    'Dependency manifest releases require an isolated dependency installation driver',
  )
  validateChangedTestPolicy(scopePaths, { root: repository })
  assert(typeof context.branch === 'string' && SAFE_BRANCH.test(context.branch), 'Release branch must be a copilot/* kebab-case branch')
  assert(
    typeof context.evidenceDirectory === 'string' &&
      isAbsolute(context.evidenceDirectory),
    'Evidence directory must be absolute',
  )
  assert(
    !relative(repository, resolve(repository, context.evidenceDirectory)).startsWith('..'),
    'Evidence directory must stay inside the repository',
  )

  if (context.patch) {
    assert(isAbsolute(context.patch.path), 'Patch path must be absolute')
    assert(SHA_256.test(context.patch.sha256), 'Patch hash must be SHA-256')
  }
  const machineWorktreeRoot = resolve(
    dirname(repository),
    '.release-worktrees',
  )
  for (const [label, candidate] of [
    ['Release worktree', context.releaseWorktree],
    ['Build worktree', context.buildWorktree],
  ] as const) {
    if (candidate !== undefined) {
      assert(isAbsolute(candidate), `${label} must be absolute`)
      const child = relative(machineWorktreeRoot, resolve(candidate))
      assert(
        child.length > 0 &&
          !child.startsWith('..') &&
          !child.includes('/') &&
          !child.includes('\\'),
        `${label} must be a direct child of ${machineWorktreeRoot}`,
      )
    }
  }
  assert(
    !context.releaseWorktree ||
      !context.buildWorktree ||
      resolve(context.releaseWorktree) !== resolve(context.buildWorktree),
    'Release and build worktrees must be distinct',
  )
  assert(
    !context.releaseWorktree ||
      !context.buildWorktree ||
      resolve(`${context.releaseWorktree}-revert`) !==
        resolve(context.buildWorktree),
    'Rollback and build worktrees must be distinct',
  )
  if (context.dependencyWorktree !== undefined) {
    assert(
      isAbsolute(context.dependencyWorktree),
      'Dependency worktree must be absolute',
    )
  }
  if (context.githubRepository !== undefined) {
    assert(
      /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(context.githubRepository),
      'GitHub repository must use owner/repository form',
    )
  }
  for (const [label, value] of [
    ['Commit title', context.commit?.title],
    ['Commit body', context.commit?.body],
    ['Pull request title', context.pullRequest?.title],
    ['Pull request body', context.pullRequest?.body],
  ] as const) {
    if (value !== undefined) {
      assert(
        typeof value === 'string' && value.trim().length > 0,
        `${label} is required`,
      )
    }
  }

  if (context.variant === 'repository-only') {
    assert(!context.layoutRun, 'Repository-only releases cannot declare layout evidence')
    assert(
      !context.affectedPlaywrightSpecs?.length,
      'Repository-only releases cannot declare affected Playwright specs',
    )
  } else {
    assert(
      typeof context.layoutRun === 'string' &&
        /^artifacts\/layout\/[a-zA-Z0-9._-]+$/.test(context.layoutRun),
      'Dashboard releases require a repository-relative layout run',
    )
    assert(
      Array.isArray(context.affectedPlaywrightSpecs) &&
        context.affectedPlaywrightSpecs.length > 0 &&
        context.affectedPlaywrightSpecs.every(
          (path) => /^e2e\/[a-zA-Z0-9._/-]+\.spec\.ts$/.test(path),
        ),
      'Dashboard releases require safe affected Playwright specs',
    )
    const changedPlaywrightSpecs = scopePaths.filter(
      (path) => /^e2e\/.+\.spec\.ts$/.test(path),
    )
    assert(
      changedPlaywrightSpecs.every((path) =>
        context.affectedPlaywrightSpecs?.includes(path),
      ),
      'Changed Playwright specs must be included in the affected release specs',
    )
    assert(
      SHA_256.test(context.attestationPublicKeySha256 ?? ''),
      'Dashboard releases require an attestation public-key hash',
    )
  }

  const normalized = {
    ...context,
    repository,
    scopePaths,
  } as ReleaseContext
  assert(
    normalized.scopeHash ===
      (await calculateReleaseScopeHash(normalized)),
    'Scope hash does not bind the complete release context',
  )
  return normalized
}

export function buildReleasePlan(context: ReleaseContext): ReleasePlan {
  const unsigned = {
    version: 1 as const,
    variant: context.variant,
    repository: context.repository,
    baseRevision: context.baseRevision,
    scopeHash: context.scopeHash,
    scopePaths: context.scopePaths,
    branch: context.branch,
    steps:
      context.variant === 'repository-only'
        ? REPOSITORY_STEPS
        : DASHBOARD_STEPS,
  }
  return { ...unsigned, planHash: sha256(unsigned) }
}

export async function verifyPatch(context: ReleaseContext) {
  if (!context.patch) return null
  const digest = sha256(await readFile(context.patch.path))
  assert(digest === context.patch.sha256, 'Release patch hash mismatch')
  return digest
}
