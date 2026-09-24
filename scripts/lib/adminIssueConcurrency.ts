import type { AdminIssueControllerState, AdminIssueRecord, AdminIssueWorkerClaim } from './adminIssueController'

export const MAX_ISSUE_WORKERS = 10

export async function withTodoIntakeFailure<T>(
  item: T,
  operation: () => Promise<void>,
  onFailure: (item: T, error: unknown) => Promise<void>,
) {
  try {
    await operation()
  } catch (error) {
    await onFailure(item, error)
  }
}

export class AsyncSerial {
  private tail: Promise<void> = Promise.resolve()

  async run<T>(operation: () => Promise<T>): Promise<T> {
    const previous = this.tail
    let release!: () => void
    this.tail = new Promise<void>((resolve) => { release = resolve })
    await previous
    try {
      return await operation()
    } finally {
      release()
    }
  }
}

export class AdminIssueWorkerPool {
  private readonly running = new Map<string, Promise<void>>()
  private fatalError?: Error

  constructor(
    readonly limit: number,
    private readonly onWorkerError: (uid: string, error: unknown) => Promise<void>,
  ) {
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_ISSUE_WORKERS) {
      throw new Error(`Worker limit must be between 1 and ${MAX_ISSUE_WORKERS}`)
    }
  }

  get size() {
    return this.running.size
  }

  has(uid: string) {
    return this.running.has(uid)
  }

  start(uid: string, operation: () => Promise<void>) {
    if (!uid.trim()) throw new Error('Worker UID is required')
    if (this.running.has(uid) || this.running.size >= this.limit) return false
    const task = Promise.resolve()
      .then(operation)
      .catch((error: unknown) => this.onWorkerError(uid, error))
      .catch((error: unknown) => {
        this.fatalError = new Error(`Worker ${uid} error handling failed`, { cause: error })
      })
      .finally(() => { this.running.delete(uid) })
    this.running.set(uid, task)
    return true
  }

  assertHealthy() {
    if (this.fatalError) throw this.fatalError
  }

  async waitForIdle() {
    await Promise.all([...this.running.values()])
    this.assertHealthy()
  }
}

export function issueRequiresCompletionRepair(record: AdminIssueRecord) {
  return record.inputRevision > record.processedRevision &&
    [
      'issueClosedAt',
      'issueCloseAttemptAt',
      'todoCompletionAttemptAt',
      'todoCompletionRaceAt',
      'todoCompletedAt',
      'todoSourceDriftAt',
    ].some((key) => Boolean(record.receipts[key]))
}

export function pendingIssueWorkers(
  state: Pick<AdminIssueControllerState, 'issues'>,
  pool: Pick<AdminIssueWorkerPool, 'has'>,
  currentTime = Date.now(),
) {
  return Object.values(state.issues)
    .filter((record) =>
      ['queued', 'researching', 'implementing'].includes(record.phase) &&
      record.inputRevision > record.processedRevision &&
      record.provenance.kind !== 'legacy-untrusted' &&
      !(record.provenance.kind === 'active' &&
        (record.provenance.quarantine || record.provenance.transition)) &&
      !record.workerClaim &&
      !record.releaseClaim &&
      !issueRequiresCompletionRepair(record) &&
      !pool.has(record.uid))
    .filter((record) => {
      const retryAt = record.receipts.workerRetryAfter
      if (!retryAt) return true
      const time = Date.parse(retryAt)
      if (Number.isNaN(time)) throw new Error(`Issue ${record.uid} has an invalid worker retry time`)
      return time <= currentTime
    })
    .sort((left, right) => left.inputs[0].createdAt.localeCompare(right.inputs[0].createdAt))
}

export function completionRepairRecords(
  state: Pick<AdminIssueControllerState, 'issues'>,
  pool: Pick<AdminIssueWorkerPool, 'has'>,
) {
  return Object.values(state.issues)
    .filter((record) =>
      issueRequiresCompletionRepair(record) &&
      record.provenance.kind !== 'legacy-untrusted' &&
      !(record.provenance.kind === 'active' &&
        (record.provenance.quarantine || record.provenance.transition)) &&
      !record.workerClaim &&
      !record.releaseClaim &&
      !pool.has(record.uid))
    .sort((left, right) => left.inputs[0].createdAt.localeCompare(right.inputs[0].createdAt))
}

export function guardedIssueRecords(
  state: Pick<AdminIssueControllerState, 'issues'>,
  pool: Pick<AdminIssueWorkerPool, 'has'>,
) {
  return Object.values(state.issues)
    .filter((record) =>
      ['queued', 'researching', 'implementing'].includes(record.phase) &&
      !record.workerClaim &&
      !record.releaseClaim &&
      !pool.has(record.uid) &&
      (record.provenance.kind === 'legacy-untrusted' ||
        (record.provenance.kind === 'active' &&
          Boolean(record.provenance.quarantine || record.provenance.transition))))
    .sort((left, right) => left.inputs[0].createdAt.localeCompare(right.inputs[0].createdAt))
}

export async function runIssueIntakeCycle(
  state: Pick<AdminIssueControllerState, 'issues'>,
  pool: AdminIssueWorkerPool,
  reconcileInputs: () => Promise<void>,
  runWorker: (record: AdminIssueRecord) => Promise<void>,
  currentTime = Date.now(),
) {
  await reconcileInputs()
  let admitted = 0
  for (const record of pendingIssueWorkers(state, pool, currentTime)) {
    if (!pool.start(record.uid, () => runWorker(record))) break
    admitted += 1
  }
  return admitted
}

export async function runParallelSupervisorTick(
  state: Pick<AdminIssueControllerState, 'issues'>,
  workers: AdminIssueWorkerPool,
  release: AdminIssueWorkerPool,
  diagnostics: AdminIssueWorkerPool,
  reconcileInputs: () => Promise<void>,
  runWorker: (record: AdminIssueRecord) => Promise<void>,
  runRelease: () => Promise<void>,
  runDiagnostics: () => Promise<void>,
) {
  const admitted = await runIssueIntakeCycle(state, workers, reconcileInputs, runWorker)
  const releaseStarted = release.start('protected-release', runRelease)
  const diagnosticStarted = diagnostics.start('workflow-evidence', runDiagnostics)
  return { admitted, releaseStarted, diagnosticStarted }
}

export function recoverInterruptedIssueWorkers(
  state: Pick<AdminIssueControllerState, 'issues'>,
  recoveredAt: string,
) {
  let recovered = 0
  for (const record of Object.values(state.issues)) {
    if (record.workerClaim) {
      record.receipts.workerInterruptedAt = recoveredAt
      record.receipts.workerInterruptedClaimId = record.workerClaim.id
      delete record.workerClaim
      if (['researching', 'implementing'].includes(record.phase) &&
        record.inputRevision > record.processedRevision) {
        record.phase = 'queued'
      }
      recovered += 1
    }
    if (record.releaseClaim) {
      record.receipts.releaseInterruptedAt = recoveredAt
      record.receipts.releaseInterruptedClaimId = record.releaseClaim.id
      delete record.releaseClaim
      recovered += 1
    }
  }
  return recovered
}

export function beginIssueWorkerClaim(
  record: AdminIssueRecord,
  id: string,
  startedAt: string,
): AdminIssueWorkerClaim {
  if (record.workerClaim || record.releaseClaim) {
    throw new Error(`Issue ${record.uid} already has an active worker or release`)
  }
  const claim: AdminIssueWorkerClaim = {
    generation: record.generation,
    id,
    inputRevision: record.inputRevision,
    startedAt,
  }
  record.workerClaim = claim
  record.phase = 'researching'
  record.updatedAt = startedAt
  return claim
}

export function finishIssueWorkerClaim(record: AdminIssueRecord, claim: AdminIssueWorkerClaim) {
  if (record.workerClaim?.id !== claim.id) {
    throw new Error(`Issue ${record.uid} worker claim changed during execution`)
  }
  delete record.workerClaim
}

export function beginIssueReleaseClaim(
  record: AdminIssueRecord,
  id: string,
  startedAt: string,
): AdminIssueWorkerClaim {
  if (record.workerClaim || record.releaseClaim) {
    throw new Error(`Issue ${record.uid} already has an active worker or release`)
  }
  const claim: AdminIssueWorkerClaim = {
    generation: record.generation,
    id,
    inputRevision: record.inputRevision,
    startedAt,
  }
  record.releaseClaim = claim
  return claim
}

export function finishIssueReleaseClaim(record: AdminIssueRecord, claim: AdminIssueWorkerClaim) {
  if (record.releaseClaim?.id !== claim.id) {
    throw new Error(`Issue ${record.uid} release claim changed during execution`)
  }
  delete record.releaseClaim
}

export async function withIssueReleaseClaim<T>(
  record: AdminIssueRecord,
  id: string,
  startedAt: string,
  persist: () => void,
  operation: () => Promise<T>,
): Promise<T> {
  const claim = beginIssueReleaseClaim(record, id, startedAt)
  try {
    persist()
    return await operation()
  } finally {
    finishIssueReleaseClaim(record, claim)
    persist()
  }
}
