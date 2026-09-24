// @covers scripts/admin-issue-controller.ts
// @covers scripts/lib/adminIssueController.ts
// @covers scripts/lib/adminIssueConcurrency.ts
// @covers ops/admin-issue-controller/worker-extension.mjs
// @covers ops/admin-issue-controller/controller.json.example
// @covers ops/admin-issue-controller/admin-issue-controller.service
// @covers ops/admin-issue-controller/tandem-research/SKILL.md
// @covers package.json
// @covers .gitignore

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  statSync,
  truncateSync,
  writeFileSync,
} from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  AdminIssueDeploymentRunError,
  AdminIssueNewInputError,
  AdminIssueProvenanceError,
  AdminIssueTodoSourceDriftError,
  AdminIssueWorkerDeferredError,
  assertDeploymentRunSucceeded,
  assertDeploymentCoversMergeSha,
  assertCandidateReleaseCurrent,
  assertExactCandidateSnapshot,
  assertFrontendOnlyRecovery,
  assertPausedCandidateUnchanged,
  assertExistingReleasePullRequestEvidence,
  assertExistingReleaseVerificationSnapshot,
  assertSuccessfulLayoutWorkflowRun,
  assertResolvedWithoutPullRequestSnapshot,
  assertSuccessfulRequiredChecksForHead,
  assertIssueCommentBodyContainsVisualEvidence,
  assertFreshFinalizationInputs,
  assertNoNewInputsBeforeClose,
  assertResearchOnlyOutcome,
  assertWorkerHostConfigurationSafe,
  assertWorkerClaimCanStart,
  assertWorkerChangesSafe,
  assertPullRequestBinding,
  assertPullRequestContainsVisualEvidence,
  buildCopilotWorkerArgs,
  buildInitialInput,
  buildWorkerPrompt,
  canonicalWorkerIssueBody,
  classifyPullRequestHead,
  closeIssueWithReceipt,
  completeAdminTodoGuarded,
  collectVisualEvidenceReceipts,
  commitIsAncestor,
  controllerClosedIssueDisposition,
  createCommittedDiffReceipt,
  deploymentRecoveryDue,
  ensureRunnerTrustRotation,
  existingReleaseRecoveryDue,
  findExactMergeCommit,
  frontendRecoveryObservationDue,
  handleLateOwnerInput,
  isolatedWorkerConfig,
  githubRepositoryFromRemote,
  hasRecoverableDeployment,
  hasRecoverableExistingRelease,
  hasRecoverableTransition,
  issueBodyMediaPlan,
  isControllerOwnedCloseWindow,
  latestSuccessfulDeploymentRunPath,
  layoutWorkflowRunsPath,
  layoutEvidenceRequeueAllowed,
  loadAdminIssueControllerConfig,
  loadAdminIssueControllerState,
  materializeWorkerInputAttachments,
  mediaInputRequired,
  mediaSourceExternalId,
  markFrontendOnlyRecoveryObserved,
  prepareCommittedCandidate,
  prepareCopilotHome,
  prepareGitHubMediaInput,
  prepareReopenedMedia,
  publishPullRequestIssueComment,
  pullRequestBodyWithVisualEvidence,
  pushCandidate,
  queueVerifiedLayoutEvidence,
  queueReopenedMediaInputs,
  reconcileClosedIssueRecord,
  readWorktreeSnapshot,
  researchOnlyRequested,
  restoreReadyOutcomeFromWorkerLog,
  runCommand,
  selectWorkerHassMcpConfig,
  selectWorkerSessionCandidate,
  shouldRetryWorkerSessionWithoutName,
  shouldVerifyExistingPullRequestVisualEvidence,
  summarizeFailedCheckLogs,
  synchronizeCandidateBase,
  unreviewableIssueMedia,
  waitForMergedPullRequest,
  workerInputAttachments,
  workerMediaAttachmentArgs,
  workerHassPermissionArgs,
  workerInputSnapshot,
  updateWorkflowDigestConfig,
  workerMutableInfrastructurePaths,
  workflowDigestRotationRequired,
} from './admin-issue-controller'
import {
  CONTROLLER_COMMENT_MARKER,
  adminTodoCompletionRequired,
  adminIssueMarker,
  appendIssueInput,
  authorizedIosFollowUp,
  assertAdminIssueControllerState,
  assertCandidateAuthorized,
  assertCandidateVisualEvidence,
  assertFinalizationAuthorized,
  assertLayoutFinalizationAuthorized,
  baselineAdminIssueState,
  beginAdminIssueGeneration,
  branchNameForIssue,
  candidateRequiresVisualEvidence,
  canonicalIssueTextForIos,
  clearTodoIntakeReceipts,
  confirmTodoAttachmentUpload,
  controllerReceiptMarker,
  deploymentReceiptIsAccepted,
  formatBlockedComment,
  formatCompletionComment,
  formatLayoutCompletionComment,
  formatPullRequestComment,
  formatQuestionsComment,
  formatResolvedWithoutPrComment,
  formatSubmittedImageMarkdown,
  formatVisualEvidenceMarkdown,
  isTrustedIssueComment,
  githubAutomationIssueMarker,
  githubAutomationIssueUid,
  issueBody,
  issueTitle,
  markIssueInputsProcessed,
  migrateAdminIssueControllerState,
  neutralizeGitHubClosingReferences,
  parseAdminTodoAttachments,
  parseWorkerOutcome,
  pendingIssueInputs,
  recordTodoIntakeFailure,
  retainTodoAttachmentUploads,
  reserveTodoAttachmentUpload,
  reauthorizePersistedIosFollowUp,
  REQUIRED_DEPLOYMENT_VERIFIED_PATHS,
  sessionNameForIssue,
  todoIntakeKey,
  todoFingerprint,
  type AdminIssueRecord,
  type AdminIssueControllerState,
  type AdminIssueDiffReceipt,
  type AdminIssueValidationReceipt,
} from './lib/adminIssueController'
import { discoverEmbeddedGitHubMedia } from './lib/adminIssueMedia'
import {
  AdminIssueWorkerPool,
  AsyncSerial,
  beginIssueReleaseClaim,
  beginIssueWorkerClaim,
  completionRepairRecords,
  finishIssueReleaseClaim,
  finishIssueWorkerClaim,
  guardedIssueRecords,
  pendingIssueWorkers,
  recoverInterruptedIssueWorkers,
  runParallelSupervisorTick,
  withTodoIntakeFailure,
  withIssueReleaseClaim,
} from './lib/adminIssueConcurrency'
import type { EvidenceWorkflowRun } from './lib/adminIssueWorkflowEvidence'

const temporaryDirectories: string[] = []

afterEach(() => {
  for (const path of temporaryDirectories.splice(0)) {
    rmSync(path, { force: true, recursive: true })
  }
})

function record(): AdminIssueRecord {
  return {
    commentCursor: 0,
    createdAt: '2026-09-20T12:00:00.000Z',
    description: 'The final content gap does not match the navigation gap.',
    generation: 1,
    inputRevision: 1,
    inputs: [
      {
        body: 'The final content gap does not match the navigation gap.',
        createdAt: '2026-09-20T12:00:00.000Z',
        externalId: 'todo:one',
        revision: 1,
        source: 'todo-created',
      },
    ],
    issueNumber: 321,
    issueUrl: 'https://github.com/SFenton/ha-sfenton-react-dash/issues/321',
    phase: 'queued',
    processedRevision: 0,
    provenance: { kind: 'none' },
    receipts: {},
    repairAttempts: 0,
    sessionName: 'admin-issue-321-task-1',
    taskFingerprint: 'fingerprint',
    title: 'Fix terminal page spacing',
    uid: 'task-1',
    updatedAt: '2026-09-20T12:00:00.000Z',
    workerRuns: 0,
  }
}

function awaitingLayoutEvidence(): AdminIssueRecord {
  const issue = record()
  issue.origin = 'github-automation'
  issue.automationKind = 'layout'
  issue.phase = 'awaiting-user'
  issue.processedRevision = issue.inputRevision
  issue.inputs[0].source = 'github-issue'
  issue.lastOutcome = {
    decision: 'needs_input',
    iosFollowUp: { reason: '', required: false },
    questions: [{
      options: ['Failed-step log and layout-artifact summary', 'Neither is retrievable'],
      question: 'Which original failure evidence can be attached for run 123?',
    }],
    schemaVersion: 1,
    summary: 'Original CI evidence is unavailable to the worker.',
    visualEvidence: [],
  }
  return issue
}

describe('bounded issue worker admission', () => {
  it('keeps later todo intake running after a failed item but propagates a failed receipt', async () => {
    const attempted: string[] = []
    const failures: string[] = []
    for (const uid of ['unavailable', 'available']) {
      await withTodoIntakeFailure(uid, async () => {
        attempted.push(uid)
        if (uid === 'unavailable') throw new Error('attachment lookup failed')
      }, async (item) => { failures.push(item) })
    }
    expect(attempted).toEqual(['unavailable', 'available'])
    expect(failures).toEqual(['unavailable'])
    await expect(withTodoIntakeFailure('unavailable', async () => {
      throw new Error('attachment lookup failed')
    }, async () => {
      throw new Error('intake receipt could not be persisted')
    })).rejects.toThrow('receipt could not be persisted')
  })

  it('runs exactly ten distinct UIDs while an eleventh waits and intake still proceeds', async () => {
    const resolvers: Array<() => void> = []
    const releaseResolvers: Array<() => void> = []
    const diagnosticResolvers: Array<() => void> = []
    const failures: string[] = []
    const pool = new AdminIssueWorkerPool(10, async (uid) => { failures.push(uid) })
    const release = new AdminIssueWorkerPool(1, async (uid) => { failures.push(uid) })
    const diagnostics = new AdminIssueWorkerPool(1, async (uid) => { failures.push(uid) })
    const intake = new AsyncSerial()
    const records = Array.from({ length: 11 }, (_, index) => {
      const issue = record()
      issue.uid = `task-${index + 1}`
      issue.issueNumber = index + 1
      return issue
    })
    const state = { issues: Object.fromEntries(records.map((issue) => [issue.uid, issue])) }
    let intakePolls = 0
    const reconcile = async () => await intake.run(async () => { intakePolls += 1 })
    const runWorker = async () =>
      await new Promise<void>((resolve) => { resolvers.push(resolve) })
    const runRelease = async () =>
      await new Promise<void>((resolve) => { releaseResolvers.push(resolve) })
    const runDiagnostics = async () =>
      await new Promise<void>((resolve) => { diagnosticResolvers.push(resolve) })
    expect(await runParallelSupervisorTick(
      state, pool, release, diagnostics, reconcile, runWorker, runRelease, runDiagnostics,
    )).toEqual({ admitted: 10, releaseStarted: true, diagnosticStarted: true })
    await Promise.resolve()
    expect(pool.size).toBe(10)
    expect(resolvers).toHaveLength(10)
    expect(release.size).toBe(1)
    expect(releaseResolvers).toHaveLength(1)
    expect(diagnostics.size).toBe(1)
    expect(diagnosticResolvers).toHaveLength(1)
    expect(pool.start(records[0].uid, async () => { throw new Error('duplicate') })).toBe(false)
    expect(pool.start(records[10].uid, async () => { throw new Error('over limit') })).toBe(false)
    expect(await runParallelSupervisorTick(
      state, pool, release, diagnostics, reconcile, runWorker, runRelease, runDiagnostics,
    )).toEqual({ admitted: 0, releaseStarted: false, diagnosticStarted: false })
    expect(intakePolls).toBe(2)
    expect(releaseResolvers).toHaveLength(1)
    expect(diagnosticResolvers).toHaveLength(1)
    resolvers[0]()
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
    expect(pool.size).toBe(9)
    records[0].phase = 'awaiting-user'
    records[0].processedRevision = records[0].inputRevision
    expect(pendingIssueWorkers(state, pool).map((issue) => issue.uid)).toEqual([records[10].uid])
    expect(await runParallelSupervisorTick(
      state, pool, release, diagnostics, reconcile, runWorker, runRelease, runDiagnostics,
    )).toEqual({ admitted: 1, releaseStarted: false, diagnosticStarted: false })
    await Promise.resolve()
    expect(pool.size).toBe(10)
    for (const resolve of resolvers.slice(1)) resolve()
    releaseResolvers[0]()
    diagnosticResolvers[0]()
    await pool.waitForIdle()
    await release.waitForIdle()
    await diagnostics.waitForIdle()
    expect(failures).toEqual([])
  })

  it('journals a new image issue while ten workers, release and diagnostics are busy', async () => {
    const state = baselineAdminIssueState([], '2026-09-24T16:00:00.000Z')
    for (let index = 0; index < 10; index += 1) {
      const issue = record()
      issue.uid = `occupied-${index}`
      issue.issueNumber = index + 1
      state.issues[issue.uid] = issue
    }
    const workers = new AdminIssueWorkerPool(10, async () => {})
    const release = new AdminIssueWorkerPool(1, async () => {})
    const diagnostics = new AdminIssueWorkerPool(1, async () => {})
    const waiting: Array<() => void> = []
    let finishBackground!: () => void
    const background = new Promise<void>((resolve) => { finishBackground = resolve })
    let polls = 0
    const uid = 'new-camera-report'
    const attachment = {
      id: '11111111-1111-4111-8111-111111111111',
      localPath: '/private/image-input/11111111-1111-4111-8111-111111111111.png',
      mediaType: 'image/png' as const,
      name: 'camera.png',
      sha256: 'a'.repeat(64),
      sizeBytes: 2_241_798,
    }
    const asset = 'https://github.com/user-attachments/assets/11111111-1111-1111-1111-111111111111'
    const reconcile = async () => {
      polls += 1
      if (polls !== 2) return
      reserveTodoAttachmentUpload(state, uid, attachment, '2026-09-24T16:01:00.000Z')
      confirmTodoAttachmentUpload(state, uid, attachment.id, asset)
      const issue = record()
      issue.uid = uid
      issue.issueNumber = 337
      issue.inputs[0].attachments = [{ ...attachment, githubUrl: asset }]
      state.issues[uid] = issue
      clearTodoIntakeReceipts(state, uid)
    }
    const runWorker = async () =>
      await new Promise<void>((resolve) => { waiting.push(resolve) })
    await runParallelSupervisorTick(
      state, workers, release, diagnostics, reconcile, runWorker,
      async () => await background, async () => await background,
    )
    await Promise.resolve()
    expect(workers.size).toBe(10)
    expect((await runParallelSupervisorTick(
      state, workers, release, diagnostics, reconcile, runWorker,
      async () => await background, async () => await background,
    )).admitted).toBe(0)
    expect(state.issues[uid].inputs[0].attachments?.[0]).toMatchObject({
      githubUrl: asset,
      sha256: attachment.sha256,
      sizeBytes: attachment.sizeBytes,
    })
    expect(() => assertAdminIssueControllerState(state)).not.toThrow()
    for (const done of waiting) done()
    finishBackground()
    await Promise.all([workers.waitForIdle(), release.waitForIdle(), diagnostics.waitForIdle()])
  })

  it('serializes overlapping intake callbacks so they cannot publish the same UID twice', async () => {
    const serial = new AsyncSerial()
    const order: string[] = []
    let resume!: () => void
    const first = serial.run(async () => {
      order.push('first started')
      await new Promise<void>((resolve) => { resume = resolve })
      order.push('first finished')
    })
    const second = serial.run(async () => { order.push('second started') })
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
    expect(order).toEqual(['first started'])
    resume()
    await Promise.all([first, second])
    expect(order).toEqual(['first started', 'first finished', 'second started'])
  })

  it('releases failed slots and surfaces a failed worker error handler', async () => {
    const failures: string[] = []
    const pool = new AdminIssueWorkerPool(2, async (uid) => { failures.push(uid) })
    expect(pool.start('one', async () => { throw new Error('worker failed') })).toBe(true)
    await pool.waitForIdle()
    expect(failures).toEqual(['one'])
    expect(pool.size).toBe(0)
    const fatal = new AdminIssueWorkerPool(1, async () => { throw new Error('journal failed') })
    expect(fatal.start('two', async () => { throw new Error('worker failed') })).toBe(true)
    await expect(fatal.waitForIdle()).rejects.toThrow('error handling failed')
    expect(() => new AdminIssueWorkerPool(11, async () => {})).toThrow('between 1 and 10')
  })

  it('fences worker generation and revision while input changes remain pending', () => {
    const issue = record()
    const claim = beginIssueWorkerClaim(issue, 'claim-1', '2026-09-24T16:00:00.000Z')
    const snapshot = workerInputSnapshot(issue, claim.inputRevision)
    expect(() => assertWorkerClaimCanStart(issue, claim)).not.toThrow()
    expect(() => beginIssueWorkerClaim(issue, 'claim-2', '2026-09-24T16:00:01.000Z'))
      .toThrow('already has an active worker')
    appendIssueInput(issue, {
      body: 'New owner feedback',
      createdAt: '2026-09-24T16:00:02.000Z',
      externalId: 'comment:999',
      source: 'issue-comment',
    })
    issue.phase = 'queued'
    expect(() => assertWorkerClaimCanStart(issue, claim))
      .toThrow(AdminIssueWorkerDeferredError)

    expect(snapshot.inputs).toHaveLength(1)
    expect(buildWorkerPrompt(snapshot)).not.toContain('New owner feedback')
    markIssueInputsProcessed(issue, claim.inputRevision, '2026-09-24T16:01:00.000Z')
    expect(issue.processedRevision).toBe(1)
    expect(issue.inputRevision).toBe(2)
    expect(() => finishIssueWorkerClaim(issue, { ...claim, id: 'wrong-claim' }))
      .toThrow('claim changed')
    finishIssueWorkerClaim(issue, claim)
    expect(issue.workerClaim).toBeUndefined()
    expect(issue.inputRevision).toBeGreaterThan(issue.processedRevision)
    issue.provenance = {
      kind: 'legacy-untrusted',
      migratedAt: '2026-09-24T16:01:00.000Z',
      reason: 'v1-missing-exact-provenance',
    }
    const laterClaim = beginIssueWorkerClaim(issue, 'claim-3', '2026-09-24T16:02:00.000Z')
    expect(() => assertWorkerClaimCanStart(issue, laterClaim))
      .toThrow('provenance changed')
  })

  it('never closes a resolved issue with owner input received during an asynchronous release', () => {
    const issue = record()
    expect(() => assertNoNewInputsBeforeClose(issue)).toThrow('cannot be closed')
    markIssueInputsProcessed(issue, issue.inputRevision, '2026-09-24T16:00:00.000Z')
    expect(() => assertNoNewInputsBeforeClose(issue)).not.toThrow()
    appendIssueInput(issue, {
      body: 'A correction arrived while checks completed',
      createdAt: '2026-09-24T16:01:00.000Z',
      externalId: 'comment:late',
      source: 'issue-comment',
    })
    expect(() => assertNoNewInputsBeforeClose(issue)).toThrow('cannot be closed')
    expect(() => assertNoNewInputsBeforeClose(issue)).toThrow(AdminIssueNewInputError)
  })

  it('reopens a controller-closed issue for late input without completing stale HA work', async () => {
    const issue = record()
    markIssueInputsProcessed(issue, issue.inputRevision, '2026-09-24T16:00:00.000Z')
    appendIssueInput(issue, {
      body: 'Owner correction during finalization',
      createdAt: '2026-09-24T16:01:00.000Z',
      externalId: 'comment:late-finalization',
      source: 'issue-comment',
    })
    issue.phase = 'resolving'
    let reopened = 0
    let generations = 0
    let persisted = 0
    const actions = {
      persist: () => { persisted += 1 },
      reopenIssue: async () => { reopened += 1 },
      startNewGeneration: async () => {
        generations += 1
        beginAdminIssueGeneration(issue, '2026-09-24T16:02:00.000Z')
      },
    }
    await handleLateOwnerInput(issue, actions)
    expect({ reopened, generations, phase: issue.phase }).toEqual({
      reopened: 0, generations: 0, phase: 'queued',
    })
    expect(issue.inputRevision).toBeGreaterThan(issue.processedRevision)
    issue.phase = 'resolving'
    issue.receipts.issueClosedAt = '2026-09-24T16:02:00.000Z'
    await handleLateOwnerInput(issue, actions)
    expect({ reopened, generations, phase: issue.phase }).toEqual({
      reopened: 1, generations: 1, phase: 'queued',
    })
    expect(issue.receipts.issueClosedAt).toBeUndefined()
    expect(issue.receipts.todoCompletedAt).toBeUndefined()
    expect(issue.generation).toBe(2)
    expect(persisted).toBe(3)

    const merged = record()
    authorizeRecord(merged)
    if (merged.provenance.kind !== 'active') throw new Error('Expected active candidate')
    delete merged.provenance.deployment
    appendIssueInput(merged, {
      body: 'Owner correction before exact deployment',
      createdAt: '2026-09-24T16:03:00.000Z',
      externalId: 'comment:deployment-follow-up',
      source: 'issue-comment',
    })
    merged.phase = 'deploying'
    await handleLateOwnerInput(merged, {
      ...actions,
      startNewGeneration: async () => { throw new Error('Unverified release cannot advance generation') },
    })
    expect(merged.phase).toBe('deploying')
    expect(merged.inputRevision).toBeGreaterThan(merged.processedRevision)
  })

  it('routes interrupted HA completion to release repair rather than starting a new worker', () => {
    const issue = record()
    const state = baselineAdminIssueState([], '2026-09-24T16:00:00.000Z')
    state.issues[issue.uid] = issue
    markIssueInputsProcessed(issue, issue.inputRevision, '2026-09-24T16:00:00.000Z')
    appendIssueInput(issue, {
      body: 'New owner instructions during HA completion',
      createdAt: '2026-09-24T16:01:00.000Z',
      externalId: 'comment:ha-completion-race',
      source: 'issue-comment',
    })
    issue.phase = 'queued'
    issue.receipts.todoCompletionAttemptAt = '2026-09-24T16:00:30.000Z'
    const workers = new AdminIssueWorkerPool(10, async () => {})
    expect(pendingIssueWorkers(state, workers)).toEqual([])
    expect(completionRepairRecords(state, workers)).toEqual([issue])
    delete issue.receipts.todoCompletionAttemptAt
    expect(completionRepairRecords(state, workers)).toEqual([])
    expect(pendingIssueWorkers(state, workers)).toEqual([issue])
  })

  it('recovers a controller-owned close interrupted before its journal receipt', async () => {
    const issue = record()
    authorizeRecord(issue)
    issue.phase = 'blocked'
    issue.branch = 'copilot/admin-todo-321-g1'
    issue.worktreePath = '/private/issue-321-g1'
    issue.workerRuns = 2
    issue.receipts.controllerBlockedReason =
      'No-PR resolution cannot retain candidate, pull-request, merge, or deployment state'
    const marker = controllerReceiptMarker(
      issue.uid, `existing-release-r${issue.processedRevision}`,
    )
    let saved: AdminIssueRecord | undefined
    let writes = 0
    let closed = false
    await expect(closeIssueWithReceipt(
      issue,
      () => {
        writes += 1
        if (writes === 1) saved = structuredClone(issue)
        else throw new Error('Crash after GitHub accepted the close request')
      },
      async () => { closed = true },
    )).rejects.toThrow('Crash after GitHub accepted')
    if (!saved) throw new Error('Missing pre-close journal snapshot')
    expect(closed).toBe(true)
    expect(saved.receipts.issueCloseAttemptAt).toBeDefined()
    const comments = [{ body: marker }]
    expect(isControllerOwnedCloseWindow(saved, 'closed')).toBe(true)
    expect(controllerClosedIssueDisposition(saved, comments)).toBe('existing-release')
    reconcileClosedIssueRecord(saved, 'existing-release', '2026-09-24T16:04:00.000Z')
    expect(saved.phase).toBe('blocked')
    expect(saved.receipts.issueClosedAt).toBeDefined()
    expect(saved.receipts.manuallyClosedAt).toBeUndefined()
    expect(hasRecoverableExistingRelease(saved)).toBe(true)
    const ownerComment = {
      author_association: 'OWNER',
      body: 'New owner context while completion is pending',
      id: 900,
      user: { id: 3988463, login: 'SFenton' },
    }
    expect(isTrustedIssueComment(ownerComment, 3988463, 'SFenton')).toBe(true)
    if (isControllerOwnedCloseWindow(saved, 'closed')) {
      appendIssueInput(saved, {
        body: ownerComment.body,
        createdAt: '2026-09-24T16:04:01.000Z',
        externalId: 'comment:closed-window',
        source: 'issue-comment',
      })
    }
    expect(saved.inputRevision).toBeGreaterThan(saved.processedRevision)
    const staleMarker = structuredClone(saved)
    delete staleMarker.receipts.issueClosedAt
    expect(controllerClosedIssueDisposition(staleMarker, comments)).toBe('existing-release')
    expect(isControllerOwnedCloseWindow(staleMarker, 'closed')).toBe(false)
    const manual = record()
    expect(isControllerOwnedCloseWindow(manual, 'closed')).toBe(false)
    reconcileClosedIssueRecord(manual, 'manual', '2026-09-24T16:04:00.000Z')
    expect(manual.phase).toBe('paused')
    await expect(assertFreshFinalizationInputs(manual, async () => {}))
      .rejects.toThrow('manually closed')
  })

  it('reopens HA when owner input arrives while the completion service is in flight', async () => {
    const issue = record()
    markIssueInputsProcessed(issue, issue.inputRevision, '2026-09-24T16:00:00.000Z')
    issue.taskFingerprint = todoFingerprint(issue.title, '')
    const config = {
      completionReceiptEntityId: 'input_text.admin_todo_completion_receipt',
      completionScript: 'script.complete_admin_todo_item',
      todoEntityId: 'todo.groceries',
    }
    let status = 'needs_action'
    let receipt = 'none'
    let beginCompletion!: () => void
    const completionStarted = new Promise<void>((resolve) => { beginCompletion = resolve })
    let finishCompletion!: () => void
    let reopenCount = 0
    let writes = 0
    const client = {
      getItems: async () => [{ uid: issue.uid, summary: issue.title, status }],
      getState: async () => ({ entity_id: config.completionReceiptEntityId, state: receipt }),
      completeItem: async () => {
        beginCompletion()
        await new Promise<void>((resolve) => { finishCompletion = resolve })
        status = 'completed'
        receipt = issue.uid
      },
      reopenItem: async () => {
        reopenCount += 1
        status = 'needs_action'
      },
    }
    const completion = completeAdminTodoGuarded(
      config, client, issue, () => { writes += 1 }, async () => {},
    )
    await completionStarted
    appendIssueInput(issue, {
      body: 'Follow-up while HA completion was pending',
      createdAt: '2026-09-24T16:01:00.000Z',
      externalId: 'todo:late-edit',
      source: 'todo-updated',
    })
    finishCompletion()
    await expect(completion).rejects.toThrow(AdminIssueNewInputError)
    expect(status).toBe('needs_action')
    expect(reopenCount).toBe(1)
    expect(writes).toBeGreaterThanOrEqual(2)
    expect(issue.receipts.todoReopenedAt).toBeDefined()
    expect(issue.receipts.todoCompletedAt).toBeUndefined()
    expect(issue.inputRevision).toBeGreaterThan(issue.processedRevision)
  })

  it('reopens an image-edited HA item changed during the deferred completion service', async () => {
    const issue = record()
    markIssueInputsProcessed(issue, issue.inputRevision, '2026-09-24T16:00:00.000Z')
    let description = 'Original task details'
    issue.taskFingerprint = todoFingerprint(issue.title, description)
    let status = 'needs_action'
    let receipt = 'none'
    let reopens = 0
    let beginCompletion!: () => void
    const completionStarted = new Promise<void>((resolve) => { beginCompletion = resolve })
    let finishCompletion!: () => void
    const config = {
      completionReceiptEntityId: 'input_text.admin_todo_completion_receipt',
      completionScript: 'script.complete_admin_todo_item',
      todoEntityId: 'todo.groceries',
    }
    const client = {
      getItems: async () => [{ uid: issue.uid, summary: issue.title, description, status }],
      getState: async () => ({ entity_id: config.completionReceiptEntityId, state: receipt }),
      completeItem: async () => {
        beginCompletion()
        await new Promise<void>((resolve) => { finishCompletion = resolve })
        status = 'completed'
        receipt = issue.uid
      },
      reopenItem: async () => {
        reopens += 1
        status = 'needs_action'
      },
    }
    const completion = completeAdminTodoGuarded(
      config, client, issue, () => {}, async () => {},
    )
    await completionStarted
    description = 'Original task details\n\nNew image: camera-after.png'
    finishCompletion()
    await expect(completion)
      .rejects.toThrow(AdminIssueTodoSourceDriftError)
    expect(reopens).toBe(1)
    expect(status).toBe('needs_action')
    expect(issue.inputRevision).toBe(issue.processedRevision)
    expect(issue.receipts.todoSourceDriftAt).toBeDefined()
    expect(issue.receipts.todoCompletedAt).toBeUndefined()
    await expect(assertFreshFinalizationInputs(issue, async () => {}))
      .rejects.toThrow(AdminIssueTodoSourceDriftError)
  })

  it('refreshes a trusted closed-issue image comment during HA completion without a polling tick', async () => {
    const issue = record()
    markIssueInputsProcessed(issue, issue.inputRevision, '2026-09-24T16:00:00.000Z')
    issue.taskFingerprint = todoFingerprint(issue.title, '')
    issue.receipts.issueClosedAt = '2026-09-24T16:01:00.000Z'
    const config = {
      completionReceiptEntityId: 'input_text.admin_todo_completion_receipt',
      completionScript: 'script.complete_admin_todo_item',
      todoEntityId: 'todo.groceries',
    }
    let status = 'needs_action'
    let receipt = 'none'
    let beginCompletion!: () => void
    const completionStarted = new Promise<void>((resolve) => { beginCompletion = resolve })
    let finishCompletion!: () => void
    let reopens = 0
    let refreshes = 0
    const comments: Array<{
      author_association: 'OWNER'
      body: string
      id: number
      user: { id: number; login: string }
    }> = []
    const reconcileInputs = async () => {
      refreshes += 1
      if (!isControllerOwnedCloseWindow(issue, 'closed')) return
      for (const comment of comments) {
        if (!isTrustedIssueComment(comment, 3988463, 'SFenton')) continue
        appendIssueInput(issue, {
          body: comment.body,
          createdAt: '2026-09-24T16:02:00.000Z',
          externalId: `comment:${comment.id}`,
          source: 'issue-comment',
        })
      }
    }
    const client = {
      getItems: async () => [{ uid: issue.uid, summary: issue.title, status }],
      getState: async () => ({ entity_id: config.completionReceiptEntityId, state: receipt }),
      completeItem: async () => {
        beginCompletion()
        await new Promise<void>((resolve) => { finishCompletion = resolve })
        status = 'completed'
        receipt = issue.uid
      },
      reopenItem: async () => {
        reopens += 1
        status = 'needs_action'
      },
    }
    const completion = completeAdminTodoGuarded(
      config, client, issue, () => {}, reconcileInputs,
    )
    await completionStarted
    comments.push({
      author_association: 'OWNER',
      body: 'The camera still fails here.\n\n![Updated screenshot](https://github.com/user-attachments/assets/22222222-2222-4222-8222-222222222222)',
      id: 812,
      user: { id: 3988463, login: 'SFenton' },
    })
    finishCompletion()
    await expect(completion).rejects.toThrow(AdminIssueNewInputError)
    expect(refreshes).toBeGreaterThanOrEqual(3)
    expect(status).toBe('needs_action')
    expect(reopens).toBe(1)
    expect(issue.receipts.todoCompletedAt).toBeUndefined()
    let issueReopens = 0
    await handleLateOwnerInput(issue, {
      persist: () => {},
      reopenIssue: async () => { issueReopens += 1 },
      startNewGeneration: async () => { beginAdminIssueGeneration(issue, '2026-09-24T16:03:00.000Z') },
    })
    expect(issueReopens).toBe(1)
    expect(issue.phase).toBe('queued')
    expect(issue.generation).toBe(2)
    expect(issue.receipts.issueClosedAt).toBeUndefined()
    expect(issue.inputRevision).toBeGreaterThan(issue.processedRevision)
  })

  it('blocks a terminal phase when closed-issue feedback arrives during cleanup', async () => {
    const issue = record()
    markIssueInputsProcessed(issue, issue.inputRevision, '2026-09-24T16:00:00.000Z')
    issue.phase = 'deploying'
    issue.receipts.issueClosedAt = '2026-09-24T16:01:00.000Z'
    const state = baselineAdminIssueState([], '2026-09-24T16:00:00.000Z')
    state.issues[issue.uid] = issue
    let cleanupFinished = false
    const reconcileInputs = async () => {
      if (cleanupFinished && isControllerOwnedCloseWindow(issue, 'closed')) {
        appendIssueInput(issue, {
          body: 'The fixed behavior still fails in the screenshot',
          createdAt: '2026-09-24T16:02:00.000Z',
          externalId: 'comment:after-cleanup',
          source: 'issue-comment',
        })
      }
    }
    await assertFreshFinalizationInputs(issue, reconcileInputs)
    cleanupFinished = true
    await expect(assertFreshFinalizationInputs(issue, reconcileInputs))
      .rejects.toThrow(AdminIssueNewInputError)
    expect(issue.phase).not.toBe('completed')
    expect(completionRepairRecords(state, new AdminIssueWorkerPool(10, async () => {})))
      .toEqual([issue])
  })

  it('fences PR publication and merge against newer owner feedback or a changed phase', () => {
    const issue = record()
    markIssueInputsProcessed(issue, issue.inputRevision, '2026-09-24T16:00:00.000Z')
    issue.phase = 'ready-for-pr'
    expect(() => assertCandidateReleaseCurrent(issue, 'ready-for-pr')).not.toThrow()
    issue.phase = 'pull-request'
    expect(() => assertCandidateReleaseCurrent(issue, 'pull-request')).not.toThrow()
    appendIssueInput(issue, {
      body: 'Correction while remote PR metadata was fetched',
      createdAt: '2026-09-24T16:01:00.000Z',
      externalId: 'comment:before-publish',
      source: 'issue-comment',
    })
    issue.phase = 'queued'
    expect(() => assertCandidateReleaseCurrent(issue, 'pull-request'))
      .toThrow(AdminIssueNewInputError)
    markIssueInputsProcessed(issue, issue.inputRevision, '2026-09-24T16:02:00.000Z')
    expect(() => assertCandidateReleaseCurrent(issue, 'pull-request'))
      .toThrow('phase changed')
  })

  it('recovers interrupted claims after restart without losing a pending revision', () => {
    const issue = record()
    const state = baselineAdminIssueState([], '2026-09-24T16:00:00.000Z')
    state.issues[issue.uid] = issue
    beginIssueWorkerClaim(issue, 'interrupted-claim', '2026-09-24T16:00:01.000Z')
    expect(() => assertAdminIssueControllerState(state)).not.toThrow()
    expect(recoverInterruptedIssueWorkers(state, '2026-09-24T16:01:00.000Z')).toBe(1)
    expect(issue.phase).toBe('queued')
    expect(issue.workerClaim).toBeUndefined()
    expect(issue.receipts.workerInterruptedClaimId).toBe('interrupted-claim')
    expect(recoverInterruptedIssueWorkers(state, '2026-09-24T16:01:01.000Z')).toBe(0)
    issue.receipts.workerRetryAfter = '2026-09-24T16:05:00.000Z'
    const pool = new AdminIssueWorkerPool(1, async () => {})
    expect(pendingIssueWorkers(state, pool, Date.parse('2026-09-24T16:04:59.000Z')))
      .toEqual([])
    expect(pendingIssueWorkers(state, pool, Date.parse('2026-09-24T16:05:01.000Z')))
      .toEqual([issue])
  })

  it('fences new input behind an active release claim and recovers that claim after restart', () => {
    const issue = record()
    const state = baselineAdminIssueState([], '2026-09-24T16:00:00.000Z')
    state.issues[issue.uid] = issue
    const pool = new AdminIssueWorkerPool(10, async () => {})
    const claim = beginIssueReleaseClaim(issue, 'release-1', '2026-09-24T16:00:01.000Z')
    expect(() => assertAdminIssueControllerState(state)).not.toThrow()
    appendIssueInput(issue, {
      body: 'Owner correction while release awaits CI',
      createdAt: '2026-09-24T16:00:02.000Z',
      externalId: 'comment:while-release',
      source: 'issue-comment',
    })
    issue.phase = 'queued'
    expect(pendingIssueWorkers(state, pool)).toEqual([])
    expect(() => beginIssueWorkerClaim(issue, 'worker-2', '2026-09-24T16:00:03.000Z'))
      .toThrow('already has an active worker or release')
    finishIssueReleaseClaim(issue, claim)
    expect(pendingIssueWorkers(state, pool)).toEqual([issue])
    beginIssueReleaseClaim(issue, 'release-2', '2026-09-24T16:00:04.000Z')
    expect(recoverInterruptedIssueWorkers(state, '2026-09-24T16:01:00.000Z')).toBe(1)
    expect(issue.releaseClaim).toBeUndefined()
    expect(issue.receipts.releaseInterruptedClaimId).toBe('release-2')
    expect(pendingIssueWorkers(state, pool)).toEqual([issue])
  })

  it('holds release ownership across asynchronous waits before admitting the same UID', async () => {
    const issue = record()
    const state = baselineAdminIssueState([], '2026-09-24T16:00:00.000Z')
    state.issues[issue.uid] = issue
    const pool = new AdminIssueWorkerPool(10, async () => {})
    let release!: () => void
    let writes = 0
    const pending = withIssueReleaseClaim(
      issue,
      'release-while-checking',
      '2026-09-24T16:00:01.000Z',
      () => { writes += 1 },
      async () => await new Promise<void>((resolve) => { release = resolve }),
    )
    appendIssueInput(issue, {
      body: 'Owner comment after check started',
      createdAt: '2026-09-24T16:00:02.000Z',
      externalId: 'comment:late-release',
      source: 'issue-comment',
    })
    issue.phase = 'queued'
    expect(pendingIssueWorkers(state, pool)).toEqual([])
    expect(writes).toBe(1)
    release()
    await pending
    expect(writes).toBe(2)
    expect(pendingIssueWorkers(state, pool)).toEqual([issue])
  })

  it('routes legacy and quarantined issues to the release guard instead of an unsafe worker', () => {
    const legacy = record()
    legacy.provenance = {
      kind: 'legacy-untrusted',
      migratedAt: '2026-09-24T16:00:00.000Z',
      reason: 'v1-missing-exact-provenance',
    }
    const quarantined = record()
    quarantined.uid = 'quarantined'
    quarantined.provenance = {
      epoch: 'epoch-1',
      generation: 1,
      kind: 'active',
      preparedBaseSha: 'a'.repeat(40),
      quarantine: {
        detectedAt: '2026-09-24T16:00:00.000Z',
        diagnosticsSha256: 'b'.repeat(64),
        reason: 'Candidate metadata changed unexpectedly',
      },
      resyncAttempts: 0,
      revision: 0,
    }
    const ready = record()
    ready.uid = 'ready'
    const state = { issues: {
      [legacy.uid]: legacy,
      [quarantined.uid]: quarantined,
      [ready.uid]: ready,
    } }
    const pool = new AdminIssueWorkerPool(10, async () => {})
    expect(pendingIssueWorkers(state, pool).map((issue) => issue.uid)).toEqual(['ready'])
    expect(guardedIssueRecords(state, pool).map((issue) => issue.uid))
      .toEqual([legacy.uid, quarantined.uid])
  })
})

describe('trusted workflow evidence and outstanding decisions', () => {
  const reference = { headSha: 'a'.repeat(40), runId: 123 }
  const observedAt = '2026-09-23T12:10:00.000Z'

  it('queues one exact-run diagnostic input without answering an evidence-only question', () => {
    const issue = awaitingLayoutEvidence()
    const originalOutcome = issue.lastOutcome
    const packet = {
      body: 'Host-verified failed layout run 123: five failed WebKit tests.',
      externalId: `workflow-evidence:123:1:${'b'.repeat(64)}`,
      fingerprint: 'b'.repeat(64),
    }
    expect(layoutEvidenceRequeueAllowed(issue, reference)).toBe(true)
    expect(queueVerifiedLayoutEvidence(issue, reference, packet, observedAt)).toBe(true)
    expect(issue.phase).toBe('queued')
    expect(issue.inputRevision).toBe(2)
    expect(issue.processedRevision).toBe(1)
    expect(issue.inputs[1]).toMatchObject({
      body: packet.body,
      externalId: packet.externalId,
      source: 'workflow-evidence',
    })
    expect(issue.lastOutcome).toBe(originalOutcome)
    markIssueInputsProcessed(issue, issue.inputRevision, observedAt)
    issue.phase = 'awaiting-user'
    expect(layoutEvidenceRequeueAllowed(issue, reference)).toBe(false)
    expect(queueVerifiedLayoutEvidence(issue, reference, packet, observedAt)).toBe(false)
    expect(issue.inputRevision).toBe(2)
  })

  it('never requeues an authorization, product, pending-input, or mismatched question', () => {
    const issue = awaitingLayoutEvidence()
    if (issue.lastOutcome?.decision !== 'needs_input') throw new Error('Expected needs_input')
    issue.lastOutcome.questions[0].reason = 'ci_evidence_unavailable'
    expect(layoutEvidenceRequeueAllowed(issue, reference)).toBe(true)
    issue.lastOutcome.questions[0].question = 'Do you authorize a Home Assistant restart?'
    expect(layoutEvidenceRequeueAllowed(issue, reference)).toBe(false)
    issue.lastOutcome.questions[0].question =
      'Which original failure evidence can be attached for run 123?'
    issue.lastOutcome.questions[0].options[0] = 'Authorize restart and deployment'
    expect(layoutEvidenceRequeueAllowed(issue, reference)).toBe(false)
    issue.lastOutcome.questions[0].options[0] = 'Failed-step log'
    issue.lastOutcome.questions.push({
      options: ['A', 'B'],
      question: 'Should we close the issue?',
    })
    expect(layoutEvidenceRequeueAllowed(issue, reference)).toBe(false)
    issue.lastOutcome.questions.pop()
    expect(layoutEvidenceRequeueAllowed(issue, { ...reference, runId: 124 })).toBe(false)
    issue.automationKind = 'deployment'
    expect(layoutEvidenceRequeueAllowed(issue, reference)).toBe(false)
    issue.automationKind = 'layout'
    issue.processedRevision = 0
    expect(layoutEvidenceRequeueAllowed(issue, reference)).toBe(false)
    issue.processedRevision = 1
    issue.pr = { number: 400, url: 'https://github.com/example/pull/400' }
    expect(layoutEvidenceRequeueAllowed(issue, reference)).toBe(false)
    expect(queueVerifiedLayoutEvidence(issue, reference, {
      body: 'Unbound diagnostic.',
      externalId: `workflow-evidence:999:1:${'b'.repeat(64)}`,
      fingerprint: 'b'.repeat(64),
    }, observedAt)).toBe(false)
  })

  it('validates optional evidence-only question reasons without classifying authorization', () => {
    const issue = awaitingLayoutEvidence()
    const input = issue.lastOutcome
    const marked = parseWorkerOutcome(JSON.stringify({
      ...input,
      questions: [{
        options: ['Attach original log', 'Neither is retrievable'],
        question: 'Which original failure evidence can be attached for run 123?',
        reason: 'ci_evidence_unavailable',
      }],
    }))
    if (marked.decision !== 'needs_input') throw new Error('Expected needs_input')
    expect(marked.questions[0].reason).toBe('ci_evidence_unavailable')
    expect(() => parseWorkerOutcome(JSON.stringify({
      ...input,
      questions: [{
        options: ['Authorize', 'Defer'],
        question: 'Authorize a runtime restart?',
        reason: 'operator_approval',
      }],
    }))).toThrow('reason must be ci_evidence_unavailable')
  })

  it('verifies full v2 frontend delivery and git ancestry without claiming HA activation', async () => {
    const failedSha = 'a'.repeat(40)
    const deployedSha = 'b'.repeat(40)
    const masterSha = 'c'.repeat(40)
    const failed: EvidenceWorkflowRun = {
      conclusion: 'failure',
      created_at: '2026-09-20T12:00:00.000Z',
      event: 'push',
      head_branch: 'master',
      head_sha: failedSha,
      html_url: 'https://github.com/SFenton/ha-sfenton-react-dash/actions/runs/123',
      id: 123,
      name: 'Deploy dashboard',
      path: '.github/workflows/deploy-dashboard.yml',
      run_attempt: 1,
      status: 'completed',
    }
    const successful: EvidenceWorkflowRun = {
      ...failed,
      conclusion: 'success',
      created_at: '2026-09-23T12:00:00.000Z',
      head_sha: deployedSha,
      html_url: 'https://github.com/SFenton/ha-sfenton-react-dash/actions/runs/789',
      id: 789,
    }
    const receipt = {
      deploymentHash: 'c'.repeat(64),
      deployedAt: observedAt,
      deployedSha,
      disposition: 'forward',
      leaseReleased: true,
      manifestHash: 'd'.repeat(64),
      panelRegistered: true,
      runAttempt: 1,
      runId: '789',
      sourceSha: deployedSha,
      status: 'success',
      verifiedPaths: [...REQUIRED_DEPLOYMENT_VERIFIED_PATHS],
      version: 2,
    }
    const ancestry: typeof commitIsAncestor = async (_path, ancestor, descendant) =>
      (ancestor === failedSha && descendant === deployedSha) ||
      (ancestor === deployedSha && descendant === masterSha)
    await expect(assertFrontendOnlyRecovery(
      '/test/repository', failed, successful, receipt, masterSha, ancestry,
    )).resolves.toBeUndefined()
    await expect(assertFrontendOnlyRecovery(
      '/test/repository', failed, successful,
      { ...receipt, deployedSha: 'e'.repeat(40) }, masterSha, ancestry,
    )).rejects.toThrow('does not cover')
    await expect(assertFrontendOnlyRecovery(
      '/test/repository', failed, successful,
      { ...receipt, verifiedPaths: ['index.html'] }, masterSha, ancestry,
    )).rejects.toThrow('accepted, newer')
    await expect(assertFrontendOnlyRecovery(
      '/test/repository', failed, successful,
      { ...receipt, status: 'failed' }, masterSha, ancestry,
    )).rejects.toThrow('accepted, newer')
    await expect(assertFrontendOnlyRecovery(
      '/test/repository', failed, successful,
      { ...receipt, deployedAt: failed.created_at }, masterSha, ancestry,
    )).rejects.toThrow('accepted, newer')

    const issue = awaitingLayoutEvidence()
    issue.automationKind = 'deployment'
    if (issue.lastOutcome?.decision !== 'needs_input') throw new Error('Expected needs_input')
    issue.lastOutcome.questions[0].question = 'Do you authorize a Home Assistant restart?'
    const authorizationQuestion = issue.lastOutcome
    expect(frontendRecoveryObservationDue(issue, Date.parse(observedAt))).toBe(true)
    issue.receipts.frontendRecoveryCheckedAt = observedAt
    expect(frontendRecoveryObservationDue(issue, Date.parse(observedAt) + 120_000)).toBe(false)
    expect(frontendRecoveryObservationDue(issue, Date.parse(observedAt) + 360_000)).toBe(true)
    markFrontendOnlyRecoveryObserved(issue, deployedSha, successful.id, observedAt)
    expect(issue.phase).toBe('awaiting-user')
    expect(issue.lastOutcome).toBe(authorizationQuestion)
    expect(issue.receipts.frontendRecoveryDeployedSha).toBe(deployedSha)
    expect(frontendRecoveryObservationDue(issue, Date.parse(observedAt) + 360_000)).toBe(false)
    expect(() => markFrontendOnlyRecoveryObserved(issue, deployedSha, successful.id, observedAt))
      .toThrow('cannot replace an unresolved decision')
  })
})

describe('deployment runner trust rotation', () => {
  it('rotates only when the protected deployment workflow changed', () => {
    expect(
      workflowDigestRotationRequired(
        ['.github/workflows/deploy-dashboard.yml'],
        '.github/workflows/deploy-dashboard.yml',
      ),
    ).toBe(true)
    expect(
      workflowDigestRotationRequired(
        ['scripts/deploy-dashboard-ci.ts'],
        '.github/workflows/deploy-dashboard.yml',
      ),
    ).toBe(false)
  })

  it('preserves the runner config while replacing only the trusted digest', () => {
    expect(
      updateWorkflowDigestConfig(
        {
          mode: 'production',
          runnerImageId: `sha256:${'a'.repeat(64)}`,
          version: 1,
          workflowSha256: 'b'.repeat(64),
        },
        'c'.repeat(64),
      ),
    ).toEqual({
      mode: 'production',
      runnerImageId: `sha256:${'a'.repeat(64)}`,
      version: 1,
      workflowSha256: 'c'.repeat(64),
    })
  })

  it('rejects malformed runner config and digests', () => {
    expect(() =>
      updateWorkflowDigestConfig(
        { version: 1, workflowSha256: 'b'.repeat(64) },
        'not-a-digest',
      ),
    ).toThrow('workflowSha256')
    expect(() =>
      updateWorkflowDigestConfig(
        { version: 2, workflowSha256: 'b'.repeat(64) },
        'c'.repeat(64),
      ),
    ).toThrow('version')
  })

  it('retries a failed workflow trust rotation before entering deployment', async () => {
    const issue = record()
    authorizeRecord(issue)
    if (issue.provenance.kind !== 'active' || !issue.provenance.candidate) {
      throw new Error('Expected authorized candidate')
    }
    issue.provenance.candidate.diff.files = ['.github/workflows/deploy-dashboard.yml']
    issue.phase = 'pull-request'
    let attempts = 0
    let journalWrites = 0
    const rotate = async () => {
      attempts += 1
      if (attempts === 1) throw new Error('Temporary runner restart failure')
    }
    const persist = () => { journalWrites += 1 }
    const workflowPath = '.github/workflows/deploy-dashboard.yml'
    await expect(ensureRunnerTrustRotation(issue, workflowPath, rotate, persist, 3))
      .rejects.toThrow('Temporary runner restart failure')
    expect(issue.phase).toBe('pull-request')
    expect(issue.receipts.workflowRotationPendingAt).toBeDefined()
    expect(issue.receipts.workflowRotationCompletedAt).toBeUndefined()
    expect(issue.receipts.workflowRotationAttempts).toBe('1')
    await ensureRunnerTrustRotation(issue, workflowPath, rotate, persist, 3)
    expect(attempts).toBe(2)
    expect(journalWrites).toBe(4)
    expect(issue.receipts.workflowRotationPendingAt).toBeUndefined()
    expect(issue.receipts.workflowRotationCompletedAt).toBeDefined()
    const source = readFileSync(resolve(process.cwd(), 'scripts/admin-issue-controller.ts'), 'utf8')
    const merge = source.slice(
      source.indexOf('async function mergePullRequest('),
      source.indexOf('async function downloadAcceptedDeploymentReceipt('),
    )
    expect(merge.indexOf('await ensureRunnerTrustRotation(')).toBeGreaterThan(-1)
    expect(merge.indexOf('await ensureRunnerTrustRotation('))
      .toBeLessThan(merge.indexOf("record.phase = 'deploying'"))
    const another = record()
    authorizeRecord(another)
    if (another.provenance.kind !== 'active' || !another.provenance.candidate) {
      throw new Error('Expected another authorized candidate')
    }
    another.provenance.candidate.diff.files = [workflowPath]
    let exhaustedCalls = 0
    const alwaysFails = async () => {
      exhaustedCalls += 1
      throw new Error('Runner remains unavailable')
    }
    await expect(ensureRunnerTrustRotation(another, workflowPath, alwaysFails, () => {}, 2))
      .rejects.toThrow('Runner remains unavailable')
    await expect(ensureRunnerTrustRotation(another, workflowPath, alwaysFails, () => {}, 2))
      .rejects.toThrow('Runner remains unavailable')
    await expect(ensureRunnerTrustRotation(another, workflowPath, alwaysFails, () => {}, 2))
      .rejects.toThrow('retry limit')
    expect(exhaustedCalls).toBe(2)
  })
})

describe('controller command lifecycle', () => {
  it.skipIf(process.platform === 'win32')(
    'kills the complete subprocess group when a command times out',
    async () => {
      const root = mkdtempSync(join(homedir(), '.admin-issue-controller-process-test-'))
      temporaryDirectories.push(root)
      const pidPath = join(root, 'grandchild.pid')
      const script = [
        "const { spawn } = require('node:child_process')",
        "const { writeFileSync } = require('node:fs')",
        "const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' })",
        'writeFileSync(process.argv[1], String(child.pid))',
        'setInterval(() => {}, 1000)',
      ].join(';')
      let grandchildPid: number | undefined
      const command = runCommand(process.execPath, ['-e', script, pidPath], {
        timeoutMs: 1_000,
      }).then(
        (result) => ({ result }),
        (error: unknown) => ({ error }),
      )
      const processIsAlive = (pid: number) => {
        try {
          process.kill(pid, 0)
          return true
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === 'ESRCH') return false
          throw error
        }
      }

      try {
        await expect.poll(() => {
          try {
            grandchildPid = Number(readFileSync(pidPath, 'utf8'))
            return Number.isInteger(grandchildPid) && grandchildPid > 0
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
            throw error
          }
        }).toBe(true)
        await expect.poll(
          () => processIsAlive(grandchildPid as number),
          { timeout: 3_000 },
        ).toBe(false)
        expect(await command).toMatchObject({
          error: expect.objectContaining({
            message: `${process.execPath} timed out after 1000 ms`,
          }),
        })
      } finally {
        if (grandchildPid && processIsAlive(grandchildPid)) {
          process.kill(grandchildPid, 'SIGKILL')
        }
        await command
      }
    },
  )
})

function authorizeRecord(issue: AdminIssueRecord) {
  const baseSha = 'a'.repeat(40)
  const headSha = 'b'.repeat(40)
  const treeSha = 'c'.repeat(40)
  const mergeSha = 'd'.repeat(40)
  issue.processedRevision = issue.inputRevision
  issue.pr = {
    number: 400,
    url: 'https://github.com/SFenton/ha-sfenton-react-dash/pull/400',
  }
  issue.provenance = {
    candidate: {
      checks: {
        epoch: 'epoch-1',
        generation: issue.generation,
        headSha,
        observedAt: '2026-09-20T12:04:00.000Z',
        requiredSetSha256: '3'.repeat(64),
        revision: issue.processedRevision,
        runs: [
          {
            appId: 15368,
            checkRunId: 22,
            completedAt: '2026-09-20T12:04:00.000Z',
            conclusion: 'success',
            name: 'Playwright gate',
          },
        ],
      },
      diff: {
        baseSha,
        entryCount: 1,
        epoch: 'epoch-1',
        files: ['src/App.tsx'],
        generation: issue.generation,
        headSha,
        manifestSha256: '1'.repeat(64),
        mergeBaseSha: baseSha,
        revision: issue.processedRevision,
        treeSha,
      },
      headSha,
      targetBaseSha: baseSha,
      treeSha,
      validation: {
        commands: ['npm run build'],
        commandsSha256: '2'.repeat(64),
        completedAt: '2026-09-20T12:03:00.000Z',
        diffManifestSha256: '1'.repeat(64),
        epoch: 'epoch-1',
        generation: issue.generation,
        headSha,
        revision: issue.processedRevision,
        treeSha,
      },
      visualEvidence: [
        {
          alt: 'Fixed dashboard spacing',
          caption: 'Mock evidence: phone viewport with the corrected spacing.',
          diffManifestSha256: '1'.repeat(64),
          mediaType: 'image/png',
          path: 'artifacts/admin-issue-321/fixed.png',
          sha256: '5'.repeat(64),
          sizeBytes: 123,
          url: 'https://github.com/user-attachments/assets/11111111-1111-1111-1111-111111111111',
        },
      ],
    },
    deployment: {
      deployedSha: 'e'.repeat(40),
      disposition: 'forward',
      epoch: 'epoch-1',
      generation: issue.generation,
      mergeSha,
      receiptHash: '4'.repeat(64),
      revision: issue.processedRevision,
      sourceSha: mergeSha,
      workflowHeadSha: mergeSha,
      workflowRunAttempt: 1,
      workflowRunId: 23,
    },
    epoch: 'epoch-1',
    generation: issue.generation,
    kind: 'active',
    merge: {
      baseSha,
      candidateHeadSha: headSha,
      epoch: 'epoch-1',
      generation: issue.generation,
      mergeSha,
      mergedAt: '2026-09-20T12:05:00.000Z',
      observedAt: '2026-09-20T12:05:00.000Z',
      prNumber: 400,
      revision: issue.processedRevision,
    },
    preparedBaseSha: baseSha,
    resyncAttempts: 0,
    revision: issue.processedRevision,
  }
}

function controllerState(issue: AdminIssueRecord): AdminIssueControllerState {
  return {
    activeUid: issue.uid,
    baselineCompletedAt: issue.createdAt,
    ignoredUids: [],
    issues: { [issue.uid]: issue },
    updatedAt: issue.updatedAt,
    version: 3,
  }
}

function validationReceipt(
  issue: AdminIssueRecord,
  diff: AdminIssueDiffReceipt,
): AdminIssueValidationReceipt {
  if (issue.provenance.kind !== 'active') throw new Error('Expected active provenance')
  return {
    commands: ['test validation'],
    commandsSha256: '2'.repeat(64),
    completedAt: '2026-09-20T12:03:00.000Z',
    diffManifestSha256: diff.manifestSha256,
    epoch: issue.provenance.epoch,
    generation: issue.generation,
    headSha: diff.headSha,
    revision: issue.processedRevision,
    treeSha: diff.treeSha,
  }
}

function readyCandidateOutcome(): Parameters<typeof prepareCommittedCandidate>[3] {
  return {
    changeSummary: ['Updated the dashboard fixture.'],
    decision: 'ready_for_pr',
    iosFollowUp: { reason: '', required: false },
    pr: { body: 'Fix the dashboard fixture.', title: 'Fix fixture' },
    questions: [],
    review: { approved: true, findings: [] },
    schemaVersion: 1,
    summary: 'Updated the dashboard fixture.',
    tests: [{ command: 'test validation', result: 'passed' }],
    visualChange: { reason: 'Fixture-only test; no visible dashboard result.', required: false },
    visualEvidence: [],
  }
}

async function publicationFixture() {
  const root = mkdtempSync(join(homedir(), '.admin-issue-controller-publication-test-'))
  temporaryDirectories.push(root)
  const remotePath = join(root, 'origin.git')
  const repositoryPath = join(root, 'repository')
  execFileSync('git', ['init', '--bare', '--initial-branch=master', remotePath])
  mkdirSync(repositoryPath)
  const git = (...args: string[]) =>
    execFileSync('git', args, { cwd: repositoryPath, encoding: 'utf8' }).trim()
  git('init', '--initial-branch=master')
  git('config', 'user.name', 'Admin Issue Controller Test')
  git('config', 'user.email', 'controller-test@example.invalid')
  git('remote', 'add', 'origin', remotePath)
  mkdirSync(join(repositoryPath, 'src'))
  writeFileSync(join(repositoryPath, 'src/fixture.ts'), 'export const value = 1\n')
  git('add', '--all')
  git('commit', '-m', 'Base')
  git('push', '--set-upstream', 'origin', 'master')
  const baseSha = git('rev-parse', 'HEAD')
  const branch = 'copilot/admin-todo-321-g1-publication'
  git('switch', '-c', branch)
  writeFileSync(join(repositoryPath, 'src/fixture.ts'), 'export const value = 2\n')

  const issue = record()
  issue.branch = branch
  issue.worktreePath = repositoryPath
  issue.processedRevision = 1
  issue.provenance = {
    epoch: 'epoch-publication',
    generation: issue.generation,
    kind: 'active',
    preparedBaseSha: baseSha,
    resyncAttempts: 0,
    revision: 0,
  }
  const state = controllerState(issue)
  const config = {
    repositoryPath,
    stateDirectory: join(root, 'state'),
  } as Parameters<typeof prepareCommittedCandidate>[0]
  const first = await prepareCommittedCandidate(config, state, issue, readyCandidateOutcome())
  return { baseSha, branch, config, first, git, issue, repositoryPath, root, state }
}

async function replaceCandidate(
  fixture: Awaited<ReturnType<typeof publicationFixture>>,
  value: number,
) {
  const { config, issue, repositoryPath, state } = fixture
  appendIssueInput(issue, {
    body: 'Repair the previous candidate.',
    createdAt: '2026-09-20T12:05:00.000Z',
    externalId: `repair:${issue.inputRevision + 1}`,
    source: 'ci-failure',
  })
  markIssueInputsProcessed(issue, issue.inputRevision, '2026-09-20T12:06:00.000Z')
  writeFileSync(join(repositoryPath, 'src/fixture.ts'), `export const value = ${value}\n`)
  return prepareCommittedCandidate(config, state, issue, readyCandidateOutcome())
}

describe('admin issue controller domain', () => {
  it('builds stable public issue and worker identifiers', () => {
    expect(adminIssueMarker('task-1')).toBe('<!-- admin-todo-uid:task-1 -->')
    expect(controllerReceiptMarker('task-1', 'completed')).toBe(
      '<!-- admin-issue-controller:task-1:completed -->',
    )
    expect(todoFingerprint('  Fix gap ', ' Details ')).toBe(todoFingerprint('Fix gap', 'Details'))
    expect(issueTitle('  Fix   the gap  ')).toBe('Fix the gap')
    expect(issueTitle('')).toBe('Admin To-Do item')
    expect(issueBody({ description: 'Details', summary: 'Fix gap', uid: 'task-1' })).toContain(
      '_This issue is synchronized from the dashboard Admin To-Do list._',
    )
    expect(sessionNameForIssue(321, 'task with spaces')).toBe('admin-issue-321-task-with-spaces')
    expect(branchNameForIssue(321, 2, 'Fix: Terminal Gap!')).toBe(
      'copilot/admin-todo-321-g2-fix-terminal-gap',
    )
    expect(
      neutralizeGitHubClosingReferences(
        'Fixes #321 and resolves https://github.com/SFenton/ha-sfenton-react-dash/issues/99.',
      ),
    ).toBe(
      'Tracks #321 and Tracks https://github.com/SFenton/ha-sfenton-react-dash/issues/99.',
    )
    expect(githubAutomationIssueUid(167)).toBe('github-issue-167')
    expect(
      githubAutomationIssueMarker('<!-- layout-failure-commit-abc123 -->'),
    ).toBe('layout-failure-commit-')
    expect(
      githubAutomationIssueMarker('<!-- dashboard-deployment-failure-run-10-2 -->'),
    ).toBe('dashboard-deployment-failure-run-')
    expect(githubAutomationIssueMarker('ordinary issue')).toBeUndefined()
  })

  it('parses bounded Admin To-Do image manifests without exposing the marker as issue text', () => {
    const parsed = parseAdminTodoAttachments(
      [
        'Reported on the vacuum page.',
        '<!-- admin-todo-attachments:{"version":1,"attachments":[{"id":"11111111-1111-4111-8111-111111111111","mediaType":"image/png","name":"vacuum.png","sha256":"' + 'a'.repeat(64) + '","sizeBytes":123}]} -->',
      ].join('\n\n'),
    )
    expect(parsed.description).toBe('Reported on the vacuum page.')
    expect(parsed.attachments).toEqual([
      {
        id: '11111111-1111-4111-8111-111111111111',
        mediaType: 'image/png',
        name: 'vacuum.png',
        sha256: 'a'.repeat(64),
        sizeBytes: 123,
      },
    ])
    expect(() =>
      parseAdminTodoAttachments(
        '<!-- admin-todo-attachments:{"version":1,"attachments":[]} -->',
      ),
    ).toThrow('one to four images')
  })

  it('journals image upload intent, fails closed after ambiguous interruption and reuses confirmed uploads', () => {
    const state = baselineAdminIssueState([], '2026-09-24T16:00:00.000Z')
    const uid = 'image-task-1'
    const attachment = {
      id: '11111111-1111-4111-8111-111111111111',
      localPath: '/private/input-attachments/image-task-1/11111111-1111-4111-8111-111111111111.png',
      mediaType: 'image/png' as const,
      name: 'reported.png',
      sha256: 'a'.repeat(64),
      sizeBytes: 321,
    }
    const attemptedAt = '2026-09-24T16:00:01.000Z'
    expect(reserveTodoAttachmentUpload(state, uid, attachment, attemptedAt).created).toBe(true)
    expect(() => assertAdminIssueControllerState(state)).not.toThrow()
    const afterCrash: unknown = JSON.parse(JSON.stringify(state))
    assertAdminIssueControllerState(afterCrash)
    expect(() => reserveTodoAttachmentUpload(afterCrash, uid, attachment, attemptedAt))
      .toThrow('outcome is unknown')
    const asset = 'https://github.com/user-attachments/assets/11111111-1111-1111-1111-111111111111'
    expect(confirmTodoAttachmentUpload(afterCrash, uid, attachment.id, asset).githubUrl).toBe(asset)
    expect(reserveTodoAttachmentUpload(afterCrash, uid, attachment, attemptedAt)).toMatchObject({
      created: false,
      receipt: { status: 'uploaded', githubUrl: asset },
    })
    expect(() => reserveTodoAttachmentUpload(afterCrash, uid, {
      ...attachment,
      sha256: 'b'.repeat(64),
    }, attemptedAt)).toThrow('does not match its verified manifest')
    recordTodoIntakeFailure(afterCrash, uid, 'c'.repeat(64), attemptedAt, 'upload-outcome-unknown')
    expect(afterCrash.intakeFailures?.[todoIntakeKey(uid)]).toMatchObject({
      attempts: 1,
      reason: 'upload-outcome-unknown',
    })
    const replacement = {
      ...attachment,
      id: '22222222-2222-4222-8222-222222222222',
      localPath: '/private/input-attachments/image-task-1/replacement.png',
    }
    expect(retainTodoAttachmentUploads(afterCrash, uid, new Set([replacement.id]))).toBe(true)
    expect(reserveTodoAttachmentUpload(afterCrash, uid, replacement, attemptedAt).created).toBe(true)
    expect(afterCrash.pendingUploads?.[todoIntakeKey(uid)]).toHaveLength(1)
    confirmTodoAttachmentUpload(
      afterCrash, uid, replacement.id,
      'https://github.com/user-attachments/assets/22222222-2222-2222-2222-222222222222',
    )
    clearTodoIntakeReceipts(afterCrash, uid)
    expect(afterCrash.pendingUploads?.[todoIntakeKey(uid)]).toBeUndefined()
    expect(afterCrash.intakeFailures?.[todoIntakeKey(uid)]).toBeUndefined()
    expect(() => assertAdminIssueControllerState(afterCrash)).not.toThrow()
  })

  it('retains ambiguous upload tombstones when an owner replaces and restores an image', () => {
    const state = baselineAdminIssueState([], '2026-09-24T16:00:00.000Z')
    const uid = 'image-task-2'
    const original = {
      id: '11111111-1111-4111-8111-111111111111',
      localPath: '/private/input-attachments/original.png',
      mediaType: 'image/png' as const,
      name: 'original.png',
      sha256: 'a'.repeat(64),
      sizeBytes: 321,
    }
    const startedAt = '2026-09-24T16:00:01.000Z'
    reserveTodoAttachmentUpload(state, uid, original, startedAt)
    expect(retainTodoAttachmentUploads(state, uid, new Set(['replacement']))).toBe(false)
    const replacement = { ...original, id: 'replacement', localPath: '/private/replacement.png' }
    reserveTodoAttachmentUpload(state, uid, replacement, startedAt)
    confirmTodoAttachmentUpload(
      state, uid, replacement.id,
      'https://github.com/user-attachments/assets/22222222-2222-2222-2222-222222222222',
    )
    clearTodoIntakeReceipts(state, uid)
    expect(state.pendingUploads?.[todoIntakeKey(uid)]).toMatchObject([
      { id: original.id, status: 'uploading' },
    ])
    expect(() => reserveTodoAttachmentUpload(state, uid, original, startedAt))
      .toThrow('outcome is unknown')
    expect(() => assertAdminIssueControllerState(state)).not.toThrow()
  })

  it('validates persisted input attachment receipts', () => {
    const issue = record()
    issue.inputs[0].attachments = [
      {
        githubUrl: 'https://github.com/user-attachments/assets/11111111-1111-1111-1111-111111111111',
        id: '11111111-1111-4111-8111-111111111111',
        localPath: '/tmp/admin-issue-controller/11111111-1111-4111-8111-111111111111.png',
        mediaType: 'image/png',
        name: 'vacuum.png',
        sha256: 'a'.repeat(64),
        sizeBytes: 123,
      },
    ]
    const state = baselineAdminIssueState([], '2026-09-20T12:00:00.000Z')
    state.issues[issue.uid] = issue
    expect(() => assertAdminIssueControllerState(state)).not.toThrow()
    issue.inputs[0].attachments[0].githubUrl = 'https://example.com/untrusted.png'
    expect(() => assertAdminIssueControllerState(state)).toThrow(
      'githubUrl is invalid',
    )
    expect(
      formatSubmittedImageMarkdown(
        'Vacuum ](https://example.com) <script>\nmap',
        'https://github.com/user-attachments/assets/11111111-1111-1111-1111-111111111111',
      ),
    ).toBe(
      '![Vacuum \\](https://example.com) script map](https://github.com/user-attachments/assets/11111111-1111-1111-1111-111111111111)',
    )
  })

  it('binds GitHub media findings to verified attachments without trusting unrecorded files', () => {
    const issue = record()
    const attachment = {
      githubUrl: 'https://github.com/user-attachments/assets/11111111-1111-1111-1111-111111111111',
      id: '11111111-1111-4111-8111-111111111111',
      localPath: '/tmp/admin-issue-controller/11111111-1111-4111-8111-111111111111.png',
      mediaType: 'image/png' as const,
      name: 'Image',
      sha256: 'a'.repeat(64),
      sizeBytes: 123,
    }
    issue.inputs[0].source = 'issue-comment'
    issue.inputs[0].attachments = [attachment]
    issue.inputs[0].bodySha256 = 'b'.repeat(64)
    issue.inputs[0].sourceKey = 'comment:123'
    issue.inputs[0].sourceUpdatedAt = '2026-09-20T12:00:00.000Z'
    issue.inputs[0].mediaFindings = [{
      attachmentId: attachment.id,
      githubUrl: attachment.githubUrl,
      id: 'c'.repeat(32),
      label: 'Image',
      mediaType: attachment.mediaType,
      occurrence: 0,
      placement: 'image',
      sha256: attachment.sha256,
      sizeBytes: attachment.sizeBytes,
      status: 'attached',
    }]
    const state = controllerState(issue)
    expect(() => assertAdminIssueControllerState(state)).not.toThrow()
    issue.inputs[0].mediaFindings[0].attachmentId = 'another-file'
    expect(() => assertAdminIssueControllerState(state)).toThrow(
      'does not match a verified input attachment',
    )
    issue.inputs[0].mediaFindings[0].attachmentId = attachment.id
    issue.inputs[0].mediaFindings.push({
      ...issue.inputs[0].mediaFindings[0],
      id: 'd'.repeat(32),
    })
    expect(() => assertAdminIssueControllerState(state)).toThrow('duplicate references')
    issue.inputs[0].mediaFindings.pop()
    delete issue.inputs[0].mediaFindings[0].githubUrl
    expect(() => assertAdminIssueControllerState(state)).toThrow(
      'githubUrl is required for attached media',
    )
    issue.inputs[0].mediaFindings[0].githubUrl = attachment.githubUrl
    issue.inputs[0].attachments[0].id = '../../.env'
    expect(() => assertAdminIssueControllerState(state)).toThrow('.id is invalid')
  })

  it('replays the exact HTML screenshot into a new unprocessed, verified native attachment', async () => {
    const root = mkdtempSync(join(homedir(), '.admin-issue-media-replay-test-'))
    temporaryDirectories.push(root)
    const repository = 'SFenton/ha-sfenton-react-dash'
    const githubUrl = 'https://github.com/user-attachments/assets/11111111-1111-1111-1111-111111111111'
    const body = `<img width="3651" height="1822" alt="Image" src="${githubUrl}" />\n\nCaptured on a fullscreen 4k desktop.`
    const pngBytes = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlO89sAAAAASUVORK5CYII=',
      'base64',
    )
    const config = { repository, repositoryPath: root, stateDirectory: join(root, 'state') }
    const issue = record()
    issue.issueNumber = 225
    issue.issueUrl = 'https://github.com/SFenton/ha-sfenton-react-dash/issues/225'
    const sourceKey = 'comment:5802431887'
    const commentAt = '2026-09-23T20:31:01.000Z'
    appendIssueInput(issue, {
      body,
      createdAt: commentAt,
      externalId: sourceKey,
      source: 'issue-comment',
    })
    markIssueInputsProcessed(issue, issue.inputRevision, '2026-09-23T20:55:26.000Z')
    issue.commentCursor = 5802431887
    issue.phase = 'paused'
    issue.pr = { number: 228, url: 'https://github.com/SFenton/ha-sfenton-react-dash/pull/228' }
    issue.receipts.manuallyClosedAt = '2026-09-23T21:13:30.000Z'
    const references = discoverEmbeddedGitHubMedia(body, repository)
    expect(mediaInputRequired(issue, sourceKey, body, references)).toBe(true)

    const fetcher: typeof fetch = async (_url, init) => {
      expect(new Headers(init?.headers).get('authorization')).toBe('Bearer test-token')
      return new Response(new Uint8Array(pngBytes), {
        headers: { 'content-type': 'image/png' },
        status: 200,
      })
    }
    const media = await prepareGitHubMediaInput(
      config,
      issue,
      sourceKey,
      commentAt,
      body,
      { fetcher, token: 'test-token' },
    )
    expect(media.mediaFindings).toMatchObject([
      { githubUrl, placement: 'image', status: 'attached', mediaType: 'image/png' },
    ])
    expect(media.attachments).toHaveLength(1)
    expect(statSync(media.attachments?.[0].localPath ?? '').mode & 0o777).toBe(0o600)

    const comments = [
      {
        author_association: 'OWNER',
        body,
        created_at: commentAt,
        id: 5802431887,
        updated_at: commentAt,
        user: { id: 42, login: 'SFenton' },
      },
      {
        author_association: 'COLLABORATOR',
        body: `<img src="${githubUrl}">`,
        created_at: commentAt,
        id: 5802431888,
        user: { id: 43, login: 'visitor' },
      },
      {
        author_association: 'OWNER',
        body: `<!-- admin-issue-controller -->\n<img src="${githubUrl}">`,
        created_at: commentAt,
        id: 5802431889,
        user: { id: 42, login: 'SFenton' },
      },
    ]
    const reopenedIssue = {
      author_association: 'OWNER',
      body: null,
      created_at: commentAt,
      html_url: issue.issueUrl,
      number: 225,
      state: 'open' as const,
      title: issue.title,
      updated_at: '2026-09-23T21:20:00.000Z',
      user: { id: 42, login: 'SFenton' },
    }
    const prepared = await prepareReopenedMedia(
      { ...config, ownerId: 42, ownerLogin: 'SFenton' } as Parameters<typeof prepareReopenedMedia>[0],
      issue,
      reopenedIssue,
      comments,
      { fetcher, token: 'test-token' },
    )
    expect(prepared.map((source) => source.key)).toEqual([sourceKey])
    beginAdminIssueGeneration(issue, '2026-09-23T21:20:00.000Z')
    queueReopenedMediaInputs(issue, reopenedIssue, comments, prepared)
    expect(issue.phase).toBe('queued')
    expect(issue.generation).toBe(2)
    expect(issue.pr).toBeUndefined()
    expect(issue.receipts.manuallyClosedAt).toBeUndefined()
    expect(issue.commentCursor).toBe(5802431889)
    expect(pendingIssueInputs(issue).map((input) => input.revision)).toEqual([3, 4])
    expect(pendingIssueInputs(issue)[1].attachments?.[0].sha256).toMatch(/^[a-f0-9]{64}$/)
    expect(mediaInputRequired(issue, sourceKey, body, references)).toBe(false)
    expect(mediaInputRequired(issue, sourceKey, `${body}\nUpdated`, references)).toBe(true)
    expect(() => assertAdminIssueControllerState(controllerState(issue))).not.toThrow()

    issue.worktreePath = join(root, 'worktree')
    mkdirSync(issue.worktreePath)
    materializeWorkerInputAttachments(config, issue)
    const nativeArgs = workerMediaAttachmentArgs(issue)
    expect(nativeArgs).toEqual([
      '--attachment',
      resolve(issue.worktreePath, `artifacts/admin-issue-${issue.issueNumber}/reported/input-4-${media.attachments?.[0].id}.png`),
    ])
    expect(statSync(nativeArgs[1]).mode & 0o777).toBe(0o400)
    expect(readFileSync(nativeArgs[1])).toEqual(pngBytes)
    expect(buildWorkerPrompt(issue)).toContain('Submitted media (also attached directly')
    expect(workerInputAttachments(issue)).toHaveLength(1)

    const outside = join(root, 'outside.png')
    writeFileSync(outside, pngBytes)
    const tampered = structuredClone(issue)
    const replay = tampered.inputs.at(-1)
    if (!replay?.attachments?.[0]) throw new Error('Expected replay attachment')
    replay.attachments[0].localPath = outside
    expect(() => materializeWorkerInputAttachments(config, tampered)).toThrow(
      'escaped the private attachment directory',
    )

    const outsideDirectory = join(root, 'outside-directory')
    mkdirSync(outsideDirectory)
    const symlinked = structuredClone(issue)
    symlinked.worktreePath = join(root, 'symlinked-worktree')
    mkdirSync(symlinked.worktreePath)
    symlinkSync(outsideDirectory, join(symlinked.worktreePath, 'artifacts'))
    expect(() => materializeWorkerInputAttachments(config, symlinked)).toThrow(
      'not a real directory',
    )
    expect(existsSync(join(outsideDirectory, 'admin-issue-225'))).toBe(false)
  })

  it('notices newly embedded issue-body media and a later removal without replaying known images', () => {
    const issue = record()
    const repository = 'SFenton/ha-sfenton-react-dash'
    const url = 'https://github.com/user-attachments/assets/11111111-1111-1111-1111-111111111111'
    const withImage = `Full issue report\n\n![Image](${url})`
    const first = issueBodyMediaPlan(issue, issue.issueNumber, withImage, repository)
    expect(first.needsInput).toBe(true)
    expect(first.newReferences).toHaveLength(1)
    issue.inputs[0].attachments = [{
      githubUrl: url,
      id: '11111111-1111-4111-8111-111111111111',
      localPath: '/tmp/controller/input-attachments/image.png',
      mediaType: 'image/png',
      name: 'Image',
      sha256: 'a'.repeat(64),
      sizeBytes: 123,
    }]
    const known = issueBodyMediaPlan(issue, issue.issueNumber, withImage, repository)
    expect(known.needsInput).toBe(false)
    issue.issueBodySha256 = known.bodySha256
    expect(issueBodyMediaPlan(issue, issue.issueNumber, withImage, repository).needsInput).toBe(false)
    issue.inputs.push({
      body: withImage,
      createdAt: '2026-09-23T21:00:00.000Z',
      externalId: 'issue-body:321:first',
      mediaFindings: [{
        id: 'b'.repeat(32),
        label: 'Image',
        occurrence: 0,
        placement: 'image',
        reason: 'Initial input predates media handling',
        status: 'unsupported',
      }],
      revision: 2,
      source: 'issue-body',
      sourceKey: 'issue:321',
    })
    const removed = issueBodyMediaPlan(issue, issue.issueNumber, 'Image removed', repository)
    expect(removed.needsInput).toBe(true)
    expect(removed.newReferences).toEqual([])
    issue.inputs.push({
      body: 'Image removed',
      createdAt: '2026-09-23T21:02:00.000Z',
      externalId: mediaSourceExternalId('issue', 321, '2026-09-23T21:02:00.000Z', 'Image removed'),
      mediaFindings: [],
      revision: 3,
      source: 'issue-body',
      sourceKey: 'issue:321',
    })
    issue.issueBodySha256 = removed.bodySha256
    const restored = issueBodyMediaPlan(issue, issue.issueNumber, withImage, repository)
    expect(restored.needsInput).toBe(true)
    expect(restored.newReferences).toHaveLength(1)
    expect(mediaSourceExternalId('issue', 321, '2026-09-23T21:00:00.000Z', withImage))
      .not.toBe(mediaSourceExternalId('issue', 321, '2026-09-23T21:04:00.000Z', withImage))
  })

  it('treats a later owner-comment edit or reversion as a new idempotent input', () => {
    const issue = record()
    const sourceKey = 'comment:123'
    const first = 'Original owner note'
    const second = 'Corrected owner note'
    const at = '2026-09-23T21:00:00.000Z'
    const firstId = mediaSourceExternalId('comment', 123, at, first)
    appendIssueInput(issue, {
      body: first,
      bodySha256: createHash('sha256').update(first).digest('hex'),
      createdAt: at,
      externalId: firstId,
      mediaFindings: [],
      source: 'issue-comment',
      sourceKey,
      sourceUpdatedAt: at,
    })
    expect(mediaInputRequired(issue, sourceKey, first, [])).toBe(false)
    expect(mediaInputRequired(issue, sourceKey, second, [])).toBe(true)
    const secondAt = '2026-09-23T21:02:00.000Z'
    const secondId = mediaSourceExternalId('comment', 123, secondAt, second)
    expect(secondId).not.toBe(firstId)
    appendIssueInput(issue, {
      body: second,
      bodySha256: createHash('sha256').update(second).digest('hex'),
      createdAt: secondAt,
      externalId: secondId,
      mediaFindings: [],
      source: 'issue-comment',
      sourceKey,
      sourceUpdatedAt: secondAt,
    })
    expect(mediaInputRequired(issue, sourceKey, first, [])).toBe(true)
    expect(mediaSourceExternalId('comment', 123, '2026-09-23T21:04:00.000Z', first))
      .not.toBe(firstId)
  })

  it('reports unsupported embedded media instead of silently authorizing a result', async () => {
    const issue = record()
    const body = '<img src="http://127.0.0.1:8123/api/camera">'
    const config = {
      repository: 'SFenton/ha-sfenton-react-dash',
      repositoryPath: '/tmp',
      stateDirectory: '/tmp',
    }
    const media = await prepareGitHubMediaInput(
      config,
      issue,
      'comment:99',
      '2026-09-23T21:00:00.000Z',
      body,
    )
    expect(media.attachments).toBeUndefined()
    expect(media.mediaFindings).toMatchObject([
      { placement: 'image', status: 'unsupported' },
    ])
    appendIssueInput(issue, {
      ...media,
      body,
      createdAt: '2026-09-23T21:00:00.000Z',
      externalId: 'comment:99:v3:test',
      source: 'issue-comment',
    })
    expect(unreviewableIssueMedia(issue)).toHaveLength(1)
    expect(buildWorkerPrompt(issue)).toContain('Media the controller could not make available')
    expect(() => assertAdminIssueControllerState(controllerState(issue))).not.toThrow()
  })

  it('teaches the dedicated worker to inspect attached media rather than names or links', () => {
    const skill = readFileSync(resolve('ops/admin-issue-controller/tandem-research/SKILL.md'), 'utf8')
    expect(skill).toContain('native image attachments')
    expect(skill).toContain('Inspect the attached pixels, not merely a path')
    expect(skill).toContain('unsupported media')
    expect(skill).toContain('GPT-5.6 Luna `medium/default`')
    expect(skill).toContain('not the global guarded Sol/Opus tandem')
    expect(skill).not.toContain('Astra')
  })

  it('preserves duplicate media contexts but downloads a GitHub asset once per input', async () => {
    const root = mkdtempSync(join(homedir(), '.admin-issue-media-dedup-test-'))
    temporaryDirectories.push(root)
    const issue = record()
    const githubUrl = 'https://github.com/user-attachments/assets/11111111-1111-1111-1111-111111111111'
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlO89sAAAAASUVORK5CYII=',
      'base64',
    )
    let downloads = 0
    const fetcher: typeof fetch = async () => {
      downloads += 1
      return new Response(new Uint8Array(png), {
        headers: { 'content-type': 'image/png' },
      })
    }
    const config = {
      repository: 'SFenton/ha-sfenton-react-dash',
      repositoryPath: root,
      stateDirectory: join(root, 'state'),
    }
    const body = `![First](${githubUrl})\n\n<img alt="Second" src="${githubUrl}">`
    const media = await prepareGitHubMediaInput(config, issue, 'comment:100',
      '2026-09-23T20:31:01.000Z', body, { fetcher, token: 'test-token' })
    expect(downloads).toBe(1)
    expect(media.attachments).toHaveLength(1)
    expect(media.mediaFindings).toHaveLength(2)
    expect(media.mediaFindings.map((finding) => finding.label)).toEqual(['First', 'Second'])
    expect(media.mediaFindings.map((finding) => finding.attachmentId))
      .toEqual([media.attachments?.[0].id, media.attachments?.[0].id])
    appendIssueInput(issue, {
      ...media,
      body,
      createdAt: '2026-09-23T20:31:01.000Z',
      externalId: 'comment:100:v3:dedup',
      source: 'issue-comment',
    })
    expect(() => assertAdminIssueControllerState(controllerState(issue))).not.toThrow()

    const excessive = Array.from({ length: 9 }, (_, index) =>
      `![Image](https://github.com/user-attachments/assets/${String(index).padStart(8, '0')}-1111-1111-1111-111111111111)`)
      .join('\n\n')
    await expect(prepareGitHubMediaInput(config, issue, 'comment:101',
      '2026-09-23T20:32:00.000Z', excessive, { fetcher, token: 'test-token' }))
      .rejects.toThrow('more than eight')
  })

  it('preserves a paused published candidate if its worktree or remote changed before replay', () => {
    const issue = record()
    authorizeRecord(issue)
    issue.phase = 'paused'
    issue.branch = 'copilot/admin-todo-321-g1-map'
    if (issue.provenance.kind !== 'active' || !issue.provenance.candidate) {
      throw new Error('Expected paused active candidate')
    }
    const candidate = issue.provenance.candidate
    candidate.pushAttempted = true
    candidate.publishedHeadSha = candidate.headSha
    const snapshot = {
      branch: issue.branch,
      gitOperations: [],
      headSha: candidate.headSha,
      status: '',
      treeSha: candidate.treeSha,
    }
    expect(() => assertPausedCandidateUnchanged(issue, snapshot, candidate.headSha)).not.toThrow()
    expect(() => assertPausedCandidateUnchanged(issue, snapshot, undefined)).toThrow(
      'remote branch changed',
    )
    expect(() => assertPausedCandidateUnchanged(issue, { ...snapshot, status: 'dirty' }, candidate.headSha))
      .toThrow('worktree changed')
  })

  it('deduplicates inputs and advances revisions monotonically', () => {
    const issue = record()
    expect(
      appendIssueInput(issue, {
        body: 'Use the existing spacing token.',
        createdAt: '2026-09-20T12:01:00.000Z',
        externalId: 'comment:9',
        source: 'issue-comment',
      }),
    ).toBe(true)
    expect(
      appendIssueInput(issue, {
        body: 'duplicate delivery',
        createdAt: '2026-09-20T12:02:00.000Z',
        externalId: 'comment:9',
        source: 'issue-comment',
      }),
    ).toBe(false)
    expect(issue.inputRevision).toBe(2)
    expect(pendingIssueInputs(issue).map((input) => input.revision)).toEqual([1, 2])

    markIssueInputsProcessed(issue, 2, '2026-09-20T12:03:00.000Z')
    expect(pendingIssueInputs(issue)).toEqual([])
    expect(issue.inputs.every((input) => input.processedAt)).toBe(true)
    expect(() => markIssueInputsProcessed(issue, 1, '2026-09-20T12:04:00.000Z')).toThrow(
      'cannot move backwards',
    )
  })

  it('baselines existing UIDs and starts clean recovery generations', () => {
    expect(
      baselineAdminIssueState(
        [' existing-2 ', 'existing-1', 'existing-2', ''],
        '2026-09-20T12:00:00.000Z',
      ),
    ).toEqual({
      baselineCompletedAt: '2026-09-20T12:00:00.000Z',
      ignoredUids: ['existing-1', 'existing-2'],
      issues: {},
      updatedAt: '2026-09-20T12:00:00.000Z',
      version: 3,
    })

    const issue = record()
    issue.branch = 'copilot/admin-todo-321-g1-fix'
    issue.worktreePath = '/tmp/worktree'
    authorizeRecord(issue)
    issue.lastOutcome = parseWorkerOutcome(
      JSON.stringify({
        decision: 'blocked',
        iosFollowUp: { reason: '', required: false },
        questions: [],
        reason: 'Blocked.',
        schemaVersion: 1,
        summary: 'Blocked.',
      }),
    )
    issue.repairAttempts = 2
    issue.receipts.awaitingIosVerificationAt = '2026-09-20T12:01:00.000Z'
    issue.receipts.checksPassedAt = '2026-09-20T12:01:00.000Z'
    issue.receipts.deployedAt = '2026-09-20T12:01:00.000Z'
    issue.receipts.layoutValidatedAt = '2026-09-20T12:01:00.000Z'
    const sessionName = issue.sessionName

    beginAdminIssueGeneration(issue, '2026-09-20T12:02:00.000Z')

    expect(issue).toMatchObject({
      branch: undefined,
      generation: 2,
      phase: 'queued',
      pr: undefined,
      provenance: { kind: 'none' },
      repairAttempts: 0,
      sessionName,
      updatedAt: '2026-09-20T12:02:00.000Z',
      worktreePath: undefined,
    })
    expect(issue.receipts.awaitingIosVerificationAt).toBeUndefined()
    expect(issue.receipts.checksPassedAt).toBeUndefined()
    expect(issue.receipts.deployedAt).toBeUndefined()
    expect(issue.receipts.layoutValidatedAt).toBeUndefined()
  })

  it('migrates version-1 state without granting legacy provenance', () => {
    const active = record()
    const legacyRecord = JSON.parse(JSON.stringify(active)) as Record<string, unknown>
    delete legacyRecord.provenance
    const legacyState = {
      activeUid: active.uid,
      baselineCompletedAt: active.createdAt,
      ignoredUids: [],
      issues: {
        [active.uid]: {
          ...legacyRecord,
          baseSha: 'a'.repeat(40),
          phase: 'pull-request',
          pr: {
            headSha: 'b'.repeat(40),
            mergeSha: 'c'.repeat(40),
            number: 400,
            url: 'https://github.com/SFenton/ha-sfenton-react-dash/pull/400',
          },
          receipts: {
            checksPassedAt: '2026-09-20T12:04:00.000Z',
            validatedAt: '2026-09-20T12:03:00.000Z',
          },
        },
      },
      updatedAt: active.updatedAt,
      version: 1,
    }
    const migratedAt = '2026-09-21T12:00:00.000Z'
    const migrated = migrateAdminIssueControllerState(legacyState, migratedAt)
    expect(migrated.version).toBe(3)
    expect(migrated.issues[active.uid].pr).toEqual({
      number: 400,
      url: 'https://github.com/SFenton/ha-sfenton-react-dash/pull/400',
    })
    expect(migrated.issues[active.uid].provenance).toEqual({
      kind: 'legacy-untrusted',
      migratedAt,
      observedBaseSha: 'a'.repeat(40),
      observedHeadSha: 'b'.repeat(40),
      observedMergeSha: 'c'.repeat(40),
      reason: 'v1-missing-exact-provenance',
    })
    expect(() => assertCandidateAuthorized(migrated.issues[active.uid])).toThrow(
      'active provenance',
    )
    expect(() => assertAdminIssueControllerState(migrated)).not.toThrow()
  })

  it('backs up version-1 state before its one-way migration', () => {
    const stateDirectory = mkdtempSync(join(homedir(), '.admin-issue-controller-state-test-'))
    temporaryDirectories.push(stateDirectory)
    const pristine = record()
    const legacyRecord = JSON.parse(JSON.stringify(pristine)) as Record<string, unknown>
    delete legacyRecord.provenance
    writeFileSync(
      join(stateDirectory, 'state.json'),
      JSON.stringify({
        baselineCompletedAt: pristine.createdAt,
        ignoredUids: [],
        issues: { [pristine.uid]: legacyRecord },
        updatedAt: pristine.updatedAt,
        version: 1,
      }),
      { mode: 0o600 },
    )
    const config = {
      stateDirectory,
    } as Parameters<typeof loadAdminIssueControllerState>[0]
    expect(() => loadAdminIssueControllerState(config)).toThrow('requires a locked run')
    const migrated = loadAdminIssueControllerState(config, true)
    expect(migrated.version).toBe(3)
    expect(migrated.issues[pristine.uid].provenance).toEqual({ kind: 'none' })
    const backups = readdirSync(stateDirectory).filter((entry) =>
      entry.startsWith('state.v1-backup-'),
    )
    expect(backups).toHaveLength(1)
    expect(statSync(join(stateDirectory, backups[0])).mode & 0o777).toBe(0o600)
    expect(JSON.parse(readFileSync(join(stateDirectory, 'state.json'), 'utf8')).version).toBe(3)
  })

  it('backs up v2 and retains a paused published PR and exact provenance on migration', () => {
    const stateDirectory = mkdtempSync(join(homedir(), '.admin-issue-controller-v2-media-test-'))
    temporaryDirectories.push(stateDirectory)
    const issue = record()
    authorizeRecord(issue)
    if (issue.provenance.kind !== 'active' || !issue.provenance.candidate) {
      throw new Error('Expected active candidate')
    }
    issue.phase = 'paused'
    issue.pr = {
      number: 228,
      url: 'https://github.com/SFenton/ha-sfenton-react-dash/pull/228',
    }
    issue.receipts.manuallyClosedAt = '2026-09-23T21:13:30.000Z'
    issue.provenance.candidate.pushAttempted = true
    issue.provenance.candidate.publishedHeadSha = issue.provenance.candidate.headSha
    issue.provenance.candidate.checks = undefined
    issue.provenance.merge = undefined
    issue.provenance.deployment = undefined
    const legacyV2 = { ...controllerState(issue), version: 2 }
    writeFileSync(join(stateDirectory, 'state.json'), JSON.stringify(legacyV2), { mode: 0o600 })
    const config = {
      stateDirectory,
    } as Parameters<typeof loadAdminIssueControllerState>[0]
    expect(() => loadAdminIssueControllerState(config)).toThrow('requires a locked run')
    const migrated = loadAdminIssueControllerState(config, true)
    expect(migrated.version).toBe(3)
    expect(migrated.activeUid).toBe(issue.uid)
    expect(migrated.issues[issue.uid]).toEqual(issue)
    expect(migrated.issues[issue.uid].phase).toBe('paused')
    const backups = readdirSync(stateDirectory).filter((entry) =>
      entry.startsWith('state.v2-backup-'),
    )
    expect(backups).toHaveLength(1)
    expect(statSync(join(stateDirectory, backups[0])).mode & 0o777).toBe(0o600)
    expect(JSON.parse(readFileSync(join(stateDirectory, backups[0]), 'utf8')).version).toBe(2)
    expect(JSON.parse(readFileSync(join(stateDirectory, 'state.json'), 'utf8')).version).toBe(3)
    expect(() => loadAdminIssueControllerState(config, true)).not.toThrow()
    expect(readdirSync(stateDirectory).filter((entry) =>
      entry.startsWith('state.v2-backup-'))).toHaveLength(1)
  })

  it('binds candidate, checks, merge, and deployment to one exact identity', () => {
    const issue = record()
    authorizeRecord(issue)
    expect(() => assertCandidateAuthorized(issue, true)).not.toThrow()
    expect(() => assertFinalizationAuthorized(issue)).not.toThrow()
    if (issue.provenance.kind !== 'active' || !issue.provenance.candidate?.checks) {
      throw new Error('Expected authorized record')
    }
    issue.provenance.candidate.checks.headSha = 'f'.repeat(40)
    expect(() => assertCandidateAuthorized(issue, true)).toThrow(
      'Checks head does not match candidate',
    )
    issue.provenance.candidate.checks.headSha = issue.provenance.candidate.headSha
    if (!issue.provenance.deployment) throw new Error('Expected deployment')
    issue.provenance.deployment.sourceSha = 'f'.repeat(40)
    expect(() => assertFinalizationAuthorized(issue)).toThrow(
      'Deployment source does not match merge',
    )
  })

  it('authorizes a separately verified descendant deployment binding', () => {
    const issue = record()
    authorizeRecord(issue)
    if (issue.provenance.kind !== 'active' || !issue.provenance.deployment) {
      throw new Error('Expected deployment')
    }
    issue.provenance.deployment = {
      ...issue.provenance.deployment,
      coverage: 'descendant',
      coverageVerifiedAt: '2026-09-20T12:06:00.000Z',
      deployedSha: 'f'.repeat(40),
      sourceSha: 'e'.repeat(40),
      workflowHeadSha: 'e'.repeat(40),
    }
    expect(() => assertAdminIssueControllerState(controllerState(issue))).not.toThrow()
    expect(() => assertFinalizationAuthorized(issue)).not.toThrow()

    issue.provenance.deployment.sourceSha = 'a'.repeat(40)
    expect(() => assertFinalizationAuthorized(issue)).toThrow(
      'Descendant deployment source does not match workflow head',
    )
  })

  it('authorizes exact post-merge layout validation without a dashboard deployment', () => {
    const issue = record()
    authorizeRecord(issue)
    issue.automationKind = 'layout'
    issue.origin = 'github-automation'
    if (issue.provenance.kind !== 'active' || !issue.provenance.merge) {
      throw new Error('Expected merge provenance')
    }
    delete issue.provenance.deployment
    issue.provenance.layoutValidation = {
      conclusion: 'success',
      epoch: issue.provenance.epoch,
      generation: issue.generation,
      mergeSha: issue.provenance.merge.mergeSha,
      observedAt: '2026-09-20T12:06:00.000Z',
      revision: issue.processedRevision,
      workflowHeadSha: issue.provenance.merge.mergeSha,
      workflowRunAttempt: 1,
      workflowRunId: 24,
      workflowUrl: 'https://github.com/SFenton/ha-sfenton-react-dash/actions/runs/24',
    }
    expect(() => assertAdminIssueControllerState(controllerState(issue))).not.toThrow()
    expect(() => assertLayoutFinalizationAuthorized(issue)).not.toThrow()
    expect(() => assertFinalizationAuthorized(issue)).toThrow(
      'Issue does not have a verified deployment',
    )

    issue.provenance.layoutValidation.workflowHeadSha = 'f'.repeat(40)
    expect(() => assertLayoutFinalizationAuthorized(issue)).toThrow(
      'Layout validation workflow head does not match merge',
    )
  })

  it('accepts only non-controller comments from the pinned repository owner', () => {
    const trusted = {
      author_association: 'OWNER',
      body: 'Use the compact option.',
      created_at: '2026-09-20T12:00:00Z',
      id: 9,
      user: { id: 3988463, login: 'SFenton' },
    }
    expect(isTrustedIssueComment(trusted, 3988463, 'SFenton')).toBe(true)
    expect(isTrustedIssueComment({ ...trusted, author_association: 'MEMBER' }, 3988463, 'SFenton')).toBe(false)
    expect(isTrustedIssueComment({ ...trusted, user: { id: 1, login: 'SFenton' } }, 3988463, 'SFenton')).toBe(false)
    expect(
      isTrustedIssueComment(
        { ...trusted, body: `${CONTROLLER_COMMENT_MARKER}\nAutomated update` },
        3988463,
        'SFenton',
      ),
    ).toBe(false)
    expect(
      isTrustedIssueComment(
        { ...trusted, body: controllerReceiptMarker('task-1', 'todo-update') },
        3988463,
        'SFenton',
      ),
    ).toBe(false)
  })

  it('strictly parses question, blocked, and release-ready worker outcomes', () => {
    const questions = parseWorkerOutcome(
      JSON.stringify({
        decision: 'needs_input',
        iosFollowUp: { reason: '', required: false },
        questions: [
          {
            options: ['Keep current density', 'Increase all page spacing'],
            question: 'Should the change remain scoped to terminal spacing?',
            recommendation: 'Keep current density',
          },
        ],
        schemaVersion: 1,
        summary: 'One product choice remains.',
      }),
    )
    expect(questions.decision).toBe('needs_input')

    const blocked = parseWorkerOutcome(
      JSON.stringify({
        decision: 'blocked',
        iosFollowUp: { reason: 'Needs a physical device.', required: true },
        questions: [],
        reason: 'The behavior cannot be reproduced in the available environment.',
        schemaVersion: 1,
        summary: 'Physical verification is unavailable.',
      }),
    )
    expect(blocked.decision).toBe('blocked')

    const resolved = parseWorkerOutcome(
      JSON.stringify({
        decision: 'resolved_without_pr',
        iosFollowUp: { reason: 'An iPhone was involved.', required: true },
        issueTitle: 'Keep clean-water tasks guarded in Home Assistant',
        questions: [],
        resolution: 'The guarded automation remains enabled and verified.',
        resolutionType: 'home_assistant',
        schemaVersion: 1,
        summary: 'Home Assistant owns the complete fix.',
        verification: ['The automation trace reached the guarded branch.'],
        visualEvidence: [],
      }),
    )
    expect(resolved).toMatchObject({
      decision: 'resolved_without_pr',
      issueTitle: 'Keep clean-water tasks guarded in Home Assistant',
      resolutionType: 'home_assistant',
    })

    const ready = parseWorkerOutcome(
      JSON.stringify({
        changeSummary: ['Aligned terminal spacing with the dock-to-navigation gap.'],
        decision: 'ready_for_pr',
        iosFollowUp: { reason: '', required: false },
        pr: { body: 'Fixes the terminal gap.', title: 'Fix terminal page spacing' },
        questions: [],
        review: { approved: true, findings: [] },
        schemaVersion: 1,
        summary: 'The spacing is now consistent.',
        tests: [{ command: 'npx playwright test e2e/feedback-regressions.spec.ts', result: 'passed' }],
        visualChange: { reason: 'The spacing correction is visible.', required: true },
        visualEvidence: [
          {
            alt: 'Phone page with matching bottom gaps',
            caption: 'Mock evidence: 393 by 852 phone viewport.',
            path: 'artifacts/admin-issue-321/fixed-phone.png',
          },
        ],
      }),
    )
    expect(ready).toMatchObject({
      changeSummary: ['Aligned terminal spacing with the dock-to-navigation gap.'],
      decision: 'ready_for_pr',
      visualChange: { required: true },
      visualEvidence: [
        {
          path: 'artifacts/admin-issue-321/fixed-phone.png',
        },
      ],
    })

    expect(() =>
      parseWorkerOutcome(
        JSON.stringify({
          changeSummary: ['Changed CSS.'],
          decision: 'ready_for_pr',
          iosFollowUp: { reason: '', required: false },
          pr: { body: 'Body', title: 'Title' },
          questions: [],
          review: { approved: false, findings: ['Regression risk remains.'] },
          schemaVersion: 1,
          summary: 'Not ready.',
          tests: [{ command: 'npm test', result: 'passed' }],
        }),
      ),
    ).toThrow('review must approve')
    expect(() =>
      parseWorkerOutcome(
        JSON.stringify({
          changeSummary: ['Changed CSS.'],
          decision: 'ready_for_pr',
          iosFollowUp: { reason: '', required: false },
          pr: { body: 'Body', title: 'Title' },
          questions: [],
          review: { approved: true, findings: [] },
          schemaVersion: 1,
          summary: 'Tests still fail.',
          tests: [{ command: 'npm test', result: 'failed' }],
        }),
      ),
    ).toThrow('result must be passed')
    expect(() =>
      parseWorkerOutcome(
        JSON.stringify({
          changeSummary: ['Changed CSS.'],
          decision: 'ready_for_pr',
          iosFollowUp: { reason: '', required: false },
          pr: { body: 'Body', title: 'Title' },
          questions: [],
          review: { approved: true, findings: [] },
          schemaVersion: 1,
          summary: 'Ready.',
          tests: [{ command: 'npm test', result: 'passed' }],
          visualEvidence: [
            {
              alt: 'Unsafe image',
              caption: 'Mock evidence: unsafe path.',
              path: '../fixed.png',
            },
          ],
        }),
      ),
    ).toThrow('must be an image below')
  })

  it('formats idempotent issue comments with decision and release evidence', () => {
    const issue = record()
    const questionOutcome = parseWorkerOutcome(
      JSON.stringify({
        decision: 'needs_input',
        iosFollowUp: { reason: '', required: false },
        questions: [
          {
            options: ['A', 'B'],
            question: 'Choose a layout.',
            recommendation: 'A',
          },
        ],
        schemaVersion: 1,
        summary: 'A layout choice is needed.',
      }),
    )
    if (questionOutcome.decision !== 'needs_input') throw new Error('Expected needs_input')
    expect(
      formatQuestionsComment(issue.uid, issue.inputRevision, questionOutcome),
    ).toContain('Reply in a new comment')

    const blockedOutcome = parseWorkerOutcome(
      JSON.stringify({
        decision: 'blocked',
        iosFollowUp: { reason: '', required: false },
        questions: [],
        reason: 'Missing fixture.',
        schemaVersion: 1,
        summary: 'Validation is blocked.',
      }),
    )
    if (blockedOutcome.decision !== 'blocked') throw new Error('Expected blocked')
    expect(formatBlockedComment(issue.uid, issue.inputRevision, blockedOutcome)).toContain(
      '## Automation blocked',
    )

    const resolvedOutcome = parseWorkerOutcome(
      JSON.stringify({
        decision: 'resolved_without_pr',
        iosFollowUp: { reason: '', required: false },
        issueTitle: 'Keep clean-water tasks guarded in Home Assistant',
        questions: [],
        resolution: 'The Home Assistant automation was corrected and verified.',
        resolutionType: 'home_assistant',
        schemaVersion: 1,
        summary: 'No repository change is needed.',
        verification: ['The live trace completed without creating an incorrect task.'],
        visualEvidence: [],
      }),
    )
    if (resolvedOutcome.decision !== 'resolved_without_pr') throw new Error('Expected no-PR resolution')
    expect(
      formatResolvedWithoutPrComment(issue.uid, issue.inputRevision, resolvedOutcome),
    ).toContain('## Resolved without a pull request')

    const readyOutcome = parseWorkerOutcome(
      JSON.stringify({
        changeSummary: ['Changed spacing.'],
        decision: 'ready_for_pr',
        iosFollowUp: { reason: '', required: false },
        pr: { body: 'Body', title: 'Title' },
        questions: [],
        review: { approved: true, findings: [] },
        schemaVersion: 1,
        summary: 'Fixed.',
        tests: [{ command: 'npm test', result: 'passed' }],
      }),
    )
    if (readyOutcome.decision !== 'ready_for_pr') throw new Error('Expected ready_for_pr')
    issue.lastOutcome = readyOutcome
    authorizeRecord(issue)
    if (issue.provenance.kind !== 'active' || !issue.provenance.candidate?.visualEvidence) {
      throw new Error('Expected visual evidence')
    }
    const pullRequestComment = formatPullRequestComment(
      issue.uid,
      issue.inputRevision,
      issue.pr,
      readyOutcome,
      issue.provenance.candidate.visualEvidence,
    )
    expect(pullRequestComment).toContain(issue.pr.url)
    expect(pullRequestComment).toContain('## Proposed fixed behavior')
    expect(pullRequestComment).toContain(
      '![Fixed dashboard spacing](https://github.com/user-attachments/assets/',
    )
    expect(
      formatCompletionComment({
        deployment: {
          deployedSha: 'b'.repeat(40),
          disposition: 'forward',
          runId: 22,
          url: 'https://github.com/SFenton/ha-sfenton-react-dash/actions/runs/22',
        },
        issue,
      }),
    ).toContain('## Fixed and deployed')
    issue.automationKind = 'layout'
    issue.origin = 'github-automation'
    if (issue.provenance.kind !== 'active' || !issue.provenance.merge) {
      throw new Error('Expected merge provenance')
    }
    delete issue.provenance.deployment
    issue.provenance.layoutValidation = {
      conclusion: 'success',
      epoch: issue.provenance.epoch,
      generation: issue.generation,
      mergeSha: issue.provenance.merge.mergeSha,
      observedAt: '2026-09-20T12:06:00.000Z',
      revision: issue.processedRevision,
      workflowHeadSha: issue.provenance.merge.mergeSha,
      workflowRunAttempt: 1,
      workflowRunId: 24,
      workflowUrl: 'https://github.com/SFenton/ha-sfenton-react-dash/actions/runs/24',
    }
    expect(formatLayoutCompletionComment(issue)).toContain('## Fixed and validated')
    expect(formatLayoutCompletionComment(issue)).toContain(
      '**Post-merge layout validation:** https://github.com/SFenton/ha-sfenton-react-dash/actions/runs/24',
    )
  })

  it('replays a failed PR issue-comment publication without losing its receipt or PR', async () => {
    const issue = record()
    authorizeRecord(issue)
    issue.phase = 'pull-request'
    const outcome = parseWorkerOutcome(JSON.stringify({
      changeSummary: ['Corrected the visible layout.'],
      decision: 'ready_for_pr',
      iosFollowUp: { reason: '', required: false },
      pr: { body: 'Corrected layout.', title: 'Correct layout' },
      questions: [],
      review: { approved: true, findings: [] },
      schemaVersion: 1,
      summary: 'The layout was corrected.',
      tests: [{ command: 'npm run test:run', result: 'passed' }],
    }))
    if (outcome.decision !== 'ready_for_pr') throw new Error('Expected ready_for_pr')
    issue.lastOutcome = outcome
    issue.receipts.prCommentPendingAt = '2026-09-24T16:00:00.000Z'
    issue.receipts.prCommentRevision = String(issue.processedRevision)
    let attempts = 0
    let writes = 0
    const post = async (_receipt: string, body: string) => {
      attempts += 1
      if (attempts === 1) throw new Error('Transient issue-comment POST failure')
      return { body }
    }
    const persist = () => { writes += 1 }
    await expect(publishPullRequestIssueComment(issue, outcome, post, persist))
      .rejects.toThrow('Transient issue-comment POST failure')
    expect(issue.receipts.prCommentPendingAt).toBeDefined()
    expect(issue.phase).toBe('pull-request')
    await publishPullRequestIssueComment(issue, outcome, post, persist)
    expect(attempts).toBe(2)
    expect(writes).toBe(1)
    expect(issue.receipts.prCommentPendingAt).toBeUndefined()
    expect(issue.receipts.prCommentPublishedAt).toBeDefined()
    expect(issue.pr?.number).toBe(400)
  })

  it('allows no-PR completion only from an unchanged isolated base', () => {
    const issue = record()
    const baseSha = 'a'.repeat(40)
    issue.provenance = {
      epoch: 'epoch-1',
      generation: issue.generation,
      kind: 'active',
      preparedBaseSha: baseSha,
      resyncAttempts: 0,
      revision: issue.processedRevision,
    }
    const cleanSnapshot = {
      branch: 'copilot/admin-todo-321-g1-fix',
      gitOperations: [],
      headSha: baseSha,
      status: '',
      treeSha: 'b'.repeat(40),
    }
    expect(() =>
      assertResolvedWithoutPullRequestSnapshot(issue, cleanSnapshot, [])
    ).not.toThrow()
    expect(() =>
      assertResolvedWithoutPullRequestSnapshot(issue, cleanSnapshot, ['src/App.tsx'])
    ).toThrow('left repository changes')
    issue.pr = {
      number: 400,
      url: 'https://github.com/SFenton/ha-sfenton-react-dash/pull/400',
    }
    expect(() =>
      assertResolvedWithoutPullRequestSnapshot(issue, cleanSnapshot, [])
    ).toThrow('cannot retain candidate')
  })

  it('skips Home Assistant completion for workflow-filed issues', () => {
    const issue = record()
    expect(adminTodoCompletionRequired(issue)).toBe(true)
    issue.origin = 'github-automation'
    expect(adminTodoCompletionRequired(issue)).toBe(false)
  })

  it('requires the complete deployment receipt boundary', () => {
    const sha = 'a'.repeat(40)
    const receipt = {
      deploymentHash: 'c'.repeat(64),
      deployedAt: '2026-09-20T12:00:00.000Z',
      deployedSha: sha,
      disposition: 'forward',
      leaseReleased: true,
      manifestHash: 'd'.repeat(64),
      panelRegistered: true,
      runAttempt: 2,
      runId: '123',
      sourceSha: sha,
      status: 'success',
      verifiedPaths: [...REQUIRED_DEPLOYMENT_VERIFIED_PATHS, 'assets/app.js'],
      version: 2,
    }
    expect(deploymentReceiptIsAccepted(receipt, sha, { id: 123, runAttempt: 2 })).toBe(true)
    expect(deploymentReceiptIsAccepted({ ...receipt, leaseReleased: false }, sha)).toBe(false)
    expect(deploymentReceiptIsAccepted({ ...receipt, sourceSha: 'b'.repeat(40) }, sha)).toBe(false)
    expect(deploymentReceiptIsAccepted({ ...receipt, verifiedPaths: [] }, sha)).toBe(false)
    expect(
      deploymentReceiptIsAccepted(
        {
          ...receipt,
          verifiedPaths: receipt.verifiedPaths.filter((path) => path !== 'sfenton-react-panel.js'),
        },
        sha,
      ),
    ).toBe(false)
    expect(
      deploymentReceiptIsAccepted(receipt, sha, { id: 124, runAttempt: 2 }),
    ).toBe(false)
  })

  it('treats a completed failed deployment as a terminal blocked record', () => {
    let failure: unknown
    try {
      assertDeploymentRunSucceeded({
        conclusion: 'failure',
        html_url: 'https://github.com/SFenton/ha-sfenton-react-dash/actions/runs/123',
      })
    } catch (error) {
      failure = error
    }
    expect(failure).toBeInstanceOf(AdminIssueDeploymentRunError)
    expect(failure).toBeInstanceOf(AdminIssueProvenanceError)
    expect(() =>
      assertDeploymentRunSucceeded({
        conclusion: 'success',
        html_url: 'https://github.com/SFenton/ha-sfenton-react-dash/actions/runs/123',
      }),
    ).not.toThrow()
  })

  it('recognizes throttled recovery for a deployment-blocked merged issue', () => {
    const issue = record()
    authorizeRecord(issue)
    if (issue.provenance.kind !== 'active') throw new Error('Expected active provenance')
    issue.provenance.deployment = undefined
    issue.phase = 'blocked'
    issue.lastOutcome = {
      decision: 'blocked',
      iosFollowUp: { reason: '', required: false },
      questions: [],
      reason: 'Deployment run https://github.com/example/actions/runs/123 concluded failure',
      schemaVersion: 1,
      summary: 'Deployment failed.',
      visualEvidence: [],
    }
    expect(hasRecoverableDeployment(issue)).toBe(true)
    expect(deploymentRecoveryDue(issue, Date.parse('2026-09-20T12:10:00.000Z'))).toBe(true)
    issue.receipts.deploymentRecoveryCheckedAt = '2026-09-20T12:08:00.000Z'
    expect(deploymentRecoveryDue(issue, Date.parse('2026-09-20T12:10:00.000Z'))).toBe(false)
    expect(deploymentRecoveryDue(issue, Date.parse('2026-09-20T12:14:00.000Z'))).toBe(true)

    issue.receipts.controllerBlockedReason =
      'No-PR resolution cannot retain candidate, pull-request, merge, or deployment state'
    issue.branch = 'copilot/admin-issue-321-g1'
    issue.worktreePath = '/tmp/admin-issue-321-g1'
    issue.workerRuns = 5
    expect(hasRecoverableDeployment(issue)).toBe(false)
    expect(hasRecoverableExistingRelease(issue)).toBe(true)
    issue.inputRevision += 1
    expect(hasRecoverableExistingRelease(issue)).toBe(false)
    issue.inputRevision = issue.processedRevision
    expect(existingReleaseRecoveryDue(issue, Date.parse('2026-09-20T12:10:00.000Z'))).toBe(true)
    issue.receipts.existingReleaseRecoveryCheckedAt = '2026-09-20T12:08:00.000Z'
    expect(existingReleaseRecoveryDue(issue, Date.parse('2026-09-20T12:10:00.000Z'))).toBe(false)
    expect(existingReleaseRecoveryDue(issue, Date.parse('2026-09-20T12:14:00.000Z'))).toBe(true)
    issue.phase = 'deploying'
    issue.receipts.existingReleaseAwaitingIosAt = '2026-09-20T12:09:00.000Z'
    issue.receipts.iosVerifiedAt = '2026-09-20T12:10:00.000Z'
    expect(existingReleaseRecoveryDue(issue, Date.parse('2026-09-20T12:10:00.000Z'))).toBe(true)
  })

  it('requires an unchanged retained candidate for existing-release closure', () => {
    const issue = record()
    authorizeRecord(issue)
    if (issue.provenance.kind !== 'active' || !issue.provenance.candidate) {
      throw new Error('Expected retained candidate')
    }
    issue.phase = 'blocked'
    issue.branch = 'copilot/admin-issue-321-g1'
    issue.worktreePath = '/tmp/admin-issue-321-g1'
    issue.workerRuns = 5
    issue.receipts.controllerBlockedReason =
      'No-PR resolution cannot retain candidate, pull-request, merge, or deployment state'
    const outcome = parseWorkerOutcome(JSON.stringify({
      decision: 'resolved_without_pr',
      iosFollowUp: { reason: '', required: false },
      issueTitle: 'Fix terminal page spacing',
      questions: [],
      resolution: 'The existing merged release already contains the verified fix.',
      resolutionType: 'no_repository_change',
      schemaVersion: 1,
      summary: 'No duplicate repository change is required.',
      verification: ['The prior pull request is merged and deployed.'],
      visualEvidence: [],
    }))
    const snapshot = {
      branch: issue.branch,
      gitOperations: [],
      headSha: issue.provenance.candidate.headSha,
      status: '',
      treeSha: issue.provenance.candidate.treeSha,
    }

    expect(() =>
      assertExistingReleaseVerificationSnapshot(issue, snapshot, outcome),
    ).not.toThrow()
    expect(() =>
      assertExistingReleaseVerificationSnapshot(
        issue,
        { ...snapshot, status: '? changed-file.ts' },
        outcome,
      ),
    ).toThrow('does not match the retained candidate')
    expect(() =>
      assertExistingReleaseVerificationSnapshot(
        issue,
        snapshot,
        parseWorkerOutcome(JSON.stringify({
          decision: 'blocked',
          iosFollowUp: { reason: '', required: false },
          questions: [],
          reason: 'Verification was inconclusive.',
          schemaVersion: 1,
          summary: 'Blocked.',
          visualEvidence: [],
        })),
      ),
    ).toThrow('no-change outcome')
  })

  it('requires controller-owned merged PR identity and successful protected checks', () => {
    const issue = record()
    issue.branch = 'copilot/admin-issue-321-g1'
    issue.pr = {
      number: 400,
      url: 'https://github.com/SFenton/ha-sfenton-react-dash/pull/400',
    }
    const finalHeadSha = 'e'.repeat(40)
    const mergeSha = 'f'.repeat(40)
    const pullRequest = {
      base: {
        ref: 'master',
        repo: { full_name: 'SFenton/ha-sfenton-react-dash' },
      },
      body: 'Tracked issue: #321\n\n<!-- admin-issue-controller:pr -->',
      draft: false,
      head: {
        ref: issue.branch,
        repo: { full_name: 'SFenton/ha-sfenton-react-dash' },
        sha: finalHeadSha,
      },
      html_url: issue.pr.url,
      merge_commit_sha: mergeSha,
      merged_at: '2026-09-20T12:05:00.000Z',
      number: issue.pr.number,
      state: 'closed' as const,
      user: { id: 123, login: 'SFenton' },
    }
    const mergeCommit = {
      parents: [{ sha: 'a'.repeat(40) }, { sha: finalHeadSha }],
      sha: mergeSha,
    }
    const config = {
      ownerId: 123,
      ownerLogin: 'SFenton',
      repository: 'SFenton/ha-sfenton-react-dash',
    }
    expect(() =>
      assertExistingReleasePullRequestEvidence(
        config,
        issue,
        pullRequest,
        mergeCommit,
      ),
    ).not.toThrow()
    expect(() =>
      assertExistingReleasePullRequestEvidence(
        config,
        issue,
        { ...pullRequest, user: { id: 456, login: 'other' } },
        mergeCommit,
      ),
    ).toThrow('identity or merged state')
    expect(() =>
      assertExistingReleasePullRequestEvidence(
        config,
        issue,
        { ...pullRequest, body: 'Unbound pull request' },
        mergeCommit,
      ),
    ).toThrow('identity or merged state')
    expect(() =>
      assertExistingReleasePullRequestEvidence(
        config,
        issue,
        pullRequest,
        {
          ...mergeCommit,
          parents: [{ sha: 'a'.repeat(40) }, { sha: '0'.repeat(40) }],
        },
      ),
    ).toThrow('does not bind the pull request head')

    const successfulCheck = {
      app: { id: 15368 },
      completed_at: '2026-09-20T12:04:00.000Z',
      conclusion: 'success',
      details_url: 'https://github.com/example/check/22',
      id: 22,
      name: 'Playwright gate',
      status: 'completed',
    }
    expect(
      assertSuccessfulRequiredChecksForHead(
        ['Playwright gate'],
        15368,
        finalHeadSha,
        [successfulCheck],
      ),
    ).toEqual([successfulCheck])
    expect(() =>
      assertSuccessfulRequiredChecksForHead(
        ['Playwright gate'],
        15368,
        finalHeadSha,
        [{ ...successfulCheck, conclusion: 'failure' }],
      ),
    ).toThrow('does not retain the required successful checks')
    expect(() =>
      assertSuccessfulRequiredChecksForHead(
        ['Playwright gate'],
        15368,
        finalHeadSha,
        [{ ...successfulCheck, app: { id: 99 } }],
      ),
    ).toThrow('does not retain the required successful checks')
  })

  it('recovers against the latest successful deployment instead of a newer failure', () => {
    expect(
      latestSuccessfulDeploymentRunPath(
        'SFenton/ha-sfenton-react-dash',
        'deploy-dashboard.yml',
      ),
    ).toBe(
      'repos/SFenton/ha-sfenton-react-dash/actions/workflows/deploy-dashboard.yml/runs?branch=master&event=push&status=success&per_page=1',
    )
  })

  it('binds layout validation to the exact protected master workflow run', () => {
    const mergeSha = 'd'.repeat(40)
    expect(
      layoutWorkflowRunsPath('SFenton/ha-sfenton-react-dash', mergeSha),
    ).toBe(
      `repos/SFenton/ha-sfenton-react-dash/actions/workflows/playwright.yml/runs?head_sha=${mergeSha}&event=push&per_page=20`,
    )
    const run = {
      conclusion: 'success',
      event: 'push',
      head_branch: 'master',
      head_sha: mergeSha,
      html_url: 'https://github.com/SFenton/ha-sfenton-react-dash/actions/runs/24',
      status: 'completed',
    }
    expect(() => assertSuccessfulLayoutWorkflowRun(run, mergeSha)).not.toThrow()
    expect(() =>
      assertSuccessfulLayoutWorkflowRun({ ...run, conclusion: 'failure' }, mergeSha),
    ).toThrow('concluded failure')
    expect(() =>
      assertSuccessfulLayoutWorkflowRun({ ...run, head_sha: 'f'.repeat(40) }, mergeSha),
    ).toThrow('does not bind exact merge')
  })

  it('restores the exact ready outcome from the retained successful worker log', () => {
    const stateDirectory = mkdtempSync(join(homedir(), '.admin-issue-controller-recovery-test-'))
    temporaryDirectories.push(stateDirectory)
    mkdirSync(join(stateDirectory, 'worker-logs'), { recursive: true })
    const issue = record()
    authorizeRecord(issue)
    if (issue.provenance.kind !== 'active') throw new Error('Expected active provenance')
    issue.provenance.deployment = undefined
    issue.phase = 'blocked'
    issue.workerRuns = 1
    issue.lastOutcome = {
      decision: 'blocked',
      iosFollowUp: { reason: '', required: false },
      questions: [],
      reason: 'Deployment run https://github.com/example/actions/runs/123 concluded failure',
      schemaVersion: 1,
      summary: 'Deployment failed.',
      visualEvidence: [],
    }
    const visualEvidence = issue.provenance.candidate?.visualEvidence?.map((evidence) => ({
      alt: evidence.alt,
      caption: evidence.caption,
      path: evidence.path,
    })) ?? []
    const readyOutcome = {
      changeSummary: ['Fixed the issue.'],
      decision: 'ready_for_pr',
      iosFollowUp: { reason: '', required: false },
      pr: { body: 'Body', title: 'Title' },
      questions: [],
      review: { approved: true, findings: [] },
      schemaVersion: 1,
      summary: 'Fixed.',
      tests: [{ command: 'npm test', result: 'passed' }],
      visualEvidence,
    }
    writeFileSync(
      join(stateDirectory, 'worker-logs', 'issue-321-run-1.jsonl'),
      `${JSON.stringify({
        data: { content: JSON.stringify(readyOutcome) },
        type: 'assistant.message',
      })}\n`,
    )
    expect(
      restoreReadyOutcomeFromWorkerLog({ stateDirectory }, issue).decision,
    ).toBe('ready_for_pr')
    expect(issue.lastOutcome?.decision).toBe('ready_for_pr')
  })

  it('verifies deployment ancestry with git rather than SHA ordering', async () => {
    const repository = mkdtempSync(join(homedir(), '.admin-issue-controller-ancestry-test-'))
    temporaryDirectories.push(repository)
    execFileSync('git', ['init', '--quiet'], { cwd: repository })
    execFileSync('git', ['config', 'user.name', 'Controller Test'], { cwd: repository })
    execFileSync('git', ['config', 'user.email', 'controller@example.invalid'], {
      cwd: repository,
    })
    writeFileSync(join(repository, 'one.txt'), 'one\n')
    execFileSync('git', ['add', 'one.txt'], { cwd: repository })
    execFileSync('git', ['commit', '--quiet', '-m', 'one'], { cwd: repository })
    const first = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: repository,
      encoding: 'utf8',
    }).trim()
    writeFileSync(join(repository, 'two.txt'), 'two\n')
    execFileSync('git', ['add', 'two.txt'], { cwd: repository })
    execFileSync('git', ['commit', '--quiet', '-m', 'two'], { cwd: repository })
    const second = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: repository,
      encoding: 'utf8',
    }).trim()

    await expect(commitIsAncestor(repository, first, second)).resolves.toBe(true)
    await expect(commitIsAncestor(repository, second, first)).resolves.toBe(false)
    const deployment = {
      receipt: {
        deployedAt: '2026-09-20T12:06:00.000Z',
        deployedSha: second,
      },
      run: {
        head_sha: second,
      },
    }
    await expect(
      assertDeploymentCoversMergeSha(
        { repositoryPath: repository },
        first,
        '2026-09-20T12:05:00.000Z',
        deployment,
        second,
      ),
    ).resolves.toBeUndefined()
    await expect(
      assertDeploymentCoversMergeSha(
        { repositoryPath: repository },
        second,
        '2026-09-20T12:05:00.000Z',
        {
          ...deployment,
          receipt: { ...deployment.receipt, deployedSha: first },
        },
        second,
      ),
    ).rejects.toThrow('does not contain the verified issue merge')
    await expect(
      assertDeploymentCoversMergeSha(
        { repositoryPath: repository },
        first,
        '2026-09-20T12:07:00.000Z',
        deployment,
        second,
      ),
    ).rejects.toThrow('predates the verified issue merge')
  })
})

describe('admin issue controller security configuration', () => {
  it('classifies dashboard runtime files for proposed-behavior evidence', () => {
    expect(candidateRequiresVisualEvidence(['src/App.tsx'])).toBe(true)
    expect(candidateRequiresVisualEvidence(['public/icon.svg'])).toBe(true)
    expect(candidateRequiresVisualEvidence(['index.html'])).toBe(true)
    expect(candidateRequiresVisualEvidence(['src/App.test.tsx', 'e2e/app.spec.ts', 'docs/app.md'])).toBe(false)
    expect(
      candidateRequiresVisualEvidence(
        ['src/components/hass/FocusController.tsx'],
        { reason: 'Focus restoration has no distinct visible state.', required: false },
      ),
    ).toBe(false)
    expect(
      candidateRequiresVisualEvidence(
        ['src/components/core/Page.module.css'],
        { reason: 'The worker incorrectly classified the change as invisible.', required: false },
      ),
    ).toBe(true)
  })

  it('authorizes iOS follow-up only for explicit browser-specific issue evidence', () => {
    const requested = {
      reason: 'Physical Safari keyboard behavior cannot be certified on Linux WebKit.',
      required: true,
    }
    expect(
      authorizedIosFollowUp(
        'The bottom action is obscured by the software keyboard on iPhone.',
        ['src/components/core/ModalSheet.tsx'],
        requested,
      ),
    ).toEqual(requested)
    expect(
      authorizedIosFollowUp(
        'The vacuum totals do not match and focus should return to the report.',
        ['src/components/hass/VacuumCard.tsx'],
        requested,
      ),
    ).toEqual({ reason: '', required: false })
    expect(
      authorizedIosFollowUp(
        'My iPhone never registered me as arriving home.',
        ['src/components/hass/VacuumCard.tsx'],
        requested,
      ),
    ).toEqual({ reason: '', required: false })
  })

  it('revokes persisted iOS gates that no longer satisfy the canonical issue policy', () => {
    const issue = record()
    authorizeRecord(issue)
    issue.phase = 'awaiting-user'
    issue.receipts.awaitingIosVerificationAt = '2026-09-20T12:06:00.000Z'
    issue.lastOutcome = {
      changeSummary: ['Balanced terminal spacing.'],
      decision: 'ready_for_pr',
      iosFollowUp: {
        reason: 'Physical Safari safe-area behavior requires manual verification.',
        required: true,
      },
      pr: { body: 'Fix terminal spacing.', title: 'Fix terminal spacing' },
      questions: [],
      review: { approved: true, findings: [] },
      schemaVersion: 1,
      summary: 'Balanced terminal spacing.',
      tests: [{ command: 'npm run test:change-policy', result: 'passed' }],
      visualChange: { reason: 'The spacing is visible.', required: true },
      visualEvidence: [],
    }

    appendIssueInput(issue, {
      body: [
        '## Autonomous repair policy update',
        '',
        'Resume this session under the hardened controller contract.',
        'The existing manual iOS follow-up remains.',
      ].join('\n'),
      createdAt: '2026-09-20T12:06:30.000Z',
      externalId: 'comment:policy',
      source: 'issue-comment',
    })
    appendIssueInput(issue, {
      body: '## Proposed fixed behavior\n\nMock iPhone Safari viewport evidence.',
      createdAt: '2026-09-20T12:06:45.000Z',
      externalId: 'comment:evidence',
      source: 'issue-comment',
    })
    const genericReport = canonicalIssueTextForIos(
      issue,
      '## Admin To-Do\n\nBalance terminal page spacing around Quick Links.',
    )
    expect(genericReport).not.toContain('manual iOS follow-up')
    expect(genericReport).not.toContain('Mock iPhone Safari viewport evidence')
    expect(reauthorizePersistedIosFollowUp(issue, genericReport)).toBe(true)
    expect(issue.lastOutcome.iosFollowUp).toEqual({ reason: '', required: false })
    expect(issue.receipts.awaitingIosVerificationAt).toBeUndefined()

    issue.lastOutcome.iosFollowUp = {
      reason: 'Physical Safari keyboard behavior cannot be certified on Linux WebKit.',
      required: true,
    }
    issue.receipts.awaitingIosVerificationAt = '2026-09-20T12:07:00.000Z'
    const iosReport = canonicalIssueTextForIos(
      issue,
      'The software keyboard on iPhone Safari obscures the modal action.',
    )
    expect(reauthorizePersistedIosFollowUp(issue, iosReport)).toBe(false)
    expect(issue.lastOutcome.iosFollowUp.required).toBe(true)
    expect(issue.receipts.awaitingIosVerificationAt).toBe(
      '2026-09-20T12:07:00.000Z',
    )
  })

  it('selects the substantive stable session when an empty duplicate name exists', () => {
    expect(
      selectWorkerSessionCandidate(
        [
          {
            id: '50eac06b-59ef-4236-8db6-1aef35d91c52',
            name: 'admin-issue-190-task',
            summaryCount: 0,
            updatedAt: '2026-09-22T14:24:07.801Z',
          },
          {
            id: 'e0642349-ed35-4b5a-b89e-0c5213b72a92',
            name: 'admin-issue-190-task',
            summaryCount: 1,
            updatedAt: '2026-09-22T14:03:39.202Z',
          },
        ],
        'admin-issue-190-task',
      )?.id,
    ).toBe('e0642349-ed35-4b5a-b89e-0c5213b72a92')
  })

  it('recovers a remotely existing stable session without renaming it', () => {
    const commonArgs = ['--model', 'gpt-5.6-sol', '-p', 'continue']
    expect(
      buildCopilotWorkerArgs(
        'fdc5c356-c9f0-42c1-8b54-492e5ea48f35',
        'admin-issue-167-task',
        commonArgs,
        false,
      ),
    ).toEqual([
      '--session-id=fdc5c356-c9f0-42c1-8b54-492e5ea48f35',
      '--name',
      'admin-issue-167-task',
      ...commonArgs,
    ])

    const conflict = {
      exitCode: 1,
      stderr:
        "error: option '-n, --name <name>' cannot be used with option '--session-id <id>' when it resolves to an existing or remote session or task.",
      stdout: '',
    }
    expect(shouldRetryWorkerSessionWithoutName(true, conflict)).toBe(true)
    expect(
      buildCopilotWorkerArgs(
        'fdc5c356-c9f0-42c1-8b54-492e5ea48f35',
        'admin-issue-167-task',
        commonArgs,
        true,
      ),
    ).toEqual([
      '--session-id=fdc5c356-c9f0-42c1-8b54-492e5ea48f35',
      ...commonArgs,
    ])
    expect(shouldRetryWorkerSessionWithoutName(false, conflict)).toBe(false)
    expect(
      shouldRetryWorkerSessionWithoutName(true, {
        ...conflict,
        stderr: 'error: authentication failed',
      }),
    ).toBe(false)
  })

  it('summarizes the useful failing assertion instead of leading setup logs', () => {
    const setup = Array.from({ length: 250 }, (_, index) => `setup line ${index}`).join('\n')
    const summary = summarizeFailedCheckLogs(
      `${setup}\n\u001B[31mFAIL\u001B[0m DailyReportModal.test.tsx\nAssertionError: expected empty to be visible\nTest Files 1 failed`,
    )
    expect(summary).toContain('AssertionError: expected empty to be visible')
    expect(summary).toContain('Test Files 1 failed')
    expect(summary).not.toContain('\u001B')
    expect(summary).not.toContain('setup line 0')
  })

  it('validates bounded issue-scoped visual evidence from real image bytes', () => {
    const worktreePath = mkdtempSync(join(homedir(), '.admin-issue-controller-evidence-test-'))
    temporaryDirectories.push(worktreePath)
    const evidenceDirectory = join(worktreePath, 'artifacts/admin-issue-321')
    mkdirSync(evidenceDirectory, { recursive: true })
    const pngBytes = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlO89sAAAAASUVORK5CYII=',
      'base64',
    )
    writeFileSync(join(evidenceDirectory, 'fixed.png'), pngBytes)
    const issue = record()
    issue.worktreePath = worktreePath
    const diff: AdminIssueDiffReceipt = {
      baseSha: 'a'.repeat(40),
      entryCount: 1,
      epoch: 'epoch-1',
      files: ['src/App.tsx'],
      generation: 1,
      headSha: 'b'.repeat(40),
      manifestSha256: '1'.repeat(64),
      mergeBaseSha: 'a'.repeat(40),
      revision: 1,
      treeSha: 'c'.repeat(40),
    }
    const drafts = [
      {
        alt: 'Fixed dashboard state',
        caption: 'Mock evidence: 393 by 852 phone viewport.',
        path: 'artifacts/admin-issue-321/fixed.png',
      },
    ]
    expect(collectVisualEvidenceReceipts(issue, diff, drafts)).toEqual([
      expect.objectContaining({
        diffManifestSha256: diff.manifestSha256,
        mediaType: 'image/png',
        path: drafts[0].path,
        sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
        sizeBytes: pngBytes.length,
      }),
    ])
    expect(() => collectVisualEvidenceReceipts(issue, diff, [])).toThrow(
      'require one to four',
    )
    expect(() =>
      collectVisualEvidenceReceipts(
        issue,
        { ...diff, files: ['src/App.test.tsx'] },
        [],
      ),
    ).not.toThrow()

    writeFileSync(join(worktreePath, 'outside.png'), pngBytes)
    symlinkSync(join(worktreePath, 'outside.png'), join(evidenceDirectory, 'linked.png'))
    expect(() =>
      collectVisualEvidenceReceipts(issue, diff, [
        {
          alt: 'Linked image',
          caption: 'Mock evidence: linked file.',
          path: 'artifacts/admin-issue-321/linked.png',
        },
      ]),
    ).toThrow('non-symlink')

    writeFileSync(join(evidenceDirectory, 'invalid.png'), 'not an image')
    expect(() =>
      collectVisualEvidenceReceipts(issue, diff, [
        {
          alt: 'Invalid image',
          caption: 'Mock evidence: invalid bytes.',
          path: 'artifacts/admin-issue-321/invalid.png',
        },
      ]),
    ).toThrow('valid PNG, JPEG, or WebP')

    writeFileSync(join(evidenceDirectory, 'large.png'), pngBytes)
    truncateSync(join(evidenceDirectory, 'large.png'), 10 * 1024 * 1024 + 1)
    expect(() =>
      collectVisualEvidenceReceipts(issue, diff, [
        {
          alt: 'Large image',
          caption: 'Mock evidence: oversized file.',
          path: 'artifacts/admin-issue-321/large.png',
        },
      ]),
    ).toThrow('10485760 bytes')

    writeFileSync(join(evidenceDirectory, 'duplicate.png'), pngBytes)
    expect(() =>
      collectVisualEvidenceReceipts(issue, diff, [
        drafts[0],
        {
          alt: 'Duplicate dashboard state',
          caption: 'Mock evidence: duplicate bytes.',
          path: 'artifacts/admin-issue-321/duplicate.png',
        },
      ]),
    ).toThrow('duplicate images')

    mkdirSync(join(worktreePath, 'artifacts/admin-issue-999'), { recursive: true })
    writeFileSync(join(worktreePath, 'artifacts/admin-issue-999/fixed.png'), pngBytes)
    expect(() =>
      collectVisualEvidenceReceipts(issue, diff, [
        {
          alt: 'Wrong issue image',
          caption: 'Mock evidence: wrong issue path.',
          path: 'artifacts/admin-issue-999/fixed.png',
        },
      ]),
    ).toThrow('artifacts/admin-issue-321')
  })

  it('requires published images in both the pull request and issue update', () => {
    const issue = record()
    authorizeRecord(issue)
    if (issue.provenance.kind !== 'active' || !issue.provenance.candidate?.visualEvidence) {
      throw new Error('Expected authorized visual evidence')
    }
    const evidence = issue.provenance.candidate.visualEvidence
    const body = pullRequestBodyWithVisualEvidence('Implements the fix.', evidence)
    expect(body).toContain('## Proposed fixed behavior')
    expect(body).toContain(evidence[0].url)
    expect(() => assertPullRequestContainsVisualEvidence(issue, { body })).not.toThrow()
    expect(() =>
      assertPullRequestContainsVisualEvidence(issue, { body: 'Implements the fix.' }),
    ).toThrow('missing the proposed fixed-behavior section')
    expect(() =>
      assertPullRequestContainsVisualEvidence(issue, {
        body: body.replace('![Fixed dashboard spacing]', '[Fixed dashboard spacing]'),
      }),
    ).toThrow('missing proposed fixed-behavior image')
    const issueComment = [
      '## Pull request opened',
      formatVisualEvidenceMarkdown(evidence),
    ].join('\n\n')
    expect(() =>
      assertIssueCommentBodyContainsVisualEvidence(issue, issueComment),
    ).not.toThrow()
    expect(() =>
      assertIssueCommentBodyContainsVisualEvidence(
        issue,
        issueComment.replace('![Fixed dashboard spacing]', '[Fixed dashboard spacing]'),
      ),
    ).toThrow('GitHub issue update is missing proposed fixed-behavior image')
    expect(() =>
      assertIssueCommentBodyContainsVisualEvidence(issue, '## Pull request opened'),
    ).toThrow('missing the proposed fixed-behavior section')
    expect(() => assertCandidateVisualEvidence(issue, true)).not.toThrow()
    issue.provenance.candidate.visualEvidence = []
    expect(() => assertCandidateVisualEvidence(issue, true)).toThrow(
      'has no proposed fixed-behavior images',
    )
  })

  it('verifies the prior PR candidate while a newer issue revision is being prepared', () => {
    const issue = record()
    authorizeRecord(issue)
    if (issue.provenance.kind !== 'active' || !issue.provenance.candidate?.visualEvidence) {
      throw new Error('Expected authorized visual evidence')
    }
    const previousCandidate = issue.provenance.candidate
    const body = pullRequestBodyWithVisualEvidence(
      'Implements the previous candidate.',
      previousCandidate.visualEvidence,
    )

    appendIssueInput(issue, {
      body: 'Move the Upcoming heading into the scrollable body.',
      createdAt: '2026-09-20T12:06:00.000Z',
      externalId: 'comment:2',
      source: 'issue-comment',
    })
    markIssueInputsProcessed(issue, issue.inputRevision, '2026-09-20T12:07:00.000Z')

    expect(() => assertPullRequestContainsVisualEvidence(issue, { body })).toThrow(
      'Provenance revision does not match issue',
    )
    expect(() =>
      assertPullRequestContainsVisualEvidence(issue, { body }, previousCandidate),
    ).not.toThrow()
    expect(() =>
      assertPullRequestContainsVisualEvidence(
        issue,
        { body: body.replace('![Fixed dashboard spacing]', '[Fixed dashboard spacing]') },
        previousCandidate,
      ),
    ).toThrow('missing proposed fixed-behavior image')
  })

  it('defers only the image block while a synchronized candidate awaits fresh evidence', () => {
    const issue = record()
    authorizeRecord(issue)
    if (issue.provenance.kind !== 'active' || !issue.provenance.candidate) {
      throw new Error('Expected authorized candidate')
    }
    expect(shouldVerifyExistingPullRequestVisualEvidence(issue.provenance.candidate)).toBe(true)
    issue.provenance.candidate.visualEvidence = []
    expect(shouldVerifyExistingPullRequestVisualEvidence(issue.provenance.candidate)).toBe(false)
    issue.provenance.candidate.diff.files = ['docs/admin-issue-controller.md']
    expect(shouldVerifyExistingPullRequestVisualEvidence(issue.provenance.candidate)).toBe(true)
  })

  it('recognizes only GitHub repository remotes', () => {
    expect(githubRepositoryFromRemote('https://github.com/SFenton/ha-sfenton-react-dash.git')).toBe(
      'SFenton/ha-sfenton-react-dash',
    )
    expect(githubRepositoryFromRemote('git@github.com:SFenton/ha-sfenton-react-dash.git')).toBe(
      'SFenton/ha-sfenton-react-dash',
    )
    expect(githubRepositoryFromRemote('ssh://git@github.com/SFenton/ha-sfenton-react-dash.git')).toBe(
      'SFenton/ha-sfenton-react-dash',
    )
    expect(githubRepositoryFromRemote('https://example.test/SFenton/ha-sfenton-react-dash.git')).toBeUndefined()
  })

  it('authorizes the complete committed diff and detects dirty worktrees', async () => {
    const repositoryPath = mkdtempSync(join(homedir(), '.admin-issue-controller-git-test-'))
    temporaryDirectories.push(repositoryPath)
    const git = (...args: string[]) =>
      execFileSync('git', args, { cwd: repositoryPath, encoding: 'utf8' }).trim()
    git('init', '--initial-branch=master')
    git('config', 'user.name', 'Admin Issue Controller Test')
    git('config', 'user.email', 'controller-test@example.invalid')
    mkdirSync(join(repositoryPath, 'src'))
    writeFileSync(join(repositoryPath, 'src/fixture.ts'), 'export const value = 1\n')
    git('add', 'src/fixture.ts')
    git('commit', '-m', 'Base')
    const baseSha = git('rev-parse', 'HEAD')
    git('switch', '-c', 'copilot/admin-todo-321-g1-fix')
    writeFileSync(join(repositoryPath, 'src/fixture.ts'), 'export const value = 2\n')
    mkdirSync(join(repositoryPath, 'e2e'))
    writeFileSync(join(repositoryPath, 'e2e/fixture.spec.ts'), 'export {}\n')
    git('add', '--all')
    git('commit', '-m', 'Fix')
    const headSha = git('rev-parse', 'HEAD')
    const issue = record()
    issue.branch = 'copilot/admin-todo-321-g1-fix'
    issue.worktreePath = repositoryPath
    issue.processedRevision = 1
    issue.provenance = {
      epoch: 'epoch-1',
      generation: 1,
      kind: 'active',
      preparedBaseSha: baseSha,
      resyncAttempts: 0,
      revision: 1,
    }

    const receipt = await createCommittedDiffReceipt(issue, baseSha, headSha)
    expect(receipt).toMatchObject({
      baseSha,
      entryCount: 2,
      files: ['e2e/fixture.spec.ts', 'src/fixture.ts'],
      headSha,
      mergeBaseSha: baseSha,
    })
    expect(receipt.manifestSha256).toMatch(/^[a-f0-9]{64}$/)

    expect(await readWorktreeSnapshot(repositoryPath)).toMatchObject({
      branch: issue.branch,
      gitOperations: [],
      headSha,
      status: '',
    })
    writeFileSync(join(repositoryPath, 'src/fixture.ts'), 'export const value = 3\n')
    expect((await readWorktreeSnapshot(repositoryPath)).status).not.toBe('')

    git('checkout', '--', 'src/fixture.ts')
    writeFileSync(join(repositoryPath, 'package.json'), '{}\n')
    git('add', 'package.json')
    git('commit', '-m', 'Protected change')
    await expect(
      createCommittedDiffReceipt(issue, baseSha, git('rev-parse', 'HEAD')),
    ).rejects.toThrow('protected path')
  })

  it('synchronizes a clean stale candidate with a normal merge and fresh validation', async () => {
    const root = mkdtempSync(join(homedir(), '.admin-issue-controller-sync-test-'))
    temporaryDirectories.push(root)
    const remotePath = join(root, 'origin.git')
    const repositoryPath = join(root, 'repository')
    execFileSync('git', ['init', '--bare', remotePath])
    mkdirSync(repositoryPath)
    const git = (...args: string[]) =>
      execFileSync('git', args, { cwd: repositoryPath, encoding: 'utf8' }).trim()
    git('init', '--initial-branch=master')
    git('config', 'user.name', 'Admin Issue Controller Test')
    git('config', 'user.email', 'controller-test@example.invalid')
    git('remote', 'add', 'origin', remotePath)
    mkdirSync(join(repositoryPath, 'src'))
    writeFileSync(join(repositoryPath, 'src/base.ts'), 'export const base = 1\n')
    git('add', '--all')
    git('commit', '-m', 'Base')
    git('push', '--set-upstream', 'origin', 'master')
    const baseSha = git('rev-parse', 'HEAD')

    const branch = 'copilot/admin-todo-321-g1-fix'
    git('switch', '-c', branch)
    writeFileSync(join(repositoryPath, 'src/task.ts'), 'export const task = true\n')
    git('add', '--all')
    git('commit', '-m', 'Task')
    git('push', '--set-upstream', 'origin', branch)
    const candidateHead = git('rev-parse', 'HEAD')

    const issue = record()
    issue.branch = branch
    issue.worktreePath = repositoryPath
    issue.processedRevision = 1
    issue.provenance = {
      epoch: 'epoch-sync',
      generation: 1,
      kind: 'active',
      preparedBaseSha: baseSha,
      resyncAttempts: 0,
      revision: 1,
    }
    const candidateDiff = await createCommittedDiffReceipt(issue, baseSha, candidateHead)
    issue.provenance.candidate = {
      diff: candidateDiff,
      expectedRemoteHeadSha: candidateHead,
      headSha: candidateHead,
      targetBaseSha: baseSha,
      treeSha: candidateDiff.treeSha,
      validation: validationReceipt(issue, candidateDiff),
    }

    git('switch', 'master')
    writeFileSync(join(repositoryPath, 'src/base.ts'), 'export const base = 2\n')
    git('commit', '-am', 'Advance master')
    git('push', 'origin', 'master')
    const advancedBaseSha = git('rev-parse', 'HEAD')
    git('switch', branch)

    const state = controllerState(issue)
    const config = {
      repository: 'SFenton/ha-sfenton-react-dash',
      repositoryPath,
      stateDirectory: join(root, 'state'),
    } as Parameters<typeof synchronizeCandidateBase>[0]
    issue.provenance.resyncAttempts = 2
    await expect(
      synchronizeCandidateBase(config, state, issue, advancedBaseSha),
    ).rejects.toThrow('advanced more than 2 times')
    issue.provenance.resyncAttempts = 0

    git('switch', 'master')
    await expect(
      synchronizeCandidateBase(config, state, issue, advancedBaseSha),
    ).rejects.toThrow('expected')
    git('switch', branch)

    writeFileSync(join(repositoryPath, 'src/task.ts'), 'export const task = false\n')
    await expect(
      synchronizeCandidateBase(config, state, issue, advancedBaseSha),
    ).rejects.toThrow('must remain clean')
    git('checkout', '--', 'src/task.ts')

    await expect(
      synchronizeCandidateBase(
        config,
        state,
        issue,
        advancedBaseSha,
        async (_config, candidateIssue, candidate) =>
          validationReceipt(candidateIssue, candidate.diff),
      ),
    ).resolves.toBe(true)

    if (issue.provenance.kind !== 'active' || !issue.provenance.candidate) {
      throw new Error('Expected synchronized candidate')
    }
    const synchronized = issue.provenance.candidate
    expect(synchronized.headSha).not.toBe(candidateHead)
    expect(synchronized.targetBaseSha).toBe(advancedBaseSha)
    expect(synchronized.diff.files).toEqual(['src/task.ts'])
    expect(synchronized.validation?.headSha).toBe(synchronized.headSha)
    expect(synchronized.publishedHeadSha).toBe(synchronized.headSha)
    expect(synchronized.pushAttempted).toBe(true)
    expect(issue.provenance.resyncAttempts).toBe(1)
    expect(issue.provenance.transition).toBeUndefined()
    expect(git('ls-remote', '--heads', 'origin', `refs/heads/${branch}`).split(/\s+/)[0]).toBe(
      synchronized.headSha,
    )
    expect(git('rev-list', '--parents', '-n', '1', synchronized.headSha).split(/\s+/)).toEqual([
      synchronized.headSha,
      candidateHead,
      advancedBaseSha,
    ])

    git('switch', 'master')
    writeFileSync(join(repositoryPath, 'src/base-two.ts'), 'export const next = true\n')
    git('add', '--all')
    git('commit', '-m', 'Advance master again')
    git('push', 'origin', 'master')
    const secondBaseSha = git('rev-parse', 'HEAD')
    git('switch', branch)
    issue.provenance.resyncAttempts = 2
    issue.provenance.transition = {
      attempt: 2,
      epoch: issue.provenance.epoch,
      expectedRemoteHeadSha: synchronized.headSha,
      fromBaseSha: synchronized.targetBaseSha,
      fromHeadSha: synchronized.headSha,
      fromTreeSha: synchronized.treeSha,
      generation: issue.generation,
      id: 'transition-with-unpersisted-target',
      revision: issue.processedRevision,
      stage: 'intent',
      startedAt: '2026-09-20T12:06:00.000Z',
      targetBaseSha: secondBaseSha,
    }
    git('merge', '--no-ff', '--no-edit', secondBaseSha)
    await expect(
      synchronizeCandidateBase(config, state, issue),
    ).rejects.toThrow('before the target SHA was persisted')
    expect(issue.provenance.quarantine?.reason).toContain('Local head changed')
  })

  it('aborts a conflicted base synchronization and preserves the prior candidate', async () => {
    const root = mkdtempSync(join(homedir(), '.admin-issue-controller-conflict-test-'))
    temporaryDirectories.push(root)
    const remotePath = join(root, 'origin.git')
    const repositoryPath = join(root, 'repository')
    execFileSync('git', ['init', '--bare', remotePath])
    mkdirSync(repositoryPath)
    const git = (...args: string[]) =>
      execFileSync('git', args, { cwd: repositoryPath, encoding: 'utf8' }).trim()
    git('init', '--initial-branch=master')
    git('config', 'user.name', 'Admin Issue Controller Test')
    git('config', 'user.email', 'controller-test@example.invalid')
    git('remote', 'add', 'origin', remotePath)
    mkdirSync(join(repositoryPath, 'src'))
    writeFileSync(join(repositoryPath, 'src/shared.ts'), 'export const value = 1\n')
    git('add', '--all')
    git('commit', '-m', 'Base')
    git('push', '--set-upstream', 'origin', 'master')
    const baseSha = git('rev-parse', 'HEAD')

    const branch = 'copilot/admin-todo-321-g1-conflict'
    git('switch', '-c', branch)
    writeFileSync(join(repositoryPath, 'src/shared.ts'), 'export const value = 2\n')
    git('commit', '-am', 'Task')
    git('push', '--set-upstream', 'origin', branch)
    const candidateHead = git('rev-parse', 'HEAD')

    const issue = record()
    issue.branch = branch
    issue.worktreePath = repositoryPath
    issue.processedRevision = 1
    issue.provenance = {
      epoch: 'epoch-conflict',
      generation: 1,
      kind: 'active',
      preparedBaseSha: baseSha,
      resyncAttempts: 0,
      revision: 1,
    }
    const candidateDiff = await createCommittedDiffReceipt(issue, baseSha, candidateHead)
    issue.provenance.candidate = {
      diff: candidateDiff,
      expectedRemoteHeadSha: candidateHead,
      headSha: candidateHead,
      targetBaseSha: baseSha,
      treeSha: candidateDiff.treeSha,
      validation: validationReceipt(issue, candidateDiff),
    }

    git('switch', 'master')
    writeFileSync(join(repositoryPath, 'src/shared.ts'), 'export const value = 3\n')
    git('commit', '-am', 'Conflicting master')
    git('push', 'origin', 'master')
    const advancedBaseSha = git('rev-parse', 'HEAD')
    git('switch', branch)

    const state = controllerState(issue)
    const config = {
      repository: 'SFenton/ha-sfenton-react-dash',
      repositoryPath,
      stateDirectory: join(root, 'state'),
    } as Parameters<typeof synchronizeCandidateBase>[0]
    await expect(
      synchronizeCandidateBase(
        config,
        state,
        issue,
        advancedBaseSha,
        async (_config, candidateIssue, candidate) =>
          validationReceipt(candidateIssue, candidate.diff),
      ),
    ).rejects.toThrow('prior candidate was restored')
    expect(await readWorktreeSnapshot(repositoryPath)).toMatchObject({
      gitOperations: [],
      headSha: candidateHead,
      status: '',
    })
    if (issue.provenance.kind !== 'active') throw new Error('Expected active provenance')
    expect(issue.provenance.transition?.stage).toBe('aborted')
    expect(issue.provenance.transition?.diagnostics?.unmergedPaths).toEqual(['src/shared.ts'])
  })

  it('requires exact repository, branch, base, and head PR identity', () => {
    const pullRequest = {
      base: {
        ref: 'master',
        repo: { full_name: 'SFenton/ha-sfenton-react-dash' },
      },
      head: {
        ref: 'copilot/admin-todo-321-g1-fix',
        repo: { full_name: 'SFenton/ha-sfenton-react-dash' },
        sha: 'b'.repeat(40),
      },
      html_url: 'https://github.com/SFenton/ha-sfenton-react-dash/pull/400',
      merge_commit_sha: null,
      merged_at: null,
      number: 400,
      state: 'open' as const,
    }
    expect(() =>
      assertPullRequestBinding(
        'SFenton/ha-sfenton-react-dash',
        'copilot/admin-todo-321-g1-fix',
        pullRequest,
        'b'.repeat(40),
      ),
    ).not.toThrow()
    expect(() =>
      assertPullRequestBinding(
        'SFenton/ha-sfenton-react-dash',
        'copilot/admin-todo-321-g1-fix',
        {
          ...pullRequest,
          head: { ...pullRequest.head, sha: 'c'.repeat(40) },
        },
        'b'.repeat(40),
      ),
    ).toThrow('does not match authorized candidate')
    expect(() =>
      assertPullRequestBinding(
        'SFenton/ha-sfenton-react-dash',
        'copilot/admin-todo-321-g1-fix',
        {
          ...pullRequest,
          base: { ...pullRequest.base, ref: 'other' },
        },
        'b'.repeat(40),
      ),
    ).toThrow('expected master')
  })

  it('allows only the exact prior head while GitHub propagates a pushed PR update', () => {
    const priorHeadSha = 'b'.repeat(40)
    const candidateHeadSha = 'c'.repeat(40)
    const pullRequest = {
      base: {
        ref: 'master',
        repo: { full_name: 'SFenton/ha-sfenton-react-dash' },
      },
      head: {
        ref: 'copilot/admin-todo-321-g1-fix',
        repo: { full_name: 'SFenton/ha-sfenton-react-dash' },
        sha: priorHeadSha,
      },
      html_url: 'https://github.com/SFenton/ha-sfenton-react-dash/pull/400',
      merge_commit_sha: null,
      merged_at: null,
      number: 400,
      state: 'open' as const,
    }

    expect(
      classifyPullRequestHead(
        'SFenton/ha-sfenton-react-dash',
        'copilot/admin-todo-321-g1-fix',
        pullRequest,
        candidateHeadSha,
        priorHeadSha,
      ),
    ).toBe('stale')
    expect(
      classifyPullRequestHead(
        'SFenton/ha-sfenton-react-dash',
        'copilot/admin-todo-321-g1-fix',
        { ...pullRequest, head: { ...pullRequest.head, sha: candidateHeadSha } },
        candidateHeadSha,
        priorHeadSha,
      ),
    ).toBe('current')
    expect(() =>
      classifyPullRequestHead(
        'SFenton/ha-sfenton-react-dash',
        'copilot/admin-todo-321-g1-fix',
        { ...pullRequest, head: { ...pullRequest.head, sha: 'd'.repeat(40) } },
        candidateHeadSha,
        priorHeadSha,
      ),
    ).toThrow('does not match authorized candidate')
  })

  it('recovers a journaled nonterminal transition without a new issue revision', () => {
    const issue = record()
    issue.phase = 'blocked'
    issue.provenance = {
      epoch: 'epoch-recovery',
      generation: issue.generation,
      kind: 'active',
      preparedBaseSha: 'a'.repeat(40),
      resyncAttempts: 1,
      revision: issue.inputRevision,
      transition: {
        attempt: 1,
        epoch: 'epoch-recovery',
        fromBaseSha: 'a'.repeat(40),
        fromHeadSha: 'b'.repeat(40),
        fromTreeSha: 'c'.repeat(40),
        generation: issue.generation,
        id: 'transition-recovery',
        revision: issue.inputRevision,
        stage: 'pushed',
        startedAt: '2026-09-20T12:05:00.000Z',
        targetBaseSha: 'd'.repeat(40),
        toHeadSha: 'e'.repeat(40),
        toTreeSha: 'f'.repeat(40),
      },
    }
    expect(hasRecoverableTransition(issue)).toBe(true)
    if (issue.provenance.kind !== 'active' || !issue.provenance.transition) {
      throw new Error('Expected active transition')
    }
    issue.provenance.transition.stage = 'failed'
    expect(hasRecoverableTransition(issue)).toBe(false)
  })

  it('reauthorizes an unchanged clean candidate for a newer processed revision', async () => {
    const root = mkdtempSync(join(homedir(), '.admin-issue-controller-reauthorize-test-'))
    temporaryDirectories.push(root)
    const repositoryPath = join(root, 'repository')
    mkdirSync(repositoryPath)
    const git = (...args: string[]) =>
      execFileSync('git', args, { cwd: repositoryPath, encoding: 'utf8' }).trim()
    git('init', '--initial-branch=master')
    git('config', 'user.name', 'Admin Issue Controller Test')
    git('config', 'user.email', 'controller-test@example.invalid')
    mkdirSync(join(repositoryPath, 'src'))
    writeFileSync(join(repositoryPath, 'src/fixture.ts'), 'export const value = 1\n')
    git('add', '--all')
    git('commit', '-m', 'Base')
    const baseSha = git('rev-parse', 'HEAD')
    const branch = 'copilot/admin-todo-321-g1-fix'
    git('switch', '-c', branch)
    writeFileSync(join(repositoryPath, 'src/fixture.ts'), 'export const value = 2\n')
    git('commit', '-am', 'Fix')
    const headSha = git('rev-parse', 'HEAD')

    const issue = record()
    issue.branch = branch
    issue.worktreePath = repositoryPath
    issue.provenance = {
      epoch: 'epoch-reauthorize',
      generation: issue.generation,
      kind: 'active',
      preparedBaseSha: baseSha,
      resyncAttempts: 0,
      revision: 1,
    }
    const originalDiff = await createCommittedDiffReceipt(issue, baseSha, headSha)
    issue.provenance.candidate = {
      checks: {
        epoch: issue.provenance.epoch,
        generation: issue.generation,
        headSha,
        observedAt: '2026-09-20T12:04:00.000Z',
        requiredSetSha256: '3'.repeat(64),
        revision: 1,
        runs: [],
      },
      diff: originalDiff,
      headSha,
      targetBaseSha: baseSha,
      treeSha: originalDiff.treeSha,
      validation: validationReceipt(issue, originalDiff),
      publishedHeadSha: headSha,
      pushAttempted: true,
      visualEvidence: [
        {
          alt: 'Previous image',
          caption: 'Mock evidence: previous candidate.',
          diffManifestSha256: originalDiff.manifestSha256,
          mediaType: 'image/png',
          path: 'artifacts/admin-issue-321/fixed.png',
          sha256: '5'.repeat(64),
          sizeBytes: 123,
          url: 'https://github.com/user-attachments/assets/11111111-1111-1111-1111-111111111111',
        },
      ],
    }
    appendIssueInput(issue, {
      body: 'Retry the same validated candidate.',
      createdAt: '2026-09-20T12:05:00.000Z',
      externalId: 'comment:retry',
      source: 'issue-comment',
    })
    markIssueInputsProcessed(issue, issue.inputRevision, '2026-09-20T12:06:00.000Z')
    const state = controllerState(issue)
    const candidate = await prepareCommittedCandidate(
      {
        repositoryPath,
        stateDirectory: join(root, 'state'),
      } as Parameters<typeof prepareCommittedCandidate>[0],
      state,
      issue,
      {
        changeSummary: ['Preserved the existing candidate.'],
        decision: 'ready_for_pr',
        iosFollowUp: { reason: '', required: false },
        pr: { body: 'Preserved candidate.', title: 'Preserve candidate' },
        questions: [],
        review: { approved: true, findings: [] },
        schemaVersion: 1,
        summary: 'Preserved candidate.',
        tests: [{ command: 'test validation', result: 'passed' }],
        visualEvidence: [],
      },
    )

    expect(candidate.headSha).toBe(headSha)
    expect(candidate.diff.revision).toBe(2)
    expect(candidate.diff.manifestSha256).toBe(originalDiff.manifestSha256)
    expect(candidate.validation).toBeUndefined()
    expect(candidate.checks).toBeUndefined()
    expect(candidate.visualEvidence).toBeUndefined()
    expect(candidate.publishedHeadSha).toBe(headSha)
    expect(candidate.pushAttempted).toBe(true)
    if (issue.provenance.kind !== 'active') throw new Error('Expected active provenance')
    expect(issue.provenance.revision).toBe(2)
  })

  it('publishes a repaired candidate when the prior validation failed before any push', async () => {
    const fixture = await publicationFixture()
    const { branch, config, first, git, issue, root, state } = fixture
    expect(first.validation).toBeUndefined()
    expect(first.pushAttempted).toBe(false)
    expect(git('ls-remote', '--heads', 'origin', `refs/heads/${branch}`)).toBe('')

    const repair = await replaceCandidate(fixture, 3)
    expect(repair.expectedRemoteHeadSha).toBeUndefined()
    expect(repair.pushAttempted).toBe(false)
    repair.validation = validationReceipt(issue, repair.diff)
    await pushCandidate(config, state, issue)

    expect(git('ls-remote', '--heads', 'origin', `refs/heads/${branch}`).split(/\s+/)[0]).toBe(
      repair.headSha,
    )
    expect(repair.publishedHeadSha).toBe(repair.headSha)
    expect(repair.pushAttempted).toBe(true)
    expect(JSON.parse(readFileSync(join(root, 'state', 'state.json'), 'utf8'))).toMatchObject({
      issues: {
        [issue.uid]: {
          provenance: { candidate: { publishedHeadSha: repair.headSha, pushAttempted: true } },
        },
      },
    })
    expect(() => assertAdminIssueControllerState(state)).not.toThrow()
  })

  it('inherits only the verified published head and rejects deletion before another push', async () => {
    const fixture = await publicationFixture()
    const { branch, config, first, git, issue, state } = fixture
    first.validation = validationReceipt(issue, first.diff)
    await pushCandidate(config, state, issue)
    expect(first.publishedHeadSha).toBe(first.headSha)

    const replacement = await replaceCandidate(fixture, 3)
    expect(replacement.expectedRemoteHeadSha).toBe(first.headSha)
    replacement.validation = validationReceipt(issue, replacement.diff)
    await pushCandidate(config, state, issue)
    expect(replacement.publishedHeadSha).toBe(replacement.headSha)

    const third = await replaceCandidate(fixture, 4)
    expect(third.expectedRemoteHeadSha).toBe(replacement.headSha)
    third.validation = validationReceipt(issue, third.diff)
    git('push', 'origin', '--delete', branch)
    await expect(pushCandidate(config, state, issue)).rejects.toThrow(
      `Remote branch ${branch} is absent, expected ${replacement.headSha}`,
    )
    expect(git('ls-remote', '--heads', 'origin', `refs/heads/${branch}`)).toBe('')
  })

  it('rejects an unexpected existing remote branch and a divergent published branch', async () => {
    const unexpected = await publicationFixture()
    unexpected.first.validation = validationReceipt(unexpected.issue, unexpected.first.diff)
    unexpected.git('push', 'origin', `${unexpected.baseSha}:refs/heads/${unexpected.branch}`)
    await expect(
      pushCandidate(unexpected.config, unexpected.state, unexpected.issue),
    ).rejects.toThrow(`expected absent`)

    const divergent = await publicationFixture()
    const { branch, config, first, git, issue, repositoryPath, state } = divergent
    first.validation = validationReceipt(issue, first.diff)
    await pushCandidate(config, state, issue)
    git('switch', '-c', 'external-update')
    writeFileSync(join(repositoryPath, 'src/external.ts'), 'export const external = true\n')
    git('add', '--all')
    git('commit', '-m', 'External update')
    git('push', 'origin', `HEAD:refs/heads/${branch}`)
    const externalHead = git('rev-parse', 'HEAD')
    git('switch', branch)
    const replacement = await replaceCandidate(divergent, 3)
    replacement.validation = validationReceipt(issue, replacement.diff)
    await expect(pushCandidate(config, state, issue)).rejects.toThrow(
      `Remote branch ${branch} is ${externalHead}, expected ${first.headSha}`,
    )
    expect(git('ls-remote', '--heads', 'origin', `refs/heads/${branch}`).split(/\s+/)[0]).toBe(
      externalHead,
    )
  })

  it('fails closed on ambiguous legacy publication and propagates remote read errors', async () => {
    const legacy = await publicationFixture()
    legacy.first.validation = validationReceipt(legacy.issue, legacy.first.diff)
    delete legacy.first.pushAttempted
    await expect(replaceCandidate(legacy, 3)).rejects.toThrow('Publication of previous candidate')
    expect(legacy.git('rev-parse', 'HEAD')).toBe(legacy.first.headSha)

    const failedRead = await publicationFixture()
    failedRead.first.validation = validationReceipt(failedRead.issue, failedRead.first.diff)
    failedRead.git('remote', 'set-url', 'origin', join(failedRead.root, 'missing.git'))
    await expect(
      pushCandidate(failedRead.config, failedRead.state, failedRead.issue),
    ).rejects.toThrow('git ls-remote --heads origin')
    expect(failedRead.first.pushAttempted).toBe(false)
    if (failedRead.issue.provenance.kind !== 'active') throw new Error('Expected active provenance')
    expect(failedRead.issue.provenance.quarantine).toBeUndefined()
  })

  it('confirms an interrupted push only when the remote has the exact candidate head', async () => {
    const confirmed = await publicationFixture()
    confirmed.first.validation = validationReceipt(confirmed.issue, confirmed.first.diff)
    confirmed.first.pushAttempted = true
    confirmed.git('push', '--set-upstream', 'origin', confirmed.branch)
    await pushCandidate(confirmed.config, confirmed.state, confirmed.issue)
    expect(confirmed.first.publishedHeadSha).toBe(confirmed.first.headSha)

    const ambiguous = await publicationFixture()
    ambiguous.first.validation = validationReceipt(ambiguous.issue, ambiguous.first.diff)
    ambiguous.first.pushAttempted = true
    await expect(
      pushCandidate(ambiguous.config, ambiguous.state, ambiguous.issue),
    ).rejects.toThrow('Publication of candidate')
    expect(ambiguous.git('ls-remote', '--heads', 'origin', `refs/heads/${ambiguous.branch}`)).toBe('')
  })

  it('quarantines a deleted published branch before base synchronization', async () => {
    const fixture = await publicationFixture()
    const { branch, config, first, git, issue, repositoryPath, state } = fixture
    first.validation = validationReceipt(issue, first.diff)
    await pushCandidate(config, state, issue)
    git('switch', 'master')
    writeFileSync(join(repositoryPath, 'src/base-new.ts'), 'export const next = true\n')
    git('add', '--all')
    git('commit', '-m', 'Advance master')
    git('push', 'origin', 'master')
    const advancedBaseSha = git('rev-parse', 'HEAD')
    git('switch', branch)
    git('push', 'origin', '--delete', branch)

    await expect(
      synchronizeCandidateBase(config, state, issue, advancedBaseSha),
    ).rejects.toThrow(`Published branch ${branch} is absent, expected ${first.headSha}`)
    expect(git('rev-parse', 'HEAD')).toBe(first.headSha)
  })

  it('rejects inconsistent published-head receipts in the journal', () => {
    const issue = record()
    authorizeRecord(issue)
    if (issue.provenance.kind !== 'active' || !issue.provenance.candidate) {
      throw new Error('Expected authorized candidate')
    }
    const candidate = issue.provenance.candidate
    candidate.publishedHeadSha = 'd'.repeat(40)
    candidate.pushAttempted = true
    expect(() => assertAdminIssueControllerState(controllerState(issue))).toThrow(
      'publishedHeadSha does not confirm',
    )
    candidate.publishedHeadSha = candidate.headSha
    candidate.pushAttempted = false
    expect(() => assertAdminIssueControllerState(controllerState(issue))).toThrow(
      'publishedHeadSha does not confirm',
    )
    candidate.pushAttempted = true
    expect(() => assertAdminIssueControllerState(controllerState(issue))).not.toThrow()
  })

  it('treats committed-candidate worktree drift as a provenance failure', () => {
    const issue = record()
    issue.branch = 'copilot/admin-todo-321-g1-fix'
    expect(() =>
      assertExactCandidateSnapshot(
        {
          branch: issue.branch,
          gitOperations: [],
          headSha: 'c'.repeat(40),
          status: '1 .M N... 100644 100644 100644 a b src/changed.ts\0',
          treeSha: 'd'.repeat(40),
        },
        issue,
        'c'.repeat(40),
        'd'.repeat(40),
      ),
    ).toThrow(AdminIssueProvenanceError)
  })

  it('waits for delayed merge metadata and identifies an exact merge in master history', async () => {
    const pullRequest = {
      base: {
        ref: 'master',
        repo: { full_name: 'SFenton/ha-sfenton-react-dash' },
      },
      head: {
        ref: 'copilot/admin-todo-321-g1-fix',
        repo: { full_name: 'SFenton/ha-sfenton-react-dash' },
        sha: 'b'.repeat(40),
      },
      html_url: 'https://github.com/SFenton/ha-sfenton-react-dash/pull/400',
      merge_commit_sha: null,
      merged_at: null,
      number: 400,
      state: 'open' as const,
    }
    let reads = 0
    let waits = 0
    const merged = await waitForMergedPullRequest(
      async () => {
        reads += 1
        if (reads < 3) return pullRequest
        return {
          ...pullRequest,
          merge_commit_sha: 'c'.repeat(40),
          merged_at: '2026-09-20T12:10:00.000Z',
          state: 'closed' as const,
        }
      },
      3,
      async (milliseconds) => {
        expect(milliseconds).toBe(2_000)
        waits += 1
      },
    )
    expect(merged?.merge_commit_sha).toBe('c'.repeat(40))
    expect({ reads, waits }).toEqual({ reads: 3, waits: 2 })

    const baseSha = 'a'.repeat(40)
    const candidateHeadSha = 'b'.repeat(40)
    const mergeSha = 'c'.repeat(40)
    const descendantSha = 'd'.repeat(40)
    expect(
      findExactMergeCommit(
        `${descendantSha} ${mergeSha}\n${mergeSha} ${baseSha} ${candidateHeadSha}\n`,
        baseSha,
        candidateHeadSha,
      ),
    ).toBe(mergeSha)
    expect(
      findExactMergeCommit(
        `${mergeSha} ${candidateHeadSha} ${baseSha}\n`,
        baseSha,
        candidateHeadSha,
      ),
    ).toBeUndefined()
  })

  it('allows only auto-deployed dashboard paths from workers', () => {
    expect(workerMutableInfrastructurePaths()).toEqual([])
    expect(workerMutableInfrastructurePaths({ automationKind: 'deployment' })).toEqual([
      '.github/workflows/deploy-dashboard.yml',
      'scripts/deploy-dashboard-ci.test.ts',
      'scripts/deploy-dashboard-ci.ts',
    ])
    expect(workerMutableInfrastructurePaths({ automationKind: 'layout' })).toEqual([
      'docs/ux/layouts.md',
      'scripts/layout',
    ])
    expect(() => assertWorkerChangesSafe('/tmp', ['src/App.tsx', 'e2e/app.spec.ts'])).not.toThrow()
    expect(() => assertWorkerChangesSafe('/tmp', ['home-assistant/packages/example.yaml'])).toThrow(
      'outside the auto-deployed dashboard',
    )
    expect(() =>
      assertWorkerChangesSafe(
        '/tmp',
        ['.github/workflows/deploy-dashboard.yml', 'scripts/deploy-dashboard-ci.test.ts'],
        { automationKind: 'deployment' },
      ),
    ).not.toThrow()
    expect(() =>
      assertWorkerChangesSafe(
        '/tmp',
        ['scripts/admin-issue-controller.ts'],
        { automationKind: 'deployment' },
      ),
    ).toThrow('protected path')
    expect(() =>
      assertWorkerChangesSafe(
        '/tmp',
        [
          'docs/ux/layouts.md',
          'scripts/layout/plan.ts',
          'scripts/layout/run.test.ts',
          'scripts/layout/run.ts',
        ],
        { automationKind: 'layout' },
      ),
    ).not.toThrow()
    expect(() => assertWorkerChangesSafe('/tmp', ['scripts/layout/run.ts'])).toThrow(
      'protected path',
    )
    expect(() =>
      assertWorkerChangesSafe(
        '/tmp',
        ['docs/ux/layouts.md/extra'],
        { automationKind: 'layout' },
      ),
    ).toThrow('protected path')
    expect(() =>
      assertWorkerChangesSafe(
        '/tmp',
        ['scripts/layout/run.ts'],
        { automationKind: 'deployment' },
      ),
    ).toThrow('protected path')
    expect(() =>
      assertWorkerChangesSafe(
        '/tmp',
        ['playwright.config.ts'],
        { automationKind: 'layout' },
      ),
    ).toThrow('protected path')
  })

  it('rejects executable Copilot configuration outside the dedicated extension', () => {
    const root = mkdtempSync(join(homedir(), '.admin-issue-controller-host-config-test-'))
    temporaryDirectories.push(root)
    const repositoryPath = join(root, 'repository')
    const policyPath = join(root, 'policy')
    mkdirSync(repositoryPath, { recursive: true })
    mkdirSync(policyPath, { recursive: true })
    expect(() => assertWorkerHostConfigurationSafe(repositoryPath, policyPath)).not.toThrow()

    const extensionPath = join(repositoryPath, '.github/extensions')
    mkdirSync(extensionPath, { recursive: true })
    writeFileSync(join(extensionPath, 'unexpected.mjs'), 'export {};\n')
    expect(() => assertWorkerHostConfigurationSafe(repositoryPath, policyPath)).toThrow(
      'Project Copilot extensions are not allowed',
    )
    rmSync(join(repositoryPath, '.github'), { force: true, recursive: true })

    writeFileSync(join(repositoryPath, '.mcp.json'), '{}\n')
    expect(() => assertWorkerHostConfigurationSafe(repositoryPath, policyPath)).toThrow(
      'Project MCP configuration is not allowed',
    )
    rmSync(join(repositoryPath, '.mcp.json'))

    writeFileSync(join(policyPath, 'mandatory.json'), '{}\n')
    expect(() => assertWorkerHostConfigurationSafe(repositoryPath, policyPath)).toThrow(
      'Copilot policy hooks are not allowed',
    )
  })

  it('requires immutable worker images and keeps mutable paths under the user home', () => {
    const root = mkdtempSync(join(homedir(), '.admin-issue-controller-test-'))
    temporaryDirectories.push(root)
    const repositoryPath = join(root, 'repository')
    const workerExtensionPath = join(root, 'worker-extension.mjs')
    const tandemSkillPath = join(root, 'tandem-research', 'SKILL.md')
    const hassMcpConfigPath = join(root, 'mcp-config.json')
    const runnerControllerConfigPath = join(root, 'runner-controller.json')
    mkdirSync(repositoryPath, { recursive: true })
    mkdirSync(resolve(tandemSkillPath, '..'), { recursive: true })
    writeFileSync(workerExtensionPath, 'export {};\n')
    writeFileSync(tandemSkillPath, '# Tandem research\n')
    writeFileSync(
      hassMcpConfigPath,
      JSON.stringify({
        mcpServers: {
          hass: { type: 'http', url: 'http://127.0.0.1:9583/private-test' },
          playwright: { command: '/usr/bin/false' },
        },
      }),
      { mode: 0o600 },
    )
    writeFileSync(
      runnerControllerConfigPath,
      JSON.stringify({ version: 1, workflowSha256: 'b'.repeat(64) }),
      { mode: 0o600 },
    )
    const configPath = join(root, 'controller.json')
    const base = {
      completionReceiptEntityId: 'input_text.admin_todo_completion_receipt',
      completionScript: 'script.complete_admin_todo_item',
      deploymentPollSeconds: 20,
      deploymentTimeoutMinutes: 90,
      hassMcpConfigPath,
      hassMcpServerName: 'hass',
      issueLabels: ['bug'],
      maxRepairAttempts: 3,
      ownerId: 3988463,
      ownerLogin: 'SFenton',
      pollSeconds: 30,
      repository: 'SFenton/ha-sfenton-react-dash',
      repositoryId: 1228257493,
      repositoryPath,
      requiredCheckAppId: 15368,
      requiredChecks: ['Playwright gate'],
      requiredWorkflow: 'deploy-dashboard.yml',
      runnerControllerConfigPath,
      runnerControllerService: 'ha-dashboard-runner-controller.service',
      stateDirectory: join(root, 'state'),
      tandemSkillPath,
      todoEntityId: 'todo.groceries',
      workerExtensionPath,
      workerImageId: `sha256:${'a'.repeat(64)}`,
      workerHome: join(root, 'worker-home'),
      workerTimeoutMinutes: 90,
      worktreeRoot: join(root, 'worktrees'),
    }
    writeFileSync(configPath, JSON.stringify(base))
    const loaded = loadAdminIssueControllerConfig(configPath)
    expect(loaded).toMatchObject({
      repository: base.repository,
      requiredCheckAppId: 15368,
      hassMcpConfigPath,
      hassMcpServerName: 'hass',
      runnerControllerConfigPath,
      runnerControllerService: 'ha-dashboard-runner-controller.service',
      workerImageId: base.workerImageId,
      maxConcurrentWorkers: 1,
    })
    expect(
      selectWorkerHassMcpConfig(JSON.parse(readFileSync(hassMcpConfigPath, 'utf8')), 'hass'),
    ).toEqual({
      mcpServers: {
        hass: { type: 'http', url: 'http://127.0.0.1:9583/private-test' },
      },
    })
    prepareCopilotHome(loaded)
    expect(
      JSON.parse(readFileSync(join(base.workerHome, '.copilot/mcp-config.json'), 'utf8')),
    ).toEqual({
      mcpServers: {
        hass: { type: 'http', url: 'http://127.0.0.1:9583/private-test' },
      },
    })
    expect(statSync(join(base.workerHome, '.copilot/mcp-config.json')).mode & 0o777).toBe(0o600)
    const first = isolatedWorkerConfig(loaded, record())
    const second = isolatedWorkerConfig(loaded, { issueNumber: 322, uid: 'another-task' })
    expect(first.workerHome).not.toBe(second.workerHome)
    prepareCopilotHome(first)
    const firstMcp = readFileSync(join(first.workerHome, '.copilot/mcp-config.json'), 'utf8')
    prepareCopilotHome(second)
    expect(readFileSync(join(first.workerHome, '.copilot/mcp-config.json'), 'utf8'))
      .toBe(firstMcp)
    expect(statSync(join(second.workerHome, '.copilot/mcp-config.json')).mode & 0o777)
      .toBe(0o600)
    expect(() =>
      selectWorkerHassMcpConfig(JSON.parse(readFileSync(hassMcpConfigPath, 'utf8')), 'missing'),
    ).toThrow('is not configured')

    writeFileSync(configPath, JSON.stringify({ ...base, workerHome: homedir() }))
    expect(() => loadAdminIssueControllerConfig(configPath)).toThrow('must be a child')

    writeFileSync(configPath, JSON.stringify({ ...base, requiredChecks: [] }))
    expect(() => loadAdminIssueControllerConfig(configPath)).toThrow(
      'requiredChecks must include at least one protected check',
    )
    writeFileSync(configPath, JSON.stringify({ ...base, maxConcurrentWorkers: 10 }))
    expect(loadAdminIssueControllerConfig(configPath).maxConcurrentWorkers).toBe(10)
    writeFileSync(configPath, JSON.stringify({ ...base, maxConcurrentWorkers: 11 }))
    expect(() => loadAdminIssueControllerConfig(configPath)).toThrow('at most 10')

    writeFileSync(configPath, JSON.stringify({ ...base, workerImageId: 'node:latest' }))
    expect(() => loadAdminIssueControllerConfig(configPath)).toThrow('immutable sha256 image ID')

    writeFileSync(
      configPath,
      JSON.stringify({ ...base, runnerControllerService: '--system' }),
    )
    expect(() => loadAdminIssueControllerConfig(configPath)).toThrow(
      'systemd service unit name',
    )

    chmodSync(runnerControllerConfigPath, 0o644)
    writeFileSync(configPath, JSON.stringify(base))
    expect(() => loadAdminIssueControllerConfig(configPath)).toThrow(
      'runnerControllerConfigPath must not be readable',
    )
    chmodSync(runnerControllerConfigPath, 0o600)

    chmodSync(hassMcpConfigPath, 0o644)
    writeFileSync(configPath, JSON.stringify(base))
    expect(() => loadAdminIssueControllerConfig(configPath)).toThrow(
      'must not be readable by group or other users',
    )

    const overlappingMcpConfigPath = join(base.workerHome, 'source-mcp.json')
    writeFileSync(
      overlappingMcpConfigPath,
      JSON.stringify({ mcpServers: { hass: { url: 'http://127.0.0.1:9583/private-test' } } }),
      { mode: 0o600 },
    )
    writeFileSync(
      configPath,
      JSON.stringify({ ...base, hassMcpConfigPath: overlappingMcpConfigPath }),
    )
    expect(() => loadAdminIssueControllerConfig(configPath)).toThrow(
      'hassMcpConfigPath must not overlap workerHome',
    )
  })

  it('keeps the extension networkless and exposes only bounded repository mounts', () => {
    const extension = readFileSync(
      resolve(process.cwd(), 'ops/admin-issue-controller/worker-extension.mjs'),
      'utf8',
    )
    expect(extension).toContain('"--network",\n    "none"')
    expect(extension).toContain('com.sfenton.admin-issue-worker=${issueUid}')
    expect(extension).toContain('"ADMIN_ISSUE_CONTAINER_UID"')
    expect(extension).toContain('"ADMIN_ISSUE_READ_ONLY"')
    expect(extension).toContain('dst=/workspace${readOnly ? ",readonly" : ""}')
    expect(extension).toContain('Research-only issue cannot mount mutable workspace paths.')
    expect(extension).toContain('"--read-only"')
    expect(extension).toContain('"--cap-drop",\n    "ALL"')
    expect(extension).toContain('"ADMIN_ISSUE_GIT_COMMON_DIR"')
    expect(extension).toContain('".github"')
    expect(extension).toContain('"node_modules"')
    expect(extension).toContain('"scripts/lib/hassAdminTodo.ts"')
    expect(extension).toContain('"docs/ux/layouts.md"')
    expect(extension).toContain('"scripts/layout"')
    expect(extension).toContain('process.env.ADMIN_ISSUE_MUTABLE_PATHS')
    expect(extension).toContain('ALLOWED_MUTABLE_WORKSPACE_PATHS')
    expect(extension).toContain('if (mutableWorkspacePaths.includes(relativePath)) continue')
    expect(extension).toContain('src=/dev/null,dst=/workspace/${relativePath},readonly')
    expect(extension).toContain('/workspace/.cache:rw,nosuid,nodev')
    expect(extension).toContain('readonly')
    expect(extension).toContain('/^sha256:[a-f0-9]{64}$/')
    expect(extension).not.toContain('process.env,')
    const service = readFileSync(
      resolve(process.cwd(), 'ops/admin-issue-controller/admin-issue-controller.service'),
      'utf8',
    )
    expect(service).toContain('Environment="PATH=%h/.local/bin:/usr/local/bin:/usr/bin:/bin"')
    expect(service).toContain('ExecStart=%h/.local/bin/node')
  })

  it('pins the worker model and excludes privileged built-in tools', () => {
    const controller = readFileSync(resolve(process.cwd(), 'scripts/admin-issue-controller.ts'), 'utf8')
    expect(controller).toContain("'gpt-5.6-sol'")
    expect(controller).toContain("'max'")
    expect(controller).toContain("'--disable-builtin-mcps'")
    expect(controller).toContain("'--enable-mcp-server'")
    expect(controller).toContain("'--allow-all-mcp-server-instructions'")
    expect(controller).toContain('mcp:*')
    expect(controller).toContain("'custom-tool(admin_issue_workspace)'")
    expect(controller).toContain('config.hassMcpServerName')
    expect(controller).toContain("'GH_TOKEN'")
    expect(controller).toContain(
      'buildCopilotWorkerArgs(session.id, record.sessionName, commonArgs, session.resume)',
    )
    expect(controller).toContain('disableAllHooks: true')
    expect(controller).toContain("'installed-plugins'")
    expect(controller).toContain("const ALLOWED_WORKER_PATHS = ['e2e/', 'public/', 'src/']")
    expect(controller).not.toContain("'--allow-all-tools'")
    expect(controller).toContain('MAX_BASE_RESYNCS_PER_GENERATION = 2')
    expect(controller).toContain("runCommand('git', ['merge', '--abort']")
    expect(controller).toContain('assertPullRequestBinding(')
    expect(controller).toContain('assertRequiredChecksCurrent(')
    expect(controller).toContain('verifyMergedPullRequest(')
    expect(controller).toContain('verifyIssueVisualEvidenceComment(')
    expect(controller).toContain('issues/comments/${existing.id}')
    expect(controller).toContain('assertDeploymentRunSucceeded(run)')
    expect(controller).toContain('assertWorkerChangesSafe(record.worktreePath, files, record)')
    expect(controller).toContain('recoverBlockedDeployments(config, client, state, reconcileInputs)')
    expect(controller).toContain('recoverExistingReleaseVerifications(config, client, state, reconcileInputs)')
    expect(controller).toContain('loadBoundDeploymentReceipt(config, record)')
    expect(controller).toContain('verifySuccessfulRequiredChecksForHead(')
    expect(controller).toContain('assertExistingReleaseVerificationSnapshot(')
    expect(controller).toContain('## Existing release verified')
    expect(controller).toContain("record.automationKind === 'layout'")
    expect(controller).toContain('waitForLayoutWorkflow(')
    expect(controller).toContain('bindVerifiedLayoutWorkflow(record, run)')
    expect(controller).toContain('finalizeLayoutIssue(config, state, record, run, reconcileInputs)')
    expect(controller).toContain('await closeControllerIssue(config, state, record, reconcileInputs)')
    expect(controller).toContain('await assertFreshFinalizationInputs(record, reconcileInputs)')
    expect(controller).toContain('reauthorizePersistedIosFollowUpFromGitHub(config, record)')
    expect(controller).toContain('canonicalIssueTextFromGitHub(config, record)')
    expect(controller).toContain('restoreReadyOutcomeFromWorkerLog(config, record)')
    expect(controller).toContain('waitForPullRequestHead(')
    expect(controller).toContain(
      'shouldVerifyExistingPullRequestVisualEvidence(previousCandidate)',
    )
    expect(controller).toContain('assertFinalizationAuthorized(record)')
    expect(controller).not.toContain("'--force-with-lease'")
    expect(controller).not.toContain("'--amend'")
    expect(controller).not.toContain("['rebase'")
    expect(controller).not.toContain("['reset'")
    expect(controller).not.toContain('record.pr.headSha')
    expect(controller).not.toContain('record.pr.mergeSha')
    const completionReceipt = controller.indexOf('record.receipts.todoCompletedAt = now()')
    const cleanup = controller.indexOf('await cleanupWorktree(config, record, true)', completionReceipt)
    const completed = controller.indexOf("record.phase = 'completed'", cleanup)
    expect(completionReceipt).toBeGreaterThan(-1)
    expect(cleanup).toBeGreaterThan(completionReceipt)
    expect(completed).toBeGreaterThan(cleanup)
    const existingRelease = controller.indexOf(
      'async function finalizeExistingReleaseVerification',
    )
    const existingComment = controller.indexOf(
      'formatExistingReleaseCompletionComment(',
      existingRelease,
    )
    const existingClose = controller.indexOf(
      'await closeControllerIssue(config, state, record, reconcileInputs)',
      existingComment,
    )
    const existingTodo = controller.indexOf(
      'await completeAdminTodoGuarded(',
      existingClose,
    )
    const existingCleanup = controller.indexOf(
      'await cleanupWorktree(config, record, true)',
      existingTodo,
    )
    expect(existingRelease).toBeGreaterThan(-1)
    expect(existingComment).toBeGreaterThan(existingRelease)
    expect(existingClose).toBeGreaterThan(existingComment)
    expect(controller.slice(
      controller.indexOf('async function closeControllerIssue('),
      existingRelease,
    )).toContain("state: 'closed'")
    expect(existingTodo).toBeGreaterThan(existingClose)
    expect(existingCleanup).toBeGreaterThan(existingTodo)
  })

  it('directs workers to gather Home Assistant evidence before asking the operator', () => {
    const prompt = buildWorkerPrompt(record())
    expect(prompt).toContain('Use the configured Home Assistant MCP server directly')
    expect(prompt).toContain('operator-equivalent Home Assistant access')
    expect(prompt).toContain('Gather available Home Assistant evidence yourself')
    expect(prompt).toContain('artifacts/admin-issue-321/')
    expect(prompt).toContain('"visualEvidence"')
    expect(prompt).toContain('"resolved_without_pr"')
    expect(prompt).toContain('"visualChange"')
    expect(prompt).toContain('both the pull request and the GitHub issue update')
    expect(prompt).toContain('Images supplement tests')
    expect(prompt).toContain('Manual iOS follow-up is exceptional')
    expect(prompt).toContain('An iPhone involved only as a Home Assistant presence device')
    expect(prompt).not.toContain('Do not use host filesystem, shell, GitHub, Home Assistant')

    const layoutRecord = record()
    layoutRecord.automationKind = 'layout'
    const layoutPrompt = buildWorkerPrompt(layoutRecord)
    expect(layoutPrompt).toContain('trusted layout-failure issue')
    expect(layoutPrompt).toContain('docs/ux/layouts.md')
    expect(layoutPrompt).toContain('scripts/layout')
    expect(layoutPrompt).toContain('focused provenance-bound mixed-context runs')
    expect(layoutPrompt).toContain('protected post-merge Automated layout job')
    expect(layoutPrompt).not.toContain('.github/workflows/deploy-dashboard.yml')
  })

  it('keeps a long operator research-only issue open and prevents implementation', () => {
    const summary =
      `${'Investigate the vacuum actions and dock clean interaction. '.repeat(6)}` +
      'I want you to research and propose what we should do next, but I don’t want you to actually go implement anything yet.'
    const issue = record()
    issue.title = issueTitle(summary)
    issue.description = ''
    issue.inputs[0].body = ''
    issue.receipts.researchOnlyScope = 'true'
    issue.worktreePath = '/private/issue-worktree'
    const config = { ownerId: 3988463, ownerLogin: 'SFenton' }
    const body = issueBody({ description: '', summary, uid: issue.uid })
    const githubIssue = {
      author_association: 'OWNER',
      body,
      created_at: issue.createdAt,
      html_url: issue.issueUrl,
      number: issue.issueNumber,
      state: 'open' as const,
      title: issue.title,
      updated_at: issue.updatedAt,
      user: { id: config.ownerId, login: config.ownerLogin },
    }
    expect(issue.title).not.toContain('don’t want you')
    expect(buildInitialInput({
      status: 'needs_action', summary, uid: issue.uid,
    }).body).toBe(summary)
    expect(canonicalWorkerIssueBody(config, issue, githubIssue)).toBe(body)
    expect(researchOnlyRequested(issue, body)).toBe(true)
    const prompt = buildWorkerPrompt(issue, body)
    expect(prompt).toContain('research-only')
    expect(prompt).toContain('don’t want you to actually go implement anything yet')
    expect(prompt).not.toContain('Otherwise implement the complete fix')
    expect(workerHassPermissionArgs('hass', true)).toContain('hass(ha_get_state)')
    expect(workerHassPermissionArgs('hass', true)).toContain('hass(ha_get_history)')
    expect(workerHassPermissionArgs('hass', true)).not.toContain('hass')
    expect(workerHassPermissionArgs('hass', true)).not.toContain('hass(ha_call_service)')
    expect(workerHassPermissionArgs('hass', false)).toEqual(['--allow-tool', 'hass'])
    expect(() => assertResearchOnlyOutcome(issue, { decision: 'ready_for_pr' }, []))
      .toThrow('cannot implement or close')
    expect(() => assertResearchOnlyOutcome(issue, { decision: 'resolved_without_pr' }, []))
      .toThrow('cannot implement or close')
    expect(() => assertResearchOnlyOutcome(issue, { decision: 'needs_input' }, ['src/changed.tsx']))
      .toThrow('must leave its assigned worktree clean')
    expect(() => assertResearchOnlyOutcome(issue, { decision: 'needs_input' }, []))
      .not.toThrow()
    expect(() => canonicalWorkerIssueBody(config, issue, {
      ...githubIssue,
      body: 'Owner marker missing',
    })).toThrow('lost its owner or UID')
    expect(() => canonicalWorkerIssueBody(config, issue, {
      ...githubIssue,
      state: 'closed',
    })).toThrow('not a bound, open')

    appendIssueInput(issue, {
      body: 'Please implement this now',
      createdAt: '2026-09-24T17:00:00.000Z',
      externalId: 'comment:owner-approval',
      source: 'issue-comment',
    })
    expect(researchOnlyRequested(issue, body)).toBe(false)
    expect(buildWorkerPrompt(issue, body)).toContain('Otherwise implement the complete fix')
  })
})
