import { createHash } from 'node:crypto'

export const ADMIN_ISSUE_MARKER_PREFIX = 'admin-todo-uid:'
export const ADMIN_TODO_ATTACHMENTS_PREFIX = 'admin-todo-attachments:'
export const CONTROLLER_COMMENT_MARKER = '<!-- admin-issue-controller -->'
export const ADMIN_ISSUE_STATE_VERSION = 2 as const
export const GITHUB_AUTOMATION_ISSUE_MARKERS = [
  'layout-failure-commit-',
  'dashboard-deployment-failure-run-',
] as const
export const REQUIRED_DEPLOYMENT_VERIFIED_PATHS = [
  'deployment.json',
  'index.html',
  'sfenton-react-app-card.js',
  'sfenton-react-panel.js',
] as const

export type AdminIssuePhase =
  | 'queued'
  | 'researching'
  | 'implementing'
  | 'awaiting-user'
  | 'ready-for-pr'
  | 'pull-request'
  | 'deploying'
  | 'resolving'
  | 'completed'
  | 'paused'
  | 'blocked'

export type AdminIssueInputSource =
  | 'todo-created'
  | 'todo-updated'
  | 'issue-comment'
  | 'github-issue'
  | 'ci-failure'

export interface AdminIssueInputAttachment {
  githubUrl?: string
  id: string
  localPath: string
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp'
  name: string
  sha256: string
  sizeBytes: number
}

export interface AdminIssueInput {
  attachments?: AdminIssueInputAttachment[]
  body: string
  createdAt: string
  externalId: string
  processedAt?: string
  revision: number
  source: AdminIssueInputSource
}

export interface AdminIssuePullRequest {
  number: number
  url: string
}

export interface AdminIssueDiffReceipt {
  baseSha: string
  entryCount: number
  epoch: string
  files: string[]
  generation: number
  headSha: string
  manifestSha256: string
  mergeBaseSha: string
  revision: number
  treeSha: string
}

export interface AdminIssueValidationReceipt {
  commands: string[]
  commandsSha256: string
  completedAt: string
  diffManifestSha256: string
  epoch: string
  generation: number
  headSha: string
  revision: number
  treeSha: string
}

export interface AdminIssueChecksReceipt {
  epoch: string
  generation: number
  headSha: string
  observedAt: string
  requiredSetSha256: string
  revision: number
  runs: Array<{
    appId: number
    checkRunId: number
    completedAt: string
    conclusion: 'success'
    name: string
  }>
}

export interface AdminIssueCandidate {
  checks?: AdminIssueChecksReceipt
  diff: AdminIssueDiffReceipt
  expectedRemoteHeadSha?: string
  headSha: string
  targetBaseSha: string
  treeSha: string
  validation?: AdminIssueValidationReceipt
  visualChange?: AdminIssueVisualChange
  visualEvidence?: AdminIssueVisualEvidenceReceipt[]
}

export interface AdminIssueBaseSyncTransition {
  attempt: number
  confirmation?: {
    localHeadSha: string
    observedAt: string
    prHeadSha?: string
    prNumber?: number
    remoteHeadSha: string
  }
  diagnostics?: {
    outputSha256: string
    outputTail: string
    statusSha256: string
    unmergedPaths: string[]
  }
  epoch: string
  expectedRemoteHeadSha?: string
  fromBaseSha: string
  fromHeadSha: string
  fromTreeSha: string
  generation: number
  id: string
  provisionalDiff?: AdminIssueDiffReceipt
  provisionalValidation?: AdminIssueValidationReceipt
  restoration?: {
    clean: true
    headSha: string
    noGitOperationInProgress: true
    treeSha: string
    verifiedAt: string
  }
  revision: number
  stage:
    | 'intent'
    | 'local-created'
    | 'validated'
    | 'pushed'
    | 'confirmed'
    | 'conflict-observed'
    | 'aborted'
    | 'failed'
    | 'quarantined'
  startedAt: string
  targetBaseSha: string
  toHeadSha?: string
  toTreeSha?: string
}

export interface AdminIssueMergeReceipt {
  baseSha: string
  candidateHeadSha: string
  epoch: string
  generation: number
  mergeSha: string
  mergedAt: string
  observedAt: string
  prNumber: number
  revision: number
}

export interface AdminIssueDeploymentBinding {
  coverage?: 'descendant'
  coverageVerifiedAt?: string
  deployedSha: string
  disposition: string
  epoch: string
  generation: number
  mergeSha: string
  receiptHash: string
  revision: number
  sourceSha: string
  workflowHeadSha: string
  workflowRunAttempt: number
  workflowRunId: number
}

export type AdminIssueProvenance =
  | { kind: 'none' }
  | {
    kind: 'legacy-untrusted'
    migratedAt: string
    observedBaseSha?: string
    observedHeadSha?: string
    observedMergeSha?: string
    reason: 'v1-missing-exact-provenance'
  }
  | {
    candidate?: AdminIssueCandidate
    deployment?: AdminIssueDeploymentBinding
    epoch: string
    generation: number
    kind: 'active'
    merge?: AdminIssueMergeReceipt
    preparedBaseSha: string
    quarantine?: {
      detectedAt: string
      diagnosticsSha256: string
      reason: string
    }
    resyncAttempts: number
    revision: number
    transition?: AdminIssueBaseSyncTransition
  }

export interface AdminIssueDeployment {
  conclusion?: string
  deployedSha?: string
  disposition?: string
  runAttempt?: number
  runId?: number
  url?: string
}

export interface AdminIssueRecord {
  automationKind?: 'deployment' | 'layout'
  branch?: string
  commentCursor: number
  createdAt: string
  deployment?: AdminIssueDeployment
  description: string
  generation: number
  inputRevision: number
  inputs: AdminIssueInput[]
  issueNumber: number
  issueUrl: string
  lastOutcome?: AdminIssueWorkerOutcome
  phase: AdminIssuePhase
  origin?: 'github-automation'
  pr?: AdminIssuePullRequest
  processedRevision: number
  provenance: AdminIssueProvenance
  repairAttempts: number
  receipts: Record<string, string>
  sessionId?: string
  sessionName: string
  taskFingerprint: string
  title: string
  uid: string
  updatedAt: string
  workerRuns: number
  worktreePath?: string
}

export interface AdminIssueControllerState {
  activeUid?: string
  baselineCompletedAt: string
  ignoredUids: string[]
  issues: Record<string, AdminIssueRecord>
  updatedAt: string
  version: 2
}

export interface AdminIssueQuestion {
  options: string[]
  question: string
  recommendation?: string
}

export interface AdminIssueIosFollowUp {
  reason: string
  required: boolean
}

export interface AdminIssueVisualChange {
  reason: string
  required: boolean
}

export interface AdminIssueReview {
  approved: boolean
  findings: string[]
}

export interface AdminIssuePullRequestDraft {
  body: string
  title: string
}

export interface AdminIssueVisualEvidenceDraft {
  alt: string
  caption: string
  path: string
}

export interface AdminIssueVisualEvidenceReceipt extends AdminIssueVisualEvidenceDraft {
  diffManifestSha256: string
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp'
  sha256: string
  sizeBytes: number
  url?: string
}

export type AdminIssueWorkerOutcome =
  | {
    decision: 'needs_input'
    iosFollowUp: AdminIssueIosFollowUp
    questions: AdminIssueQuestion[]
    schemaVersion: 1
    summary: string
    visualEvidence: []
  }
  | {
    decision: 'resolved_without_pr'
    iosFollowUp: AdminIssueIosFollowUp
    issueTitle: string
    questions: []
    resolution: string
    resolutionType: 'home_assistant' | 'no_repository_change'
    schemaVersion: 1
    summary: string
    verification: string[]
    visualEvidence: []
  }
  | {
    changeSummary: string[]
    decision: 'ready_for_pr'
    iosFollowUp: AdminIssueIosFollowUp
    pr: AdminIssuePullRequestDraft
    questions: []
    review: AdminIssueReview
    schemaVersion: 1
    summary: string
    tests: Array<{ command: string; result: string }>
    visualChange: AdminIssueVisualChange
    visualEvidence: AdminIssueVisualEvidenceDraft[]
  }
  | {
    decision: 'blocked'
    iosFollowUp: AdminIssueIosFollowUp
    questions: []
    reason: string
    schemaVersion: 1
    summary: string
    visualEvidence: []
  }

export interface GitHubIssueComment {
  author_association?: string
  body?: string | null
  created_at?: string
  id: number
  user?: {
    id?: number
    login?: string
  } | null
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringArray(value: unknown, field: string) {
  assert(Array.isArray(value), `${field} must be an array`)
  assert(value.every((entry) => typeof entry === 'string'), `${field} must contain only strings`)
  return value as string[]
}

function visualEvidenceDrafts(value: unknown) {
  if (value === undefined) return []
  assert(Array.isArray(value), 'visualEvidence must be an array')
  assert(value.length <= 4, 'visualEvidence supports at most four images')
  const paths = new Set<string>()
  return value.map((entry, index) => {
    assert(object(entry), `visualEvidence[${index}] must be an object`)
    const path = nonEmptyString(entry.path, `visualEvidence[${index}].path`).trim()
    const alt = nonEmptyString(entry.alt, `visualEvidence[${index}].alt`).trim()
    const caption = nonEmptyString(entry.caption, `visualEvidence[${index}].caption`).trim()
    assert(
      path.startsWith('artifacts/admin-issue-') &&
      !path.startsWith('/') &&
      !path.includes('\\') &&
      !path.split('/').includes('..') &&
      /\.(?:jpe?g|png|webp)$/i.test(path),
      `visualEvidence[${index}].path must be an image below artifacts/admin-issue-<number>/`,
    )
    assert(alt.length <= 240, `visualEvidence[${index}].alt is too long`)
    assert(caption.length <= 1_000, `visualEvidence[${index}].caption is too long`)
    assert(!paths.has(path), `visualEvidence path ${path} is duplicated`)
    paths.add(path)
    return { alt, caption, path }
  })
}

function iosFollowUp(value: unknown): AdminIssueIosFollowUp {
  assert(object(value), 'iosFollowUp must be an object')
  assert(typeof value.required === 'boolean', 'iosFollowUp.required must be a boolean')
  assert(typeof value.reason === 'string', 'iosFollowUp.reason must be a string')
  if (value.required) assert(value.reason.trim(), 'iosFollowUp.reason is required when follow-up is required')
  return {
    required: value.required,
    reason: value.reason.trim(),
  }
}

function visualChange(value: unknown): AdminIssueVisualChange {
  assert(object(value), 'visualChange must be an object')
  assert(typeof value.required === 'boolean', 'visualChange.required must be a boolean')
  assert(typeof value.reason === 'string' && value.reason.trim(), 'visualChange.reason is required')
  return {
    required: value.required,
    reason: value.reason.trim(),
  }
}

const SHA_PATTERN = /^[a-f0-9]{40}$/
const HASH_PATTERN = /^[a-f0-9]{64}$/
const ADMIN_ISSUE_PHASES = new Set<AdminIssuePhase>([
  'queued',
  'researching',
  'implementing',
  'awaiting-user',
  'ready-for-pr',
  'pull-request',
  'deploying',
  'resolving',
  'completed',
  'paused',
  'blocked',
])

function nonEmptyString(value: unknown, field: string) {
  assert(typeof value === 'string' && value.trim().length > 0, `${field} must be a non-empty string`)
  return value
}

function sha(value: unknown, field: string) {
  assert(typeof value === 'string' && SHA_PATTERN.test(value), `${field} must be a full Git SHA`)
  return value
}

function sha256(value: unknown, field: string) {
  assert(typeof value === 'string' && HASH_PATTERN.test(value), `${field} must be a SHA-256 hash`)
  return value
}

function nonNegativeInteger(value: unknown, field: string) {
  assert(Number.isInteger(value) && Number(value) >= 0, `${field} must be a non-negative integer`)
  return Number(value)
}

function positiveInteger(value: unknown, field: string) {
  assert(Number.isInteger(value) && Number(value) > 0, `${field} must be a positive integer`)
  return Number(value)
}

function isoTimestamp(value: unknown, field: string) {
  assert(
    typeof value === 'string' && value.length > 0 && !Number.isNaN(Date.parse(value)),
    `${field} must be an ISO timestamp`,
  )
  return value
}

function assertReceiptContext(
  value: Record<string, unknown>,
  field: string,
  provenance: Extract<AdminIssueProvenance, { kind: 'active' }>,
) {
  assert(value.epoch === provenance.epoch, `${field}.epoch does not match provenance`)
  assert(value.generation === provenance.generation, `${field}.generation does not match provenance`)
  assert(value.revision === provenance.revision, `${field}.revision does not match provenance`)
}

function assertDiffReceipt(
  value: unknown,
  field: string,
  provenance: Extract<AdminIssueProvenance, { kind: 'active' }>,
) {
  assert(object(value), `${field} must be an object`)
  assertReceiptContext(value, field, provenance)
  sha(value.baseSha, `${field}.baseSha`)
  sha(value.headSha, `${field}.headSha`)
  sha(value.treeSha, `${field}.treeSha`)
  sha(value.mergeBaseSha, `${field}.mergeBaseSha`)
  sha256(value.manifestSha256, `${field}.manifestSha256`)
  nonNegativeInteger(value.entryCount, `${field}.entryCount`)
  stringArray(value.files, `${field}.files`)
}

function assertValidationReceipt(
  value: unknown,
  field: string,
  provenance: Extract<AdminIssueProvenance, { kind: 'active' }>,
) {
  assert(object(value), `${field} must be an object`)
  assertReceiptContext(value, field, provenance)
  sha(value.headSha, `${field}.headSha`)
  sha(value.treeSha, `${field}.treeSha`)
  sha256(value.diffManifestSha256, `${field}.diffManifestSha256`)
  sha256(value.commandsSha256, `${field}.commandsSha256`)
  stringArray(value.commands, `${field}.commands`)
  isoTimestamp(value.completedAt, `${field}.completedAt`)
}

function assertChecksReceipt(
  value: unknown,
  field: string,
  provenance: Extract<AdminIssueProvenance, { kind: 'active' }>,
) {
  assert(object(value), `${field} must be an object`)
  assertReceiptContext(value, field, provenance)
  sha(value.headSha, `${field}.headSha`)
  sha256(value.requiredSetSha256, `${field}.requiredSetSha256`)
  isoTimestamp(value.observedAt, `${field}.observedAt`)
  assert(Array.isArray(value.runs) && value.runs.length > 0, `${field}.runs must be non-empty`)
  for (const [index, run] of value.runs.entries()) {
    assert(object(run), `${field}.runs[${index}] must be an object`)
    nonEmptyString(run.name, `${field}.runs[${index}].name`)
    positiveInteger(run.appId, `${field}.runs[${index}].appId`)
    positiveInteger(run.checkRunId, `${field}.runs[${index}].checkRunId`)
    assert(run.conclusion === 'success', `${field}.runs[${index}].conclusion must be success`)
    isoTimestamp(run.completedAt, `${field}.runs[${index}].completedAt`)
  }
}

function assertVisualEvidenceReceipt(value: unknown, field: string) {
  assert(object(value), `${field} must be an object`)
  const path = nonEmptyString(value.path, `${field}.path`)
  const alt = nonEmptyString(value.alt, `${field}.alt`)
  const caption = nonEmptyString(value.caption, `${field}.caption`)
  assert(
    path.startsWith('artifacts/admin-issue-') &&
    !path.startsWith('/') &&
    !path.includes('\\') &&
    !path.split('/').includes('..') &&
    /\.(?:jpe?g|png|webp)$/i.test(path),
    `${field}.path is invalid`,
  )
  assert(alt.length <= 240, `${field}.alt is too long`)
  assert(caption.length <= 1_000, `${field}.caption is too long`)
  assert(/\b(?:live|mock)\b/i.test(caption), `${field}.caption lacks evidence provenance`)
  sha256(value.sha256, `${field}.sha256`)
  sha256(value.diffManifestSha256, `${field}.diffManifestSha256`)
  const sizeBytes = positiveInteger(value.sizeBytes, `${field}.sizeBytes`)
  assert(sizeBytes <= 10 * 1024 * 1024, `${field}.sizeBytes exceeds the limit`)
  assert(
    ['image/jpeg', 'image/png', 'image/webp'].includes(String(value.mediaType)),
    `${field}.mediaType is invalid`,
  )
  if (value.url !== undefined) {
    assert(
      typeof value.url === 'string' &&
      /^https:\/\/github\.com\/user-attachments\/assets\/[A-Za-z0-9-]+$/.test(value.url),
      `${field}.url is not a GitHub user attachment`,
    )
  }
}

function assertInputAttachment(value: unknown, field: string) {
  assert(object(value), `${field} must be an object`)
  nonEmptyString(value.id, `${field}.id`)
  nonEmptyString(value.name, `${field}.name`)
  nonEmptyString(value.localPath, `${field}.localPath`)
  sha256(value.sha256, `${field}.sha256`)
  positiveInteger(value.sizeBytes, `${field}.sizeBytes`)
  assert(
    ['image/jpeg', 'image/png', 'image/webp'].includes(String(value.mediaType)),
    `${field}.mediaType is invalid`,
  )
  if (value.githubUrl !== undefined) {
    assert(
      typeof value.githubUrl === 'string' &&
      /^https:\/\/github\.com\/user-attachments\/assets\/[A-Za-z0-9-]+$/.test(value.githubUrl),
      `${field}.githubUrl is invalid`,
    )
  }
}

function assertProvenance(value: unknown, field: string) {
  assert(object(value), `${field} must be an object`)
  if (value.kind === 'none') return
  if (value.kind === 'legacy-untrusted') {
    assert(value.reason === 'v1-missing-exact-provenance', `${field}.reason is invalid`)
    isoTimestamp(value.migratedAt, `${field}.migratedAt`)
    for (const key of ['observedBaseSha', 'observedHeadSha', 'observedMergeSha'] as const) {
      if (value[key] !== undefined) sha(value[key], `${field}.${key}`)
    }
    return
  }
  assert(value.kind === 'active', `${field}.kind is invalid`)
  const provenance = value as Extract<AdminIssueProvenance, { kind: 'active' }>
  nonEmptyString(provenance.epoch, `${field}.epoch`)
  positiveInteger(provenance.generation, `${field}.generation`)
  nonNegativeInteger(provenance.revision, `${field}.revision`)
  sha(provenance.preparedBaseSha, `${field}.preparedBaseSha`)
  nonNegativeInteger(provenance.resyncAttempts, `${field}.resyncAttempts`)
  if (provenance.candidate) {
    sha(provenance.candidate.headSha, `${field}.candidate.headSha`)
    sha(provenance.candidate.treeSha, `${field}.candidate.treeSha`)
    sha(provenance.candidate.targetBaseSha, `${field}.candidate.targetBaseSha`)
    if (provenance.candidate.expectedRemoteHeadSha) {
      sha(
        provenance.candidate.expectedRemoteHeadSha,
        `${field}.candidate.expectedRemoteHeadSha`,
      )
    }
    assertDiffReceipt(provenance.candidate.diff, `${field}.candidate.diff`, provenance)
    assert(
      provenance.candidate.diff.baseSha === provenance.candidate.targetBaseSha &&
      provenance.candidate.diff.mergeBaseSha === provenance.candidate.targetBaseSha &&
      provenance.candidate.diff.headSha === provenance.candidate.headSha &&
      provenance.candidate.diff.treeSha === provenance.candidate.treeSha,
      `${field}.candidate.diff does not match the candidate`,
    )
    if (provenance.candidate.validation) {
      assertValidationReceipt(
        provenance.candidate.validation,
        `${field}.candidate.validation`,
        provenance,
      )
      assert(
        provenance.candidate.validation.headSha === provenance.candidate.headSha &&
        provenance.candidate.validation.treeSha === provenance.candidate.treeSha &&
        provenance.candidate.validation.diffManifestSha256 ===
          provenance.candidate.diff.manifestSha256,
        `${field}.candidate.validation does not match the candidate`,
      )
    }
    if (provenance.candidate.checks) {
      assertChecksReceipt(provenance.candidate.checks, `${field}.candidate.checks`, provenance)
      assert(
        provenance.candidate.validation &&
        provenance.candidate.checks.headSha === provenance.candidate.headSha,
        `${field}.candidate.checks do not match a validated candidate`,
      )
    }
    if (provenance.candidate.visualChange) {
      visualChange(provenance.candidate.visualChange)
    }
    if (provenance.candidate.visualEvidence) {
      assert(
        Array.isArray(provenance.candidate.visualEvidence) &&
        provenance.candidate.visualEvidence.length <= 4,
        `${field}.candidate.visualEvidence is invalid`,
      )
      const evidenceHashes = new Set<string>()
      const evidencePaths = new Set<string>()
      for (const [index, evidence] of provenance.candidate.visualEvidence.entries()) {
        assertVisualEvidenceReceipt(
          evidence,
          `${field}.candidate.visualEvidence[${index}]`,
        )
        assert(
          evidence.diffManifestSha256 === provenance.candidate.diff.manifestSha256,
          `${field}.candidate.visualEvidence[${index}] does not match the candidate diff`,
        )
        assert(
          !evidenceHashes.has(evidence.sha256) && !evidencePaths.has(evidence.path),
          `${field}.candidate.visualEvidence contains duplicates`,
        )
        evidenceHashes.add(evidence.sha256)
        evidencePaths.add(evidence.path)
      }
    }
  }
  if (provenance.transition) {
    const transition = provenance.transition
    assertReceiptContext(transition as unknown as Record<string, unknown>, `${field}.transition`, provenance)
    nonEmptyString(transition.id, `${field}.transition.id`)
    positiveInteger(transition.attempt, `${field}.transition.attempt`)
    sha(transition.fromHeadSha, `${field}.transition.fromHeadSha`)
    sha(transition.fromTreeSha, `${field}.transition.fromTreeSha`)
    sha(transition.fromBaseSha, `${field}.transition.fromBaseSha`)
    sha(transition.targetBaseSha, `${field}.transition.targetBaseSha`)
    if (transition.expectedRemoteHeadSha) {
      sha(transition.expectedRemoteHeadSha, `${field}.transition.expectedRemoteHeadSha`)
    }
    if (transition.toHeadSha) sha(transition.toHeadSha, `${field}.transition.toHeadSha`)
    if (transition.toTreeSha) sha(transition.toTreeSha, `${field}.transition.toTreeSha`)
    isoTimestamp(transition.startedAt, `${field}.transition.startedAt`)
    assert(
      [
        'intent',
        'local-created',
        'validated',
        'pushed',
        'confirmed',
        'conflict-observed',
        'aborted',
        'failed',
        'quarantined',
      ].includes(transition.stage),
      `${field}.transition.stage is invalid`,
    )
    if (transition.provisionalDiff) {
      assertDiffReceipt(transition.provisionalDiff, `${field}.transition.provisionalDiff`, provenance)
      assert(
        transition.toHeadSha === transition.provisionalDiff.headSha &&
        transition.toTreeSha === transition.provisionalDiff.treeSha &&
        transition.targetBaseSha === transition.provisionalDiff.baseSha,
        `${field}.transition.provisionalDiff does not match the target`,
      )
    }
    if (transition.provisionalValidation) {
      assertValidationReceipt(
        transition.provisionalValidation,
        `${field}.transition.provisionalValidation`,
        provenance,
      )
      assert(
        transition.provisionalDiff &&
        transition.provisionalValidation.headSha === transition.provisionalDiff.headSha &&
        transition.provisionalValidation.treeSha === transition.provisionalDiff.treeSha &&
        transition.provisionalValidation.diffManifestSha256 ===
          transition.provisionalDiff.manifestSha256,
        `${field}.transition.provisionalValidation does not match the target diff`,
      )
    }
  }
  if (provenance.merge) {
    const merge = provenance.merge
    assertReceiptContext(merge as unknown as Record<string, unknown>, `${field}.merge`, provenance)
    positiveInteger(merge.prNumber, `${field}.merge.prNumber`)
    sha(merge.candidateHeadSha, `${field}.merge.candidateHeadSha`)
    sha(merge.baseSha, `${field}.merge.baseSha`)
    sha(merge.mergeSha, `${field}.merge.mergeSha`)
    isoTimestamp(merge.mergedAt, `${field}.merge.mergedAt`)
    isoTimestamp(merge.observedAt, `${field}.merge.observedAt`)
    assert(
      provenance.candidate?.checks &&
      merge.candidateHeadSha === provenance.candidate.headSha &&
      merge.baseSha === provenance.candidate.targetBaseSha,
      `${field}.merge does not match a checked candidate`,
    )
  }
  if (provenance.deployment) {
    const deployment = provenance.deployment
    assertReceiptContext(
      deployment as unknown as Record<string, unknown>,
      `${field}.deployment`,
      provenance,
    )
    sha(deployment.mergeSha, `${field}.deployment.mergeSha`)
    sha(deployment.workflowHeadSha, `${field}.deployment.workflowHeadSha`)
    sha(deployment.sourceSha, `${field}.deployment.sourceSha`)
    sha(deployment.deployedSha, `${field}.deployment.deployedSha`)
    sha256(deployment.receiptHash, `${field}.deployment.receiptHash`)
    positiveInteger(deployment.workflowRunId, `${field}.deployment.workflowRunId`)
    positiveInteger(deployment.workflowRunAttempt, `${field}.deployment.workflowRunAttempt`)
    nonEmptyString(deployment.disposition, `${field}.deployment.disposition`)
    assert(provenance.merge, `${field}.deployment has no verified merge`)
    assert(
      deployment.mergeSha === provenance.merge.mergeSha,
      `${field}.deployment does not match the verified merge`,
    )
    if (deployment.coverage === 'descendant') {
      isoTimestamp(
        deployment.coverageVerifiedAt,
        `${field}.deployment.coverageVerifiedAt`,
      )
      assert(
        deployment.workflowHeadSha === deployment.sourceSha,
        `${field}.deployment descendant source does not match its workflow head`,
      )
    } else {
      assert(
        deployment.coverage === undefined &&
        deployment.coverageVerifiedAt === undefined &&
        deployment.workflowHeadSha === provenance.merge.mergeSha &&
        deployment.sourceSha === provenance.merge.mergeSha,
        `${field}.deployment does not exactly match the verified merge`,
      )
    }
  }
  if (provenance.quarantine) {
    nonEmptyString(provenance.quarantine.reason, `${field}.quarantine.reason`)
    isoTimestamp(provenance.quarantine.detectedAt, `${field}.quarantine.detectedAt`)
    sha256(provenance.quarantine.diagnosticsSha256, `${field}.quarantine.diagnosticsSha256`)
  }
}

export function assertAdminIssueControllerState(
  value: unknown,
): asserts value is AdminIssueControllerState {
  assert(object(value), 'Controller state must be an object')
  assert(value.version === ADMIN_ISSUE_STATE_VERSION, `Unsupported controller state version ${value.version}`)
  isoTimestamp(value.baselineCompletedAt, 'state.baselineCompletedAt')
  isoTimestamp(value.updatedAt, 'state.updatedAt')
  stringArray(value.ignoredUids, 'state.ignoredUids')
  if (value.activeUid !== undefined) nonEmptyString(value.activeUid, 'state.activeUid')
  assert(object(value.issues), 'state.issues must be an object')
  for (const [uid, rawRecord] of Object.entries(value.issues)) {
    assert(object(rawRecord), `state.issues.${uid} must be an object`)
    assert(rawRecord.uid === uid, `state.issues.${uid}.uid must match its map key`)
    nonEmptyString(rawRecord.title, `state.issues.${uid}.title`)
    nonEmptyString(rawRecord.issueUrl, `state.issues.${uid}.issueUrl`)
    positiveInteger(rawRecord.issueNumber, `state.issues.${uid}.issueNumber`)
    positiveInteger(rawRecord.generation, `state.issues.${uid}.generation`)
    nonNegativeInteger(rawRecord.inputRevision, `state.issues.${uid}.inputRevision`)
    nonNegativeInteger(rawRecord.processedRevision, `state.issues.${uid}.processedRevision`)
    assert(
      Number(rawRecord.processedRevision) <= Number(rawRecord.inputRevision),
      `state.issues.${uid}.processedRevision exceeds inputRevision`,
    )
    assert(
      typeof rawRecord.phase === 'string' && ADMIN_ISSUE_PHASES.has(rawRecord.phase as AdminIssuePhase),
      `state.issues.${uid}.phase is invalid`,
    )
    assert(Array.isArray(rawRecord.inputs), `state.issues.${uid}.inputs must be an array`)
    for (const [inputIndex, input] of rawRecord.inputs.entries()) {
      assert(object(input), `state.issues.${uid}.inputs[${inputIndex}] must be an object`)
      if (input.attachments !== undefined) {
        assert(
          Array.isArray(input.attachments) && input.attachments.length <= 8,
          `state.issues.${uid}.inputs[${inputIndex}].attachments is invalid`,
        )
        input.attachments.forEach((attachment, attachmentIndex) =>
          assertInputAttachment(
            attachment,
            `state.issues.${uid}.inputs[${inputIndex}].attachments[${attachmentIndex}]`,
          ))
      }
    }
    assert(object(rawRecord.receipts), `state.issues.${uid}.receipts must be an object`)
    assert(
      Object.values(rawRecord.receipts).every((receipt) => typeof receipt === 'string'),
      `state.issues.${uid}.receipts must contain only strings`,
    )
    if (rawRecord.pr !== undefined) {
      assert(object(rawRecord.pr), `state.issues.${uid}.pr must be an object`)
      positiveInteger(rawRecord.pr.number, `state.issues.${uid}.pr.number`)
      nonEmptyString(rawRecord.pr.url, `state.issues.${uid}.pr.url`)
      assert(
        rawRecord.pr.headSha === undefined && rawRecord.pr.mergeSha === undefined,
        `state.issues.${uid}.pr cannot contain legacy authorization SHAs`,
      )
    }
    if (rawRecord.origin !== undefined) {
      assert(
        rawRecord.origin === 'github-automation',
        `state.issues.${uid}.origin is invalid`,
      )
    }
    if (rawRecord.automationKind !== undefined) {
      assert(
        rawRecord.origin === 'github-automation' &&
        ['deployment', 'layout'].includes(String(rawRecord.automationKind)),
        `state.issues.${uid}.automationKind is invalid`,
      )
    }
    if (rawRecord.sessionId !== undefined) {
      assert(
        typeof rawRecord.sessionId === 'string' &&
        /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(
          rawRecord.sessionId,
        ),
        `state.issues.${uid}.sessionId is invalid`,
      )
    }
    assertProvenance(rawRecord.provenance, `state.issues.${uid}.provenance`)
    if (object(rawRecord.provenance) && rawRecord.provenance.kind === 'active') {
      assert(
        rawRecord.provenance.generation === rawRecord.generation,
        `state.issues.${uid}.provenance generation does not match the issue`,
      )
    }
  }
}

export function migrateAdminIssueControllerState(
  value: unknown,
  migratedAt: string,
): AdminIssueControllerState {
  assert(object(value), 'Controller state must be an object')
  assert(value.version === 1, `Cannot migrate controller state version ${value.version}`)
  isoTimestamp(value.baselineCompletedAt, 'state.baselineCompletedAt')
  isoTimestamp(value.updatedAt, 'state.updatedAt')
  stringArray(value.ignoredUids, 'state.ignoredUids')
  assert(object(value.issues), 'state.issues must be an object')
  const migrated = JSON.parse(JSON.stringify(value)) as Record<string, unknown>
  const migratedIssues = migrated.issues as Record<string, Record<string, unknown>>
  for (const [uid, record] of Object.entries(migratedIssues)) {
    assert(object(record), `state.issues.${uid} must be an object`)
    assert(record.uid === uid, `state.issues.${uid}.uid must match its map key`)
    const legacyPr = object(record.pr) ? record.pr : undefined
    const observedBaseSha = typeof record.baseSha === 'string' && SHA_PATTERN.test(record.baseSha)
      ? record.baseSha
      : undefined
    const observedHeadSha = typeof legacyPr?.headSha === 'string' && SHA_PATTERN.test(legacyPr.headSha)
      ? legacyPr.headSha
      : undefined
    const observedMergeSha = typeof legacyPr?.mergeSha === 'string' && SHA_PATTERN.test(legacyPr.mergeSha)
      ? legacyPr.mergeSha
      : undefined
    const receipts = object(record.receipts) ? record.receipts : {}
    const hasAuthorizationReceipt = [
      'validatedAt',
      'validatedWorkerInput',
      'checksPassedAt',
      'mergedAt',
      'deployedAt',
    ].some((key) => typeof receipts[key] === 'string')
    const terminalOrPristine = record.phase === 'completed' || (
      record.phase === 'queued' &&
      record.branch === undefined &&
      record.worktreePath === undefined &&
      record.pr === undefined &&
      !hasAuthorizationReceipt
    )
    record.provenance = terminalOrPristine
      ? { kind: 'none' }
      : {
        kind: 'legacy-untrusted',
        migratedAt,
        reason: 'v1-missing-exact-provenance',
        ...(observedBaseSha ? { observedBaseSha } : {}),
        ...(observedHeadSha ? { observedHeadSha } : {}),
        ...(observedMergeSha ? { observedMergeSha } : {}),
      }
    delete record.baseSha
    if (legacyPr) {
      record.pr = {
        number: legacyPr.number,
        url: legacyPr.url,
      }
    }
  }
  migrated.version = ADMIN_ISSUE_STATE_VERSION
  migrated.updatedAt = migratedAt
  assertAdminIssueControllerState(migrated)
  return migrated
}

export function assertCandidateAuthorized(record: AdminIssueRecord, requireChecks = false) {
  assert(record.provenance.kind === 'active', 'Issue does not have active provenance')
  const provenance = record.provenance
  assert(provenance.generation === record.generation, 'Provenance generation does not match issue')
  assert(provenance.revision === record.processedRevision, 'Provenance revision does not match issue')
  assert(!provenance.transition, 'Issue has an unfinished head transition')
  assert(!provenance.quarantine, 'Issue provenance is quarantined')
  const candidate = provenance.candidate
  assert(candidate, 'Issue does not have a committed candidate')
  const diff = candidate.diff
  assert(diff.epoch === provenance.epoch, 'Candidate diff epoch does not match provenance')
  assert(diff.generation === provenance.generation, 'Candidate diff generation does not match provenance')
  assert(diff.revision === provenance.revision, 'Candidate diff revision does not match provenance')
  assert(diff.baseSha === candidate.targetBaseSha, 'Candidate diff base does not match target base')
  assert(diff.mergeBaseSha === candidate.targetBaseSha, 'Candidate merge base does not match target base')
  assert(diff.headSha === candidate.headSha, 'Candidate diff head does not match candidate')
  assert(diff.treeSha === candidate.treeSha, 'Candidate diff tree does not match candidate')
  const validation = candidate.validation
  assert(validation, 'Candidate has not passed trusted validation')
  assert(validation.epoch === provenance.epoch, 'Validation epoch does not match provenance')
  assert(validation.generation === provenance.generation, 'Validation generation does not match provenance')
  assert(validation.revision === provenance.revision, 'Validation revision does not match provenance')
  assert(validation.headSha === candidate.headSha, 'Validation head does not match candidate')
  assert(validation.treeSha === candidate.treeSha, 'Validation tree does not match candidate')
  assert(
    validation.diffManifestSha256 === diff.manifestSha256,
    'Validation diff does not match candidate diff',
  )
  if (requireChecks) {
    const checks = candidate.checks
    assert(checks, 'Candidate has not passed required checks')
    assert(checks.epoch === provenance.epoch, 'Checks epoch does not match provenance')
    assert(checks.generation === provenance.generation, 'Checks generation does not match provenance')
    assert(checks.revision === provenance.revision, 'Checks revision does not match provenance')
    assert(checks.headSha === candidate.headSha, 'Checks head does not match candidate')
  }
  return { candidate, provenance }
}

export function assertFinalizationAuthorized(record: AdminIssueRecord) {
  const { candidate, provenance } = assertCandidateAuthorized(record, true)
  assertCandidateVisualEvidence(record, true)
  assert(record.pr, 'Issue does not have a pull request')
  const merge = provenance.merge
  assert(merge, 'Issue does not have a verified merge')
  assert(merge.epoch === provenance.epoch, 'Merge epoch does not match provenance')
  assert(merge.generation === provenance.generation, 'Merge generation does not match provenance')
  assert(merge.revision === provenance.revision, 'Merge revision does not match provenance')
  assert(merge.prNumber === record.pr.number, 'Merge pull request does not match issue')
  assert(merge.candidateHeadSha === candidate.headSha, 'Merge candidate does not match provenance')
  assert(merge.baseSha === candidate.targetBaseSha, 'Merge base does not match candidate')
  const deployment = provenance.deployment
  assert(deployment, 'Issue does not have a verified deployment')
  assert(deployment.epoch === provenance.epoch, 'Deployment epoch does not match provenance')
  assert(deployment.generation === provenance.generation, 'Deployment generation does not match provenance')
  assert(deployment.revision === provenance.revision, 'Deployment revision does not match provenance')
  assert(deployment.mergeSha === merge.mergeSha, 'Deployment merge does not match verified merge')
  if (deployment.coverage === 'descendant') {
    assert(
      deployment.workflowHeadSha === deployment.sourceSha,
      'Descendant deployment source does not match workflow head',
    )
    assert(
      deployment.coverageVerifiedAt,
      'Descendant deployment is missing its ancestry verification time',
    )
  } else {
    assert(deployment.workflowHeadSha === merge.mergeSha, 'Deployment workflow head does not match merge')
    assert(deployment.sourceSha === merge.mergeSha, 'Deployment source does not match merge')
  }
  return { candidate, deployment, merge, provenance }
}

export function adminIssueMarker(uid: string) {
  return `<!-- ${ADMIN_ISSUE_MARKER_PREFIX}${uid} -->`
}

export function githubAutomationIssueUid(issueNumber: number) {
  return `github-issue-${issueNumber}`
}

export function githubAutomationIssueMarker(body: string | null | undefined) {
  if (!body) return undefined
  return GITHUB_AUTOMATION_ISSUE_MARKERS.find((prefix) =>
    body.includes(`<!-- ${prefix}`),
  )
}

export function controllerReceiptMarker(uid: string, receipt: string) {
  return `<!-- admin-issue-controller:${uid}:${receipt} -->`
}

export function todoFingerprint(summary: string, description = '') {
  return createHash('sha256')
    .update(`${summary.trim()}\0${description.trim()}`)
    .digest('hex')
}

export function issueTitle(summary: string) {
  const normalized = summary.trim().replace(/\s+/g, ' ')
  return (normalized || 'Admin To-Do item').slice(0, 240)
}

export function neutralizeGitHubClosingReferences(body: string) {
  return body.replace(
    /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+(?=(?:#\d+|https:\/\/github\.com\/))/gi,
    'Tracks ',
  )
}

export function issueBody(input: {
  attachments?: Array<{ alt: string; url: string }>
  description: string
  summary: string
  uid: string
}) {
  const description = input.description.trim()
  const attachments = input.attachments?.length
    ? `\n\n## Submitted images\n\n${input.attachments
      .map((attachment) => formatSubmittedImageMarkdown(attachment.alt, attachment.url))
      .join('\n\n')}`
    : ''
  return `${adminIssueMarker(input.uid)}

## Admin To-Do

${input.summary.trim()}
${description ? `\n\n${description}` : ''}${attachments}

_This issue is synchronized from the dashboard Admin To-Do list._
`
}

export function formatSubmittedImageMarkdown(alt: string, url: string) {
  assert(
    /^https:\/\/github\.com\/user-attachments\/assets\/[A-Za-z0-9-]+$/.test(url),
    'Submitted image URL is invalid',
  )
  const safeAlt = visualEvidenceMarkdownText(alt).replace(/[\\[\]]/g, '\\$&')
  return `![${safeAlt}](${url})`
}

export interface AdminTodoAttachmentManifestItem {
  id: string
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp'
  name: string
  sha256: string
  sizeBytes: number
}

export function parseAdminTodoAttachments(description = '') {
  const pattern = new RegExp(`<!--\\s*${ADMIN_TODO_ATTACHMENTS_PREFIX}([\\s\\S]*?)\\s*-->`, 'i')
  const match = description.match(pattern)
  if (!match) return { attachments: [] as AdminTodoAttachmentManifestItem[], description: description.trim() }
  let value: unknown
  try {
    value = JSON.parse(match[1])
  } catch (error) {
    throw new Error('Admin To-Do attachment manifest is invalid JSON', { cause: error })
  }
  assert(object(value) && value.version === 1, 'Admin To-Do attachment manifest version is invalid')
  assert(
    Array.isArray(value.attachments) && value.attachments.length > 0 && value.attachments.length <= 4,
    'Admin To-Do attachment manifest must contain one to four images',
  )
  const ids = new Set<string>()
  const attachments = value.attachments.map((entry, index) => {
    assert(object(entry), `Admin To-Do attachment ${index + 1} must be an object`)
    const id = nonEmptyString(entry.id, `Admin To-Do attachment ${index + 1}.id`)
    const name = nonEmptyString(entry.name, `Admin To-Do attachment ${index + 1}.name`).trim()
    const mediaType = nonEmptyString(
      entry.mediaType,
      `Admin To-Do attachment ${index + 1}.mediaType`,
    )
    assert(
      ['image/jpeg', 'image/png', 'image/webp'].includes(mediaType),
      `Admin To-Do attachment ${index + 1}.mediaType is invalid`,
    )
    assert(
      /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
        .test(id) &&
      !ids.has(id),
      `Admin To-Do attachment ${index + 1}.id is invalid`,
    )
    assert(name.length <= 240, `Admin To-Do attachment ${index + 1}.name is too long`)
    ids.add(id)
    return {
      id,
      mediaType: mediaType as AdminTodoAttachmentManifestItem['mediaType'],
      name,
      sha256: sha256(entry.sha256, `Admin To-Do attachment ${index + 1}.sha256`),
      sizeBytes: positiveInteger(
        entry.sizeBytes,
        `Admin To-Do attachment ${index + 1}.sizeBytes`,
      ),
    }
  })
  return {
    attachments,
    description: description.replace(pattern, '').trim(),
  }
}

export function sessionNameForIssue(issueNumber: number, uid: string) {
  return `admin-issue-${issueNumber}-${safeIdentifier(uid)}`.slice(0, 100)
}

export function branchNameForIssue(
  issueNumber: number,
  generation: number,
  summary: string,
) {
  const slug = safeIdentifier(summary.toLowerCase()).replace(/[_.]+/g, '-')
  return `copilot/admin-todo-${issueNumber}-g${generation}-${slug || 'fix'}`.slice(0, 120)
}

export function appendIssueInput(
  record: AdminIssueRecord,
  input: Omit<AdminIssueInput, 'revision'>,
) {
  if (record.inputs.some((candidate) => candidate.externalId === input.externalId)) {
    return false
  }
  const revision = record.inputRevision + 1
  record.inputs.push({ ...input, revision })
  record.inputRevision = revision
  record.updatedAt = input.createdAt
  return true
}

export function pendingIssueInputs(record: AdminIssueRecord) {
  return record.inputs.filter((input) => input.revision > record.processedRevision)
}

export function adminTodoCompletionRequired(record: AdminIssueRecord) {
  return record.origin !== 'github-automation'
}

export function baselineAdminIssueState(
  ignoredUids: string[],
  completedAt: string,
): AdminIssueControllerState {
  const normalizedUids = [...new Set(ignoredUids.map((uid) => uid.trim()).filter(Boolean))].sort()
  return {
    baselineCompletedAt: completedAt,
    ignoredUids: normalizedUids,
    issues: {},
    updatedAt: completedAt,
    version: ADMIN_ISSUE_STATE_VERSION,
  }
}

export function beginAdminIssueGeneration(record: AdminIssueRecord, updatedAt: string) {
  record.generation += 1
  record.branch = undefined
  record.worktreePath = undefined
  record.pr = undefined
  record.deployment = undefined
  record.provenance = { kind: 'none' }
  record.lastOutcome = undefined
  record.repairAttempts = 0
  record.phase = 'queued'
  record.updatedAt = updatedAt
  for (const receipt of [
    'awaitingIosVerificationAt',
    'checksPassedAt',
    'deployedAt',
    'deploymentRunUrl',
    'iosVerifiedAt',
    'mergedAt',
    'prOpenedAt',
    'validatedAt',
    'validatedWorkerInput',
  ]) {
    delete record.receipts[receipt]
  }
}

export function markIssueInputsProcessed(
  record: AdminIssueRecord,
  revision: number,
  processedAt: string,
) {
  assert(revision <= record.inputRevision, 'Processed revision exceeds the current input revision')
  assert(revision >= record.processedRevision, 'Processed revision cannot move backwards')
  for (const input of record.inputs) {
    if (input.revision <= revision && !input.processedAt) input.processedAt = processedAt
  }
  record.processedRevision = revision
  record.updatedAt = processedAt
}

export function isTrustedIssueComment(
  comment: GitHubIssueComment,
  ownerId: number,
  ownerLogin: string,
) {
  if (
    !comment.body?.trim() ||
    comment.body.includes(CONTROLLER_COMMENT_MARKER) ||
    comment.body.includes('<!-- admin-issue-controller:')
  ) {
    return false
  }
  return comment.user?.id === ownerId &&
    comment.user.login?.toLowerCase() === ownerLogin.toLowerCase() &&
    comment.author_association === 'OWNER'
}

export function parseWorkerOutcome(content: string): AdminIssueWorkerOutcome {
  const unfenced = content.trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
  const start = unfenced.indexOf('{')
  const end = unfenced.lastIndexOf('}')
  assert(start >= 0 && end > start, 'Worker response did not contain a JSON object')
  let value: unknown
  try {
    value = JSON.parse(unfenced.slice(start, end + 1))
  } catch (error) {
    throw new Error('Worker response contained invalid JSON', { cause: error })
  }
  assert(object(value), 'Worker outcome must be an object')
  assert(value.schemaVersion === 1, 'Worker outcome schemaVersion must be 1')
  assert(typeof value.summary === 'string' && value.summary.trim(), 'Worker outcome summary is required')
  const ios = iosFollowUp(value.iosFollowUp)

  if (value.decision === 'needs_input') {
    const visualEvidence = visualEvidenceDrafts(value.visualEvidence)
    assert(visualEvidence.length === 0, 'needs_input visualEvidence must be empty')
    assert(Array.isArray(value.questions) && value.questions.length > 0, 'needs_input requires questions')
    const questions = value.questions.map((entry, index) => {
      assert(object(entry), `questions[${index}] must be an object`)
      assert(typeof entry.question === 'string' && entry.question.trim(), `questions[${index}].question is required`)
      const options = stringArray(entry.options, `questions[${index}].options`)
      assert(options.length >= 2, `questions[${index}].options requires at least two choices`)
      const normalizedOptions = options.map((option) => option.trim()).filter(Boolean)
      assert(normalizedOptions.length >= 2, `questions[${index}].options requires at least two choices`)
      assert(
        entry.recommendation === undefined || typeof entry.recommendation === 'string',
        `questions[${index}].recommendation must be a string`,
      )
      return {
        question: entry.question.trim(),
        options: normalizedOptions,
        ...(typeof entry.recommendation === 'string'
          ? { recommendation: entry.recommendation.trim() }
          : {}),
      }
    })
    return {
      schemaVersion: 1,
      decision: 'needs_input',
      summary: value.summary.trim(),
      questions,
      iosFollowUp: ios,
      visualEvidence: [],
    }
  }

  if (value.decision === 'blocked') {
    const visualEvidence = visualEvidenceDrafts(value.visualEvidence)
    assert(visualEvidence.length === 0, 'blocked visualEvidence must be empty')
    assert(typeof value.reason === 'string' && value.reason.trim(), 'blocked requires a reason')
    return {
      schemaVersion: 1,
      decision: 'blocked',
      summary: value.summary.trim(),
      questions: [],
      reason: value.reason.trim(),
      iosFollowUp: ios,
      visualEvidence: [],
    }
  }

  if (value.decision === 'resolved_without_pr') {
    const visualEvidence = visualEvidenceDrafts(value.visualEvidence)
    assert(visualEvidence.length === 0, 'resolved_without_pr visualEvidence must be empty')
    assert(
      Array.isArray(value.questions) && value.questions.length === 0,
      'resolved_without_pr questions must be empty',
    )
    assert(
      value.resolutionType === 'home_assistant' ||
      value.resolutionType === 'no_repository_change',
      'resolved_without_pr resolutionType is invalid',
    )
    assert(
      typeof value.issueTitle === 'string' && value.issueTitle.trim(),
      'resolved_without_pr issueTitle is required',
    )
    assert(
      typeof value.resolution === 'string' && value.resolution.trim(),
      'resolved_without_pr resolution is required',
    )
    const verification = stringArray(value.verification, 'verification')
      .map((entry) => entry.trim())
      .filter(Boolean)
    assert(verification.length > 0, 'resolved_without_pr verification is required')
    return {
      schemaVersion: 1,
      decision: 'resolved_without_pr',
      summary: value.summary.trim(),
      questions: [],
      issueTitle: neutralizeGitHubClosingReferences(value.issueTitle.trim()).slice(0, 240),
      resolution: neutralizeGitHubClosingReferences(value.resolution.trim()),
      resolutionType: value.resolutionType,
      verification,
      iosFollowUp: ios,
      visualEvidence: [],
    }
  }

  assert(value.decision === 'ready_for_pr', 'Worker decision is unsupported')
  assert(Array.isArray(value.questions) && value.questions.length === 0, 'ready_for_pr questions must be empty')
  const changeSummary = stringArray(value.changeSummary, 'changeSummary')
  assert(changeSummary.length > 0, 'ready_for_pr requires changeSummary')
  const normalizedChangeSummary = changeSummary.map((entry) => entry.trim()).filter(Boolean)
  assert(normalizedChangeSummary.length > 0, 'ready_for_pr requires changeSummary')
  assert(Array.isArray(value.tests) && value.tests.length > 0, 'ready_for_pr requires tests')
  const tests = value.tests.map((entry, index) => {
    assert(object(entry), `tests[${index}] must be an object`)
    assert(typeof entry.command === 'string' && entry.command.trim(), `tests[${index}].command is required`)
    assert(entry.result === 'passed', `tests[${index}].result must be passed`)
    return { command: entry.command.trim(), result: entry.result.trim() }
  })
  assert(object(value.review), 'ready_for_pr requires review')
  assert(value.review.approved === true, 'Worker review must approve the change')
  const findings = stringArray(value.review.findings, 'review.findings')
  assert(object(value.pr), 'ready_for_pr requires pr')
  assert(typeof value.pr.title === 'string' && value.pr.title.trim(), 'pr.title is required')
  assert(typeof value.pr.body === 'string' && value.pr.body.trim(), 'pr.body is required')
  const visualEvidence = visualEvidenceDrafts(value.visualEvidence)
  const candidateVisualChange = value.visualChange === undefined
    ? {
      reason: 'Legacy worker outcome inferred from the supplied visual evidence.',
      required: visualEvidence.length > 0,
    }
    : visualChange(value.visualChange)
  if (candidateVisualChange.required) {
    assert(visualEvidence.length > 0, 'visualChange requires visualEvidence')
  }
  return {
    schemaVersion: 1,
    decision: 'ready_for_pr',
    summary: value.summary.trim(),
    questions: [],
    iosFollowUp: ios,
    changeSummary: normalizedChangeSummary,
    tests,
    review: {
      approved: true,
      findings: findings.map((entry) => entry.trim()).filter(Boolean),
    },
    pr: {
      title: neutralizeGitHubClosingReferences(value.pr.title.trim()).slice(0, 240),
      body: neutralizeGitHubClosingReferences(value.pr.body.trim()),
    },
    visualChange: candidateVisualChange,
    visualEvidence,
  }
}

function isTestOnlyPath(path: string) {
  return path.startsWith('src/test/') ||
    path.includes('/__tests__/') ||
    /\.(?:spec|test)\.[cm]?[jt]sx?$/.test(path)
}

function isInherentlyVisualPath(path: string) {
  return /\.(?:css|jpe?g|png|svg|webp|gif|avif|woff2?|ttf|otf)$/i.test(path)
}

export function candidateRequiresVisualEvidence(
  files: readonly string[],
  classification?: AdminIssueVisualChange,
) {
  if (classification) {
    return classification.required || files.some(isInherentlyVisualPath)
  }
  return files.some((path) =>
    path === 'index.html' ||
    path.startsWith('public/') ||
    (path.startsWith('src/') && !isTestOnlyPath(path)),
  )
}

export function assertCandidateVisualEvidence(
  record: AdminIssueRecord,
  requirePublished = false,
) {
  const { candidate, provenance } = assertCandidateAuthorized(record)
  const evidence = assertVisualEvidenceForCandidate(candidate, requirePublished)
  return { candidate, evidence, provenance }
}

export function assertVisualEvidenceForCandidate(
  candidate: AdminIssueCandidate,
  requirePublished = false,
) {
  const evidence = candidate.visualEvidence ?? []
  if (candidateRequiresVisualEvidence(candidate.diff.files, candidate.visualChange)) {
    assert(
      evidence.length > 0,
      'Candidate changes dashboard runtime files but has no proposed fixed-behavior images',
    )
  }
  assert(evidence.length <= 4, 'Candidate visual evidence exceeds the four-image limit')
  for (const [index, item] of evidence.entries()) {
    assert(
      item.diffManifestSha256 === candidate.diff.manifestSha256,
      `Candidate visual evidence ${index + 1} does not match the committed diff`,
    )
    if (requirePublished) {
      assert(
        typeof item.url === 'string' &&
        /^https:\/\/github\.com\/user-attachments\/assets\/[A-Za-z0-9-]+$/.test(item.url),
        `Candidate visual evidence ${index + 1} has not been published to GitHub`,
      )
    }
  }
  return evidence
}

function visualEvidenceMarkdownText(value: string) {
  return neutralizeGitHubClosingReferences(value)
    .replace(/[\r\n]+/g, ' ')
    .replace(/[<>]/g, '')
    .trim()
}

export function formatVisualEvidenceMarkdown(
  evidence: readonly AdminIssueVisualEvidenceReceipt[],
) {
  if (evidence.length === 0) return ''
  const images = evidence.map((item) => {
    assert(item.url, `Visual evidence has not been uploaded: ${item.path}`)
    const alt = visualEvidenceMarkdownText(item.alt).replace(/[\\[\]]/g, '\\$&')
    return `![${alt}](${item.url})\n\n_${visualEvidenceMarkdownText(item.caption)}_`
  })
  return ['## Proposed fixed behavior', ...images].join('\n\n')
}

export function formatQuestionsComment(
  uid: string,
  revision: number,
  outcome: Extract<AdminIssueWorkerOutcome, { decision: 'needs_input' }>,
) {
  const questions = outcome.questions.map((question, index) => {
    const options = question.options
      .map((option) => `  - ${option}`)
      .join('\n')
    const recommendation = question.recommendation
      ? `\n  - **Recommended:** ${question.recommendation}`
      : ''
    return `${index + 1}. **${question.question}**\n${options}${recommendation}`
  }).join('\n\n')
  const ios = outcome.iosFollowUp.required
    ? `\n\n> **iOS follow-up required:** ${outcome.iosFollowUp.reason}`
    : ''
  return `${CONTROLLER_COMMENT_MARKER}
${controllerReceiptMarker(uid, `questions-r${revision}`)}

## Decision needed

${outcome.summary}

${questions}${ios}

Reply in a new comment with your choices or any additional context.`
}

export function formatBlockedComment(
  uid: string,
  revision: number,
  outcome: Extract<AdminIssueWorkerOutcome, { decision: 'blocked' }>,
) {
  const ios = outcome.iosFollowUp.required
    ? `\n\n> **iOS follow-up required:** ${outcome.iosFollowUp.reason}`
    : ''
  return `${CONTROLLER_COMMENT_MARKER}
${controllerReceiptMarker(uid, `blocked-r${revision}`)}

## Automation blocked

${outcome.summary}

${outcome.reason}${ios}`
}

export function formatResolvedWithoutPrComment(
  uid: string,
  revision: number,
  outcome: Extract<AdminIssueWorkerOutcome, { decision: 'resolved_without_pr' }>,
) {
  const verification = outcome.verification.map((entry) => `- ${entry}`).join('\n')
  const resolutionType = outcome.resolutionType === 'home_assistant'
    ? 'Home Assistant'
    : 'No repository change'
  return `${CONTROLLER_COMMENT_MARKER}
${controllerReceiptMarker(uid, `resolved-without-pr-r${revision}`)}

## Resolved without a pull request

${outcome.summary}

**Resolution type:** ${resolutionType}

${outcome.resolution}

**Verification**
${verification}`
}

export function authorizedIosFollowUp(
  canonicalIssueText: string,
  candidateFiles: readonly string[],
  followUp: AdminIssueIosFollowUp,
) {
  if (!followUp.required) return followUp
  const explicitPlatformIssue =
    /\b(?:ios|safari|webkit|safe[- ]area|software keyboard|onscreen keyboard|on-screen keyboard)\b/i
      .test(canonicalIssueText)
  const deviceSpecificInterfaceIssue = (
    /\b(?:iphone|ipad)\b[\s\S]{0,160}\b(?:browser|screen|view|viewport|keyboard|orientation|touch|tap|scroll|focus|layout|modal|sheet|navigation|button)\b/i
      .test(canonicalIssueText) ||
    /\b(?:browser|screen|view|viewport|keyboard|orientation|touch|tap|scroll|focus|layout|modal|sheet|navigation|button)\b[\s\S]{0,160}\b(?:iphone|ipad)\b/i
      .test(canonicalIssueText)
  )
  const issueCallsOutIos = explicitPlatformIssue || deviceSpecificInterfaceIssue
  const reasonNamesPlatformBehavior = /\b(?:ios|safari|webkit|safe[- ]area|software keyboard|onscreen keyboard|on-screen keyboard|viewport|orientation|touch)\b/i
    .test(followUp.reason)
  const browserCandidate = candidateFiles.some((path) =>
    path === 'index.html' ||
    path.startsWith('public/') ||
    path.startsWith('src/') ||
    path.startsWith('e2e/'),
  )
  if (issueCallsOutIos && reasonNamesPlatformBehavior && browserCandidate) return followUp
  return { reason: '', required: false }
}

export function formatPullRequestComment(
  uid: string,
  revision: number,
  pullRequest: AdminIssuePullRequest,
  outcome: Extract<AdminIssueWorkerOutcome, { decision: 'ready_for_pr' }>,
  visualEvidence: readonly AdminIssueVisualEvidenceReceipt[] = [],
) {
  const changes = outcome.changeSummary.map((entry) => `- ${entry}`).join('\n')
  const tests = outcome.tests.map((entry) => `- \`${entry.command}\` — ${entry.result}`).join('\n')
  const evidence = visualEvidence.length > 0
    ? `\n\n${formatVisualEvidenceMarkdown(visualEvidence)}`
    : ''
  const ios = outcome.iosFollowUp.required
    ? `\n\n> **iOS follow-up required:** ${outcome.iosFollowUp.reason}`
    : ''
  return `${CONTROLLER_COMMENT_MARKER}
${controllerReceiptMarker(uid, `pr-r${revision}`)}

## Pull request opened

${outcome.summary}

**Changes**
${changes}

**Validation**
${tests}

**Pull request:** ${pullRequest.url}${evidence}${ios}`
}

export function formatCompletionComment(input: {
  deployment: Required<Pick<AdminIssueDeployment, 'deployedSha' | 'disposition' | 'runId' | 'url'>>
  issue: AdminIssueRecord
}) {
  const outcome = input.issue.lastOutcome
  assert(outcome?.decision === 'ready_for_pr', 'Completion requires a ready_for_pr outcome')
  const { merge } = assertFinalizationAuthorized(input.issue)
  const changes = outcome.changeSummary.map((entry) => `- ${entry}`).join('\n')
  const tests = outcome.tests.map((entry) => `- \`${entry.command}\` — ${entry.result}`).join('\n')
  const evidenceCount = outcome.visualEvidence?.length ?? 0
  const evidence = evidenceCount > 0
    ? `\n**Proposed fixed behavior:** ${evidenceCount} GitHub-hosted image${evidenceCount === 1 ? '' : 's'} in the pull request`
    : ''
  const ios = outcome.iosFollowUp.required
    ? `\n\n> **Manual iOS follow-up:** ${outcome.iosFollowUp.reason}`
    : ''
  return `${CONTROLLER_COMMENT_MARKER}
${controllerReceiptMarker(input.issue.uid, 'completed')}

## Fixed and deployed

${outcome.summary}

**What changed**
${changes}

**Validation**
${tests}

**Pull request:** ${input.issue.pr?.url}
**Merged commit:** \`${merge.mergeSha}\`
**Deployment:** ${input.deployment.url}
**Production result:** ${input.deployment.disposition} at \`${input.deployment.deployedSha}\`${evidence}${ios}`
}

export function deploymentReceiptIsAccepted(
  receipt: Record<string, unknown>,
  sourceSha: string,
  expectedRun?: { id: number; runAttempt: number },
) {
  const disposition = receipt.disposition
  const rawVerifiedPaths = receipt.verifiedPaths
  const verifiedPaths = Array.isArray(rawVerifiedPaths)
    ? rawVerifiedPaths.filter((path): path is string => typeof path === 'string')
    : []
  return receipt.version === 2 &&
    receipt.status === 'success' &&
    receipt.sourceSha === sourceSha &&
    typeof receipt.deployedSha === 'string' &&
    /^[a-f0-9]{40}$/.test(receipt.deployedSha) &&
    typeof receipt.deployedAt === 'string' &&
    !Number.isNaN(Date.parse(receipt.deployedAt)) &&
    typeof receipt.manifestHash === 'string' &&
    /^[a-f0-9]{64}$/.test(receipt.manifestHash) &&
    typeof receipt.deploymentHash === 'string' &&
    /^[a-f0-9]{64}$/.test(receipt.deploymentHash) &&
    ['forward', 'already-current', 'superseded'].includes(String(disposition)) &&
    receipt.panelRegistered === true &&
    receipt.leaseReleased === true &&
    Array.isArray(rawVerifiedPaths) &&
    verifiedPaths.length === rawVerifiedPaths.length &&
    REQUIRED_DEPLOYMENT_VERIFIED_PATHS.every((path) => verifiedPaths.includes(path)) &&
    (
      expectedRun === undefined ||
      (String(receipt.runId) === String(expectedRun.id) &&
        receipt.runAttempt === expectedRun.runAttempt)
    )
}

export function safeIdentifier(value: string) {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9_.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}
