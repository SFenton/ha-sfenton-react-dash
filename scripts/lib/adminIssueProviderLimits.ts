import type { AdminIssueControllerState, AdminIssueRecord } from './adminIssueController'

export type WorkerProviderLimitKind = 'quota' | 'rate_limit'

export interface WorkerProviderLimit {
  kind: WorkerProviderLimitKind
  retryAt?: string
  statusCode?: number
  errorCode?: string
}

export type WorkerProvider = 'copilot' | 'claude'

/** Providers in preference order: Claude Code is the fallback when Copilot is limited. */
export const WORKER_PROVIDERS: readonly WorkerProvider[] = ['copilot', 'claude']

export function workerProviderLimitReceipts(provider: WorkerProvider) {
  const prefix = provider === 'copilot' ? 'workerCopilotLimit' : 'workerClaudeLimit'
  return {
    count: `${prefix}Count`,
    kind: `${prefix}Kind`,
    retryAt: `${prefix}RetryAt`,
  } as const
}

const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS
const MIN_PROVIDER_DELAY_MS = MINUTE_MS
const MAX_PROVIDER_DELAY_MS = 8 * 24 * HOUR_MS

export class AdminIssueProviderLimitError extends Error {
  readonly provider: WorkerProvider
  readonly limit: WorkerProviderLimit

  constructor(provider: WorkerProvider, limit: WorkerProviderLimit) {
    super(
      `${provider === 'copilot' ? 'Copilot CLI' : 'Claude Code'} worker reported a ` +
      `${limit.kind === 'quota' ? 'usage quota' : 'rate'} limit`,
    )
    this.name = 'AdminIssueProviderLimitError'
    this.provider = provider
    this.limit = limit
  }
}

function events(output: string) {
  const parsed: Array<Record<string, unknown>> = []
  for (const line of output.split(/\r?\n/)) {
    if (!line.trim().startsWith('{')) continue
    try {
      const value = JSON.parse(line) as unknown
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        parsed.push(value as Record<string, unknown>)
      }
    } catch {
      // CLI diagnostics may appear beside JSON stream events.
    }
  }
  return parsed
}

function record(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

function finitePositive(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined
}

/**
 * Detects a model-provider usage or rate limit from structured CLI stream
 * events only. Free text is ignored so a worker discussing an unrelated API's
 * rate limit cannot defer itself.
 */
export function detectWorkerProviderLimit(
  output: string,
  currentTime = Date.now(),
): WorkerProviderLimit | undefined {
  let detected: WorkerProviderLimit | undefined
  for (const event of events(output)) {
    const data = record(event.data)
    if (event.type === 'session.error' && data &&
      (data.errorType === 'quota' || data.errorType === 'rate_limit')) {
      const retryAfterSeconds = finitePositive(data.retryAfterSeconds)
      detected = {
        kind: data.errorType,
        ...(typeof data.statusCode === 'number' ? { statusCode: data.statusCode } : {}),
        ...(typeof data.errorCode === 'string' && /^[A-Za-z0-9_.:-]{1,80}$/.test(data.errorCode)
          ? { errorCode: data.errorCode }
          : {}),
        ...(retryAfterSeconds
          ? { retryAt: new Date(currentTime + retryAfterSeconds * 1000).toISOString() }
          : {}),
      }
      continue
    }
    // Claude Code fallback stream-json rate-limit events.
    const info = record(event.rate_limit_info)
    if (event.type === 'rate_limit_event' && info?.status === 'rejected') {
      const resetsAt = finitePositive(info.resetsAt)
      detected = {
        kind: 'quota',
        ...(resetsAt ? { retryAt: new Date(resetsAt * 1000).toISOString() } : {}),
      }
    }
  }
  return detected
}

export function workerProviderLimitRetryAt(
  limit: WorkerProviderLimit,
  attempt: number,
  currentTime = Date.now(),
) {
  const exponent = Math.max(0, Math.min(10, Math.floor(attempt) - 1))
  const fallback = limit.kind === 'quota'
    ? Math.min(24 * HOUR_MS, HOUR_MS * 2 ** exponent)
    : Math.min(HOUR_MS, 5 * MINUTE_MS * 2 ** exponent)
  const requested = limit.retryAt ? Date.parse(limit.retryAt) - currentTime : Number.NaN
  const delay = Number.isFinite(requested) ? requested : fallback
  return new Date(
    currentTime + Math.min(MAX_PROVIDER_DELAY_MS, Math.max(MIN_PROVIDER_DELAY_MS, delay)),
  ).toISOString()
}

/** A provider limit is account-wide, so one record pauses that provider for every worker. */
export function workerProviderPauseUntil(
  state: Pick<AdminIssueControllerState, 'issues'>,
  provider: WorkerProvider,
) {
  const receipt = workerProviderLimitReceipts(provider).retryAt
  let until = 0
  for (const issue of Object.values(state.issues)) {
    const retryAt = issue.receipts[receipt]
    if (!retryAt) continue
    const time = Date.parse(retryAt)
    if (Number.isNaN(time)) {
      throw new Error(`Issue ${issue.uid} has an invalid ${provider} limit retry time`)
    }
    until = Math.max(until, time)
  }
  return until
}

/** Returns when the earliest provider becomes usable again, or 0 if one is usable now. */
export function workerProvidersPausedUntil(
  state: Pick<AdminIssueControllerState, 'issues'>,
  currentTime = Date.now(),
) {
  const pauses = WORKER_PROVIDERS.map((provider) => workerProviderPauseUntil(state, provider))
  return pauses.some((until) => until <= currentTime) ? 0 : Math.min(...pauses)
}

export function recordWorkerProviderLimit(
  record: Pick<AdminIssueRecord, 'receipts'>,
  provider: WorkerProvider,
  limit: WorkerProviderLimit,
  currentTime = Date.now(),
) {
  const receipts = workerProviderLimitReceipts(provider)
  const attempt = Number(record.receipts[receipts.count] ?? '0') + 1
  const retryAt = workerProviderLimitRetryAt(limit, attempt, currentTime)
  record.receipts[receipts.count] = String(attempt)
  record.receipts[receipts.kind] = limit.kind
  record.receipts[receipts.retryAt] = retryAt
  return retryAt
}

/**
 * Requeues an issue whose worker could not reach a usable provider without
 * consuming a repair attempt. The worker records each provider limit as it is
 * hit; this only schedules the retry for when the earliest provider resets, or
 * for the limited provider when the other one is unusable for another reason.
 */
export function deferWorkerForProviderLimit(
  state: Pick<AdminIssueControllerState, 'issues'>,
  record: Pick<AdminIssueRecord, 'phase' | 'receipts'>,
  error: AdminIssueProviderLimitError,
  currentTime = Date.now(),
) {
  const pausedUntil = workerProvidersPausedUntil(state, currentTime)
  const providerUntil = workerProviderPauseUntil(state, error.provider)
  const until = pausedUntil > currentTime
    ? pausedUntil
    : providerUntil > currentTime
      ? providerUntil
      : Date.parse(workerProviderLimitRetryAt(error.limit, 1, currentTime))
  const retryAt = new Date(until).toISOString()
  if (record.phase === 'researching') record.phase = 'queued'
  record.receipts.workerRetryAfter = retryAt
  return retryAt
}

export function clearWorkerProviderLimit(
  record: Pick<AdminIssueRecord, 'receipts'>,
  provider: WorkerProvider,
) {
  for (const receipt of Object.values(workerProviderLimitReceipts(provider))) {
    delete record.receipts[receipt]
  }
}
