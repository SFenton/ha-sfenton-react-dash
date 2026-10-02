import {
  CONTROLLER_COMMENT_MARKER,
  controllerReceiptMarker,
  type AdminIssueDeployEvent,
  type AdminIssuePhase,
  type AdminIssueTriage,
} from './adminIssueController'

export interface AdminIssueLabelDefinition {
  color: string
  description: string
  name: string
}

export const STATUS_LABELS: Record<AdminIssuePhase, AdminIssueLabelDefinition> = {
  queued: {
    name: 'status:queued',
    color: 'd4c5f9',
    description: 'Awaiting controller work',
  },
  researching: {
    name: 'status:researching',
    color: 'bfd4f2',
    description: 'Worker is investigating',
  },
  implementing: {
    name: 'status:implementing',
    color: '0e8a16',
    description: 'Worker is implementing',
  },
  'awaiting-user': {
    name: 'status:awaiting-user',
    color: 'fbca04',
    description: 'Awaiting owner input',
  },
  'ready-for-pr': {
    name: 'status:ready-for-pr',
    color: 'c2e0c6',
    description: 'Candidate is ready for a pull request',
  },
  'pull-request': {
    name: 'status:pull-request',
    color: '5319e7',
    description: 'Pull request is under validation',
  },
  deploying: {
    name: 'status:deploying',
    color: '1d76db',
    description: 'Merged change is awaiting deployment',
  },
  resolving: {
    name: 'status:resolving',
    color: '006b75',
    description: 'Verified no-pull-request resolution is closing',
  },
  completed: {
    name: 'status:completed',
    color: '0e8a16',
    description: 'Controller lifecycle completed',
  },
  paused: {
    name: 'status:paused',
    color: 'ededed',
    description: 'Controller work is paused',
  },
  blocked: {
    name: 'status:blocked',
    color: 'b60205',
    description: 'Controller is blocked on evidence or a guard',
  },
}

export const TYPE_LABELS: Record<AdminIssueTriage['kind'], AdminIssueLabelDefinition> = {
  bug: { name: 'type:bug', color: 'd73a4a', description: 'Defect or regression' },
  feature: { name: 'type:feature', color: 'a2eeef', description: 'New capability or enhancement' },
  task: { name: 'type:task', color: '0075ca', description: 'Maintenance or operational task' },
  research: { name: 'type:research', color: '7057ff', description: 'Investigation or discovery work' },
}

export const AREA_LABEL_COLOR = 'cfd3d7'
export const MANAGED_LABEL_PREFIXES = ['status:', 'type:', 'area:'] as const

export function desiredStatusLabel(phase: AdminIssuePhase) {
  return STATUS_LABELS[phase].name
}

export function desiredManagedLabels(
  phase: AdminIssuePhase,
  triage?: AdminIssueTriage,
) {
  return [
    desiredStatusLabel(phase),
    ...(triage ? [TYPE_LABELS[triage.kind].name, ...triage.areas.map((area) => `area:${area}`)] : []),
  ].sort()
}

export function areaLabel(area: string): AdminIssueLabelDefinition {
  return {
    name: `area:${area}`,
    color: AREA_LABEL_COLOR,
    description: `Controller triage area: ${area}`,
  }
}

export function managedLabelDefinitions(
  phase: AdminIssuePhase,
  triage?: AdminIssueTriage,
) {
  return [
    STATUS_LABELS[phase],
    ...(triage ? [TYPE_LABELS[triage.kind], ...triage.areas.map(areaLabel)] : []),
  ]
}

export function planLabelChanges(
  currentLabels: readonly string[],
  desired: readonly string[],
  managedPrefixes: readonly string[] = MANAGED_LABEL_PREFIXES,
) {
  const current = new Set(currentLabels)
  const wanted = new Set(desired)
  const managed = (label: string) => managedPrefixes.some((prefix) => label.startsWith(prefix))
  return {
    add: [...wanted].filter((label) => !current.has(label)).sort(),
    remove: [...current].filter((label) => managed(label) && !wanted.has(label)).sort(),
  }
}

export const DEPLOY_EVENT_REASON_LIMIT = 1_000

// Persisted state rejects empty or oversized reasons, and command errors can be
// far longer, so every event is normalized before it is journaled.
export function normalizeDeployEventReason(reason: string) {
  const trimmed = reason.replace(/\s+/g, ' ').trim() || 'No reason reported'
  if (trimmed.length <= DEPLOY_EVENT_REASON_LIMIT) return trimmed
  const suffix = '…'
  return trimmed.slice(0, DEPLOY_EVENT_REASON_LIMIT - suffix.length) + suffix
}

export function appendDeployEvent(
  history: readonly AdminIssueDeployEvent[] | undefined,
  input: AdminIssueDeployEvent,
  max = 20,
) {
  const event = { ...input, reason: normalizeDeployEventReason(input.reason) }
  const previous = history ?? []
  const last = previous.at(-1)
  const sameAsLast = last !== undefined &&
    last.decision === event.decision &&
    last.reason === event.reason &&
    last.fromSha === event.fromSha &&
    last.toSha === event.toSha &&
    last.runId === event.runId &&
    last.url === event.url
  if (sameAsLast) return [...previous]
  return [...previous, event].slice(-max)
}

export function formatTriageComment(uid: string, triage: AdminIssueTriage) {
  const areas = triage.areas.length > 0 ? triage.areas.map((area) => `\`${area}\``).join(', ') : 'None'
  const acceptance = triage.acceptance.map((item) => `- [ ] ${item}`).join('\n')
  const media = triage.mediaReviewed?.length
    ? triage.mediaReviewed.map((item) => `- ${item}`).join('\n')
    : 'None'
  return `${CONTROLLER_COMMENT_MARKER}
${controllerReceiptMarker(uid, 'triage')}

## Triage

**Kind:** \`${triage.kind}\`
**Areas:** ${areas}
**Confidence:** ${(triage.confidence * 100).toFixed(0)}%

${triage.summary}

**Acceptance**
${acceptance}

**Media reviewed**
${media}`
}

function humanPhase(phase: AdminIssuePhase) {
  return phase.replaceAll('-', ' ')
}

function formatDeployEvent(event: AdminIssueDeployEvent) {
  const run = event.url
    ? `[run #${event.runId ?? 'details'}](${event.url})`
    : event.runId
      ? `run #${event.runId}`
      : undefined
  const sha = event.toSha ?? event.fromSha
  return [
    `- **${event.decision.replaceAll('_', ' ')}:** ${event.reason}`,
    sha ? `\`${sha}\`` : '',
    run ?? '',
    `(${event.at})`,
  ].filter(Boolean).join(' — ')
}

export interface AdminIssueProgressRecord {
  deployHistory?: AdminIssueDeployEvent[]
  phase: AdminIssuePhase
  pr?: { number?: number; url: string }
  provenance: { kind: string; merge?: { mergeSha: string } }
  receipts: Record<string, string>
  repairAttempts: number
  uid: string
  updatedAt: string
  workerRuns: number
}

export function formatProgressComment(record: AdminIssueProgressRecord) {
  const provider = record.receipts.lastWorkerProvider ?? 'not run'
  const merge = record.provenance.kind === 'active' ? record.provenance.merge?.mergeSha : undefined
  const pullRequestState = merge ? 'merged' : record.pr ? 'open' : 'not opened'
  const pullRequest = record.pr ? `${record.pr.url} (${pullRequestState})` : pullRequestState
  const deployment = record.deployHistory?.slice(-5).map(formatDeployEvent).join('\n') || '- No deployment events'
  return `${CONTROLLER_COMMENT_MARKER}
${controllerReceiptMarker(record.uid, 'progress')}

## Controller progress

**Phase:** ${humanPhase(record.phase)}
**Last worker provider:** ${provider}
**Worker runs:** ${record.workerRuns}
**Repair attempts:** ${record.repairAttempts}
**Pull request:** ${pullRequest}
**Merged commit:** ${merge ? `\`${merge}\`` : 'Not merged'}

**Recent deployments**
${deployment}

**Updated:** ${record.updatedAt}`
}

export interface AdminIssueMetadataScope {
  labels: boolean
  progress: boolean
}

// Records finished or parked before metadata sync existed are left alone so
// the rollout does not relabel history or notify on every dormant issue.
export const LABEL_RECHECK_MS = 60 * 60 * 1000

// Labels are re-read when the desired set changes or the last remote check is
// stale, so manual drift is repaired without a GitHub read on every poll.
export function labelSyncDue(
  receipts: Record<string, string>,
  desiredKey: string,
  nowMs: number,
) {
  if (receipts.syncedLabels !== desiredKey) return true
  const checkedAt = Date.parse(receipts.syncedLabelsAt ?? '')
  return !Number.isFinite(checkedAt) || nowMs - checkedAt >= LABEL_RECHECK_MS
}

export function issueMetadataScope(
  record: { phase: AdminIssuePhase; receipts: Record<string, string> },
): AdminIssueMetadataScope {
  const labelled = record.receipts.syncedLabels !== undefined
  const reported = record.receipts.progressCommentHash !== undefined
  return {
    labels: record.phase !== 'completed' || labelled,
    progress: !['completed', 'paused'].includes(record.phase) || reported,
  }
}
