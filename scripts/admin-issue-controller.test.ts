// @covers scripts/admin-issue-controller.ts
// @covers scripts/lib/adminIssueController.ts
// @covers ops/admin-issue-controller/worker-extension.mjs
// @covers ops/admin-issue-controller/controller.json.example
// @covers ops/admin-issue-controller/admin-issue-controller.service
// @covers ops/admin-issue-controller/tandem-research/SKILL.md
// @covers package.json
// @covers .gitignore

import { execFileSync } from 'node:child_process'
import {
  chmodSync,
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
  AdminIssueProvenanceError,
  assertDeploymentRunSucceeded,
  assertExactCandidateSnapshot,
  assertSuccessfulLayoutWorkflowRun,
  assertResolvedWithoutPullRequestSnapshot,
  assertIssueCommentBodyContainsVisualEvidence,
  assertWorkerHostConfigurationSafe,
  assertWorkerChangesSafe,
  assertPullRequestBinding,
  assertPullRequestContainsVisualEvidence,
  buildCopilotWorkerArgs,
  buildWorkerPrompt,
  classifyPullRequestHead,
  collectVisualEvidenceReceipts,
  commitIsAncestor,
  createCommittedDiffReceipt,
  deploymentRecoveryDue,
  findExactMergeCommit,
  githubRepositoryFromRemote,
  hasRecoverableDeployment,
  hasRecoverableTransition,
  latestSuccessfulDeploymentRunPath,
  layoutWorkflowRunsPath,
  loadAdminIssueControllerConfig,
  loadAdminIssueControllerState,
  prepareCommittedCandidate,
  prepareCopilotHome,
  pullRequestBodyWithVisualEvidence,
  readWorktreeSnapshot,
  restoreReadyOutcomeFromWorkerLog,
  runCommand,
  selectWorkerHassMcpConfig,
  selectWorkerSessionCandidate,
  shouldRetryWorkerSessionWithoutName,
  shouldVerifyExistingPullRequestVisualEvidence,
  summarizeFailedCheckLogs,
  synchronizeCandidateBase,
  waitForMergedPullRequest,
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
  REQUIRED_DEPLOYMENT_VERIFIED_PATHS,
  sessionNameForIssue,
  todoFingerprint,
  type AdminIssueRecord,
  type AdminIssueControllerState,
  type AdminIssueDiffReceipt,
  type AdminIssueValidationReceipt,
} from './lib/adminIssueController'

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
    version: 2,
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
      version: 2,
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
    expect(migrated.version).toBe(2)
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
    expect(migrated.version).toBe(2)
    expect(migrated.issues[pristine.uid].provenance).toEqual({ kind: 'none' })
    const backups = readdirSync(stateDirectory).filter((entry) =>
      entry.startsWith('state.v1-backup-'),
    )
    expect(backups).toHaveLength(1)
    expect(statSync(join(stateDirectory, backups[0])).mode & 0o777).toBe(0o600)
    expect(JSON.parse(readFileSync(join(stateDirectory, 'state.json'), 'utf8')).version).toBe(2)
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
    if (issue.provenance.kind !== 'active') throw new Error('Expected active provenance')
    expect(issue.provenance.revision).toBe(2)
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
    expect(() =>
      selectWorkerHassMcpConfig(JSON.parse(readFileSync(hassMcpConfigPath, 'utf8')), 'missing'),
    ).toThrow('is not configured')

    writeFileSync(configPath, JSON.stringify({ ...base, workerHome: homedir() }))
    expect(() => loadAdminIssueControllerConfig(configPath)).toThrow('must be a child')

    writeFileSync(configPath, JSON.stringify({ ...base, requiredChecks: [] }))
    expect(() => loadAdminIssueControllerConfig(configPath)).toThrow(
      'requiredChecks must include at least one protected check',
    )

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
    expect(controller).toContain('recoverBlockedDeployments(config, client, state)')
    expect(controller).toContain('loadBoundDeploymentReceipt(config, record)')
    expect(controller).toContain("record.automationKind === 'layout'")
    expect(controller).toContain('waitForLayoutWorkflow(')
    expect(controller).toContain('bindVerifiedLayoutWorkflow(record, run)')
    expect(controller).toContain('finalizeLayoutIssue(config, state, record, run)')
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
})
