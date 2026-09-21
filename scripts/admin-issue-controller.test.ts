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
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  assertWorkerHostConfigurationSafe,
  assertWorkerChangesSafe,
  buildWorkerPrompt,
  githubRepositoryFromRemote,
  loadAdminIssueControllerConfig,
  prepareCopilotHome,
  recoverableCommittedHead,
  selectWorkerHassMcpConfig,
} from './admin-issue-controller'
import {
  CONTROLLER_COMMENT_MARKER,
  adminIssueMarker,
  appendIssueInput,
  baselineAdminIssueState,
  beginAdminIssueGeneration,
  branchNameForIssue,
  controllerReceiptMarker,
  deploymentReceiptIsAccepted,
  formatBlockedComment,
  formatCompletionComment,
  formatPullRequestComment,
  formatQuestionsComment,
  isTrustedIssueComment,
  issueBody,
  issueTitle,
  markIssueInputsProcessed,
  neutralizeGitHubClosingReferences,
  parseWorkerOutcome,
  pendingIssueInputs,
  REQUIRED_DEPLOYMENT_VERIFIED_PATHS,
  sessionNameForIssue,
  todoFingerprint,
  type AdminIssueRecord,
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
      version: 1,
    })

    const issue = record()
    issue.branch = 'copilot/admin-todo-321-g1-fix'
    issue.worktreePath = '/tmp/worktree'
    issue.baseSha = 'a'.repeat(40)
    issue.pr = { headSha: 'b'.repeat(40), number: 400, url: 'https://example.test/pr/400' }
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
    const sessionName = issue.sessionName

    beginAdminIssueGeneration(issue, '2026-09-20T12:02:00.000Z')

    expect(issue).toMatchObject({
      branch: undefined,
      generation: 2,
      phase: 'queued',
      pr: undefined,
      repairAttempts: 0,
      sessionName,
      updatedAt: '2026-09-20T12:02:00.000Z',
      worktreePath: undefined,
    })
    expect(issue.receipts.awaitingIosVerificationAt).toBeUndefined()
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
      }),
    )
    expect(ready).toMatchObject({
      changeSummary: ['Aligned terminal spacing with the dock-to-navigation gap.'],
      decision: 'ready_for_pr',
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
    issue.pr = {
      headSha: 'a'.repeat(40),
      number: 400,
      url: 'https://github.com/SFenton/ha-sfenton-react-dash/pull/400',
    }
    expect(formatPullRequestComment(issue.uid, issue.inputRevision, issue.pr, readyOutcome)).toContain(
      issue.pr.url,
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
})

describe('admin issue controller security configuration', () => {
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

  it('recovers a clean validated commit that was not journaled as a pull request', async () => {
    const repositoryPath = mkdtempSync(join(homedir(), '.admin-issue-controller-git-test-'))
    temporaryDirectories.push(repositoryPath)
    const git = (...args: string[]) =>
      execFileSync('git', args, { cwd: repositoryPath, encoding: 'utf8' }).trim()
    git('init', '--initial-branch=master')
    git('config', 'user.name', 'Admin Issue Controller Test')
    git('config', 'user.email', 'controller-test@example.invalid')
    writeFileSync(join(repositoryPath, 'fixture.txt'), 'base\n')
    git('add', 'fixture.txt')
    git('commit', '-m', 'Base')
    const baseSha = git('rev-parse', 'HEAD')
    git('switch', '-c', 'copilot/admin-todo-321-g1-fix')
    writeFileSync(join(repositoryPath, 'fixture.txt'), 'fixed\n')
    git('commit', '-am', 'Fix')
    const headSha = git('rev-parse', 'HEAD')
    const issue = record()
    issue.baseSha = baseSha
    issue.branch = 'copilot/admin-todo-321-g1-fix'
    issue.worktreePath = repositoryPath
    issue.processedRevision = 1
    issue.receipts.validatedWorkerInput = '1:1'

    await expect(recoverableCommittedHead(issue)).resolves.toBe(headSha)

    writeFileSync(join(repositoryPath, 'fixture.txt'), 'dirty\n')
    await expect(recoverableCommittedHead(issue)).resolves.toBeUndefined()
    issue.receipts.validatedWorkerInput = '1:0'
    git('checkout', '--', 'fixture.txt')
    await expect(recoverableCommittedHead(issue)).resolves.toBeUndefined()
  })

  it('allows only auto-deployed dashboard paths from workers', () => {
    expect(() => assertWorkerChangesSafe('/tmp', ['src/App.tsx', 'e2e/app.spec.ts'])).not.toThrow()
    expect(() => assertWorkerChangesSafe('/tmp', ['home-assistant/packages/example.yaml'])).toThrow(
      'outside the auto-deployed dashboard',
    )
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
    expect(controller).toContain('disableAllHooks: true')
    expect(controller).toContain("'installed-plugins'")
    expect(controller).toContain("const ALLOWED_WORKER_PATHS = ['e2e/', 'public/', 'src/']")
    expect(controller).not.toContain("'--allow-all-tools'")
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
    expect(prompt).not.toContain('Do not use host filesystem, shell, GitHub, Home Assistant')
  })
})
