import { createHash } from 'node:crypto'

export const ADMIN_ISSUE_MARKER_PREFIX = 'admin-todo-uid:'
export const CONTROLLER_COMMENT_MARKER = '<!-- admin-issue-controller -->'
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
  | 'completed'
  | 'paused'
  | 'blocked'

export type AdminIssueInputSource =
  | 'todo-created'
  | 'todo-updated'
  | 'issue-comment'
  | 'ci-failure'

export interface AdminIssueInput {
  body: string
  createdAt: string
  externalId: string
  processedAt?: string
  revision: number
  source: AdminIssueInputSource
}

export interface AdminIssuePullRequest {
  headSha: string
  mergeSha?: string
  number: number
  url: string
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
  baseSha?: string
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
  pr?: AdminIssuePullRequest
  processedRevision: number
  repairAttempts: number
  receipts: Record<string, string>
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
  version: 1
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

export interface AdminIssueReview {
  approved: boolean
  findings: string[]
}

export interface AdminIssuePullRequestDraft {
  body: string
  title: string
}

export type AdminIssueWorkerOutcome =
  | {
    decision: 'needs_input'
    iosFollowUp: AdminIssueIosFollowUp
    questions: AdminIssueQuestion[]
    schemaVersion: 1
    summary: string
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
  }
  | {
    decision: 'blocked'
    iosFollowUp: AdminIssueIosFollowUp
    questions: []
    reason: string
    schemaVersion: 1
    summary: string
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

export function adminIssueMarker(uid: string) {
  return `<!-- ${ADMIN_ISSUE_MARKER_PREFIX}${uid} -->`
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
  description: string
  summary: string
  uid: string
}) {
  const description = input.description.trim()
  return `${adminIssueMarker(input.uid)}

## Admin To-Do

${input.summary.trim()}
${description ? `\n\n${description}` : ''}

_This issue is synchronized from the dashboard Admin To-Do list._
`
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
    version: 1,
  }
}

export function beginAdminIssueGeneration(record: AdminIssueRecord, updatedAt: string) {
  record.generation += 1
  record.branch = undefined
  record.worktreePath = undefined
  record.baseSha = undefined
  record.pr = undefined
  record.lastOutcome = undefined
  record.repairAttempts = 0
  record.phase = 'queued'
  record.updatedAt = updatedAt
  delete record.receipts.awaitingIosVerificationAt
  delete record.receipts.iosVerifiedAt
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
    }
  }

  if (value.decision === 'blocked') {
    assert(typeof value.reason === 'string' && value.reason.trim(), 'blocked requires a reason')
    return {
      schemaVersion: 1,
      decision: 'blocked',
      summary: value.summary.trim(),
      questions: [],
      reason: value.reason.trim(),
      iosFollowUp: ios,
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
  }
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

export function formatPullRequestComment(
  uid: string,
  revision: number,
  pullRequest: AdminIssuePullRequest,
  outcome: Extract<AdminIssueWorkerOutcome, { decision: 'ready_for_pr' }>,
) {
  const changes = outcome.changeSummary.map((entry) => `- ${entry}`).join('\n')
  const tests = outcome.tests.map((entry) => `- \`${entry.command}\` — ${entry.result}`).join('\n')
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

**Pull request:** ${pullRequest.url}${ios}`
}

export function formatCompletionComment(input: {
  deployment: Required<Pick<AdminIssueDeployment, 'deployedSha' | 'disposition' | 'runId' | 'url'>>
  issue: AdminIssueRecord
}) {
  const outcome = input.issue.lastOutcome
  assert(outcome?.decision === 'ready_for_pr', 'Completion requires a ready_for_pr outcome')
  const changes = outcome.changeSummary.map((entry) => `- ${entry}`).join('\n')
  const tests = outcome.tests.map((entry) => `- \`${entry.command}\` — ${entry.result}`).join('\n')
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
**Merged commit:** \`${input.issue.pr?.mergeSha ?? input.issue.pr?.headSha}\`
**Deployment:** ${input.deployment.url}
**Production result:** ${input.deployment.disposition} at \`${input.deployment.deployedSha}\`${ios}`
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
