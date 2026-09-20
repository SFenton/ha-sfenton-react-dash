#!/usr/bin/env tsx

import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  chmodSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
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
  sessionNameForIssue,
  todoFingerprint,
  type AdminIssueControllerState,
  type AdminIssueInput,
  type AdminIssueRecord,
  type AdminIssueWorkerOutcome,
  type GitHubIssueComment,
} from './lib/adminIssueController'
import {
  HassAdminTodoClient,
  adminCompletionBoundarySatisfied,
  type HassTodoItem,
} from './lib/hassAdminTodo'

interface AdminIssueControllerConfig {
  completionReceiptEntityId: string
  completionScript: string
  deploymentPollSeconds: number
  deploymentTimeoutMinutes: number
  issueLabels: string[]
  maxRepairAttempts: number
  ownerId: number
  ownerLogin: string
  pollSeconds: number
  repository: string
  repositoryId: number
  requiredCheckAppId: number
  repositoryPath: string
  requiredChecks: string[]
  requiredWorkflow: string
  stateDirectory: string
  todoEntityId: string
  tandemSkillPath: string
  workerExtensionPath: string
  workerImageId: string
  workerHome: string
  workerTimeoutMinutes: number
  worktreeRoot: string
}

interface CommandOptions {
  allowFailure?: boolean
  cwd?: string
  env?: NodeJS.ProcessEnv
  input?: string
  maxOutputBytes?: number
  timeoutMs?: number
}

interface CommandResult {
  exitCode: number
  stderr: string
  stdout: string
}

interface GitHubIssue {
  body: string | null
  html_url: string
  number: number
  state: 'open' | 'closed'
  title: string
  updated_at: string
}

interface GitHubPullRequest {
  head: {
    sha: string
  }
  html_url: string
  merge_commit_sha: string | null
  merged_at: string | null
  number: number
  state: 'open' | 'closed'
}

interface CheckRun {
  app: {
    id: number
  }
  conclusion: string | null
  details_url: string | null
  id: number
  name: string
  status: string
}

interface WorkflowRun {
  conclusion: string | null
  head_sha: string
  html_url: string
  id: number
  run_attempt: number
  status: string
}

interface DeploymentReceipt extends Record<string, unknown> {
  deployedAt: string
  deployedSha: string
  disposition: string
}

type ActionableTodoItem = HassTodoItem & {
  status: 'needs_action'
  summary: string
  uid: string
}

const STATE_VERSION = 1 as const
const MAX_GITHUB_BODY_BYTES = 60_000
const MAX_WORKER_OUTPUT_BYTES = 50 * 1024 * 1024
const ALLOWED_WORKER_PATHS = ['e2e/', 'public/', 'src/']
const PROTECTED_WORKER_PATHS = [
  '.gitattributes',
  '.git',
  '.gitignore',
  '.gitmodules',
  '.github/',
  'eslint.config.js',
  'ops/admin-issue-controller/',
  'package-lock.json',
  'package.json',
  'playwright.config.ts',
  'scripts/admin-issue-controller.test.ts',
  'scripts/admin-issue-controller.ts',
  'scripts/design-system/',
  'scripts/e2e-coverage-check.ts',
  'scripts/i18n/',
  'scripts/lib/adminIssueController.ts',
  'scripts/lib/hassAdminTodo.test.ts',
  'scripts/lib/hassAdminTodo.ts',
  'scripts/test-change-policy.ts',
  'tsconfig.app.json',
  'tsconfig.json',
  'tsconfig.node.json',
  'tsconfig.validation.json',
  'vite.config.ts',
  'vitest.config.ts',
]

function isMaskedWorkspaceFile(path: string) {
  return !path.includes('/') && (
    path.startsWith('.env') ||
    path === '.npmrc' ||
    path === '.yarnrc' ||
    path === '.yarnrc.yml'
  )
}

function now() {
  return new Date().toISOString()
}

function sleep(milliseconds: number) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, milliseconds))
}

function loadControllerEnvironment() {
  for (const path of [
    resolve(process.cwd(), '.env.development'),
    resolve(process.cwd(), '.env'),
  ]) {
    if (existsSync(path)) process.loadEnvFile(path)
  }
}

function truncate(value: string, maxBytes: number) {
  const buffer = Buffer.from(value)
  if (buffer.length <= maxBytes) return value
  return `${buffer.subarray(0, maxBytes).toString()}\n\n[truncated by admin issue controller]`
}

function parsePositiveInteger(value: unknown, field: string) {
  if (!Number.isInteger(value) || Number(value) <= 0) {
    throw new Error(`${field} must be a positive integer`)
  }
  return Number(value)
}

function parseNonEmptyString(value: unknown, field: string) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${field} must be a non-empty string`)
  }
  return value.trim()
}

function parseStringArray(value: unknown, field: string) {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string' || !entry.trim())) {
    throw new Error(`${field} must be an array of non-empty strings`)
  }
  return value.map((entry) => entry.trim())
}

function resolveInside(basePath: string, candidate: string, field: string) {
  const absolute = resolve(candidate.replace(/^~(?=\/|$)/, homedir()))
  const relativePath = relative(resolve(basePath), absolute)
  if (
    !relativePath ||
    relativePath === '..' ||
    relativePath.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`)
  ) {
    throw new Error(`${field} must be a child of ${basePath}`)
  }
  return absolute
}

function pathsOverlap(left: string, right: string) {
  const leftToRight = relative(resolve(left), resolve(right))
  const rightToLeft = relative(resolve(right), resolve(left))
  const outside = (value: string) =>
    value === '..' || value.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`)
  return !outside(leftToRight) || !outside(rightToLeft)
}

export function loadAdminIssueControllerConfig(configPath: string): AdminIssueControllerConfig {
  const raw = JSON.parse(readFileSync(resolve(configPath), 'utf8')) as Record<string, unknown>
  const repositoryPath = realpathSync(parseNonEmptyString(raw.repositoryPath, 'repositoryPath'))
  const repository = parseNonEmptyString(raw.repository, 'repository')
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
    throw new Error('repository must be owner/name')
  }

  const stateDirectory = resolveInside(
    homedir(),
    parseNonEmptyString(raw.stateDirectory, 'stateDirectory'),
    'stateDirectory',
  )
  const worktreeRoot = resolveInside(
    homedir(),
    parseNonEmptyString(raw.worktreeRoot, 'worktreeRoot'),
    'worktreeRoot',
  )
  const workerHome = resolveInside(
    homedir(),
    parseNonEmptyString(raw.workerHome, 'workerHome'),
    'workerHome',
  )
  const workerExtensionPath = realpathSync(
    parseNonEmptyString(raw.workerExtensionPath, 'workerExtensionPath').replace(
      /^~(?=\/|$)/,
      homedir(),
    ),
  )
  const tandemSkillPath = realpathSync(
    parseNonEmptyString(raw.tandemSkillPath, 'tandemSkillPath').replace(
      /^~(?=\/|$)/,
      homedir(),
    ),
  )
  const workerImageId = parseNonEmptyString(raw.workerImageId, 'workerImageId')
  if (!/^sha256:[a-f0-9]{64}$/.test(workerImageId)) {
    throw new Error('workerImageId must be an immutable sha256 image ID')
  }
  const requiredChecks = parseStringArray(
    raw.requiredChecks ?? ['Playwright gate'],
    'requiredChecks',
  )
  if (requiredChecks.length === 0) {
    throw new Error('requiredChecks must include at least one protected check')
  }
  const mutablePaths = [
    ['stateDirectory', stateDirectory],
    ['workerHome', workerHome],
    ['worktreeRoot', worktreeRoot],
  ] as const
  for (const [field, path] of mutablePaths) {
    if (pathsOverlap(repositoryPath, path)) {
      throw new Error(`${field} must not overlap repositoryPath`)
    }
  }
  for (let index = 0; index < mutablePaths.length; index += 1) {
    for (let other = index + 1; other < mutablePaths.length; other += 1) {
      if (pathsOverlap(mutablePaths[index][1], mutablePaths[other][1])) {
        throw new Error(`${mutablePaths[index][0]} must not overlap ${mutablePaths[other][0]}`)
      }
    }
  }

  return {
    completionReceiptEntityId: parseNonEmptyString(
      raw.completionReceiptEntityId,
      'completionReceiptEntityId',
    ),
    completionScript: parseNonEmptyString(raw.completionScript, 'completionScript'),
    deploymentPollSeconds: parsePositiveInteger(
      raw.deploymentPollSeconds ?? 20,
      'deploymentPollSeconds',
    ),
    deploymentTimeoutMinutes: parsePositiveInteger(
      raw.deploymentTimeoutMinutes ?? 90,
      'deploymentTimeoutMinutes',
    ),
    issueLabels: parseStringArray(raw.issueLabels ?? ['bug'], 'issueLabels'),
    maxRepairAttempts: parsePositiveInteger(raw.maxRepairAttempts ?? 3, 'maxRepairAttempts'),
    ownerId: parsePositiveInteger(raw.ownerId, 'ownerId'),
    ownerLogin: parseNonEmptyString(raw.ownerLogin, 'ownerLogin'),
    pollSeconds: parsePositiveInteger(raw.pollSeconds ?? 30, 'pollSeconds'),
    repository,
    repositoryId: parsePositiveInteger(raw.repositoryId, 'repositoryId'),
    repositoryPath,
    requiredCheckAppId: parsePositiveInteger(
      raw.requiredCheckAppId,
      'requiredCheckAppId',
    ),
    requiredChecks,
    requiredWorkflow: parseNonEmptyString(
      raw.requiredWorkflow ?? 'deploy-dashboard.yml',
      'requiredWorkflow',
    ),
    stateDirectory,
    tandemSkillPath,
    todoEntityId: parseNonEmptyString(raw.todoEntityId, 'todoEntityId'),
    workerExtensionPath,
    workerImageId,
    workerHome,
    workerTimeoutMinutes: parsePositiveInteger(raw.workerTimeoutMinutes ?? 90, 'workerTimeoutMinutes'),
    worktreeRoot,
  }
}

async function runCommand(
  file: string,
  args: string[],
  options: CommandOptions = {},
): Promise<CommandResult> {
  const maxOutputBytes = options.maxOutputBytes ?? 10 * 1024 * 1024
  return await new Promise((resolveCommand, rejectCommand) => {
    const child = spawn(file, args, {
      cwd: options.cwd,
      env: options.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    const stdout: Buffer[] = []
    const stderr: Buffer[] = []
    let outputBytes = 0
    let timedOut = false
    let timeout: NodeJS.Timeout | undefined

    const capture = (target: Buffer[], chunk: Buffer) => {
      outputBytes += chunk.length
      if (outputBytes > maxOutputBytes) {
        child.kill('SIGKILL')
        rejectCommand(new Error(`${file} exceeded the ${maxOutputBytes}-byte output limit`))
        return
      }
      target.push(chunk)
    }

    child.stdout.on('data', (chunk: Buffer) => capture(stdout, chunk))
    child.stderr.on('data', (chunk: Buffer) => capture(stderr, chunk))
    child.on('error', rejectCommand)
    child.on('close', (exitCode, signal) => {
      if (timeout) clearTimeout(timeout)
      const result = {
        exitCode: exitCode ?? (signal ? 128 : 1),
        stderr: Buffer.concat(stderr).toString(),
        stdout: Buffer.concat(stdout).toString(),
      }
      if (timedOut) {
        rejectCommand(new Error(`${file} timed out after ${options.timeoutMs} ms`))
        return
      }
      if (result.exitCode !== 0 && !options.allowFailure) {
        rejectCommand(
          new Error(
            truncate(
              `${file} ${args.join(' ')} failed with exit ${result.exitCode}\n${result.stderr}\n${result.stdout}`,
              24_000,
            ),
          ),
        )
        return
      }
      resolveCommand(result)
    })

    if (options.timeoutMs) {
      timeout = setTimeout(() => {
        timedOut = true
        child.kill('SIGKILL')
      }, options.timeoutMs)
    }

    if (options.input !== undefined) child.stdin.end(options.input)
    else child.stdin.end()
  })
}

async function ghApi<T>(
  config: AdminIssueControllerConfig,
  method: 'GET' | 'POST' | 'PATCH',
  endpoint: string,
  body?: unknown,
): Promise<T> {
  const args = ['api', '--method', method, endpoint]
  let temporaryDirectory: string | undefined
  try {
    if (body !== undefined) {
      temporaryDirectory = mkdtempSync(join(tmpdir(), 'admin-issue-gh-'))
      const bodyPath = join(temporaryDirectory, 'body.json')
      writeFileSync(bodyPath, JSON.stringify(body), { mode: 0o600 })
      args.push('--input', bodyPath)
    }
    const result = await runCommand('gh', args, {
      cwd: config.repositoryPath,
      timeoutMs: 60_000,
    })
    return JSON.parse(result.stdout) as T
  } finally {
    if (temporaryDirectory) rmSync(temporaryDirectory, { force: true, recursive: true })
  }
}

async function verifyRepositoryIdentity(config: AdminIssueControllerConfig) {
  const repository = await ghApi<{
    full_name: string
    id: number
    owner: { id: number; login: string }
  }>(config, 'GET', `repos/${config.repository}`)
  if (
    repository.id !== config.repositoryId ||
    repository.full_name !== config.repository ||
    repository.owner.id !== config.ownerId ||
    repository.owner.login !== config.ownerLogin
  ) {
    throw new Error('GitHub repository identity does not match the pinned controller configuration')
  }
  const topLevel = realpathSync(
    (
      await runCommand('git', ['rev-parse', '--show-toplevel'], {
        cwd: config.repositoryPath,
      })
    ).stdout.trim(),
  )
  if (topLevel !== config.repositoryPath) {
    throw new Error(`repositoryPath resolves to ${topLevel}, expected ${config.repositoryPath}`)
  }
  const origin = (
    await runCommand('git', ['remote', 'get-url', 'origin'], {
      cwd: config.repositoryPath,
    })
  ).stdout.trim()
  if (githubRepositoryFromRemote(origin)?.toLowerCase() !== config.repository.toLowerCase()) {
    throw new Error(`Git origin ${origin} does not match ${config.repository}`)
  }
}

export function githubRepositoryFromRemote(remote: string) {
  const scp = remote.match(/^git@github\.com:([^/]+\/[^/]+?)(?:\.git)?$/i)
  if (scp) return scp[1]
  try {
    const url = new URL(remote)
    if (url.hostname.toLowerCase() !== 'github.com') return undefined
    const repository = url.pathname.replace(/^\/+|\/+$/g, '').replace(/\.git$/i, '')
    return /^[^/]+\/[^/]+$/.test(repository) ? repository : undefined
  } catch {
    return undefined
  }
}

async function verifyRuntimePreconditions(config: AdminIssueControllerConfig) {
  await verifyRepositoryIdentity(config)
  if (!existsSync(config.workerExtensionPath)) {
    throw new Error(`Missing worker extension: ${config.workerExtensionPath}`)
  }
  if (!existsSync(config.tandemSkillPath)) {
    throw new Error(`Missing tandem skill: ${config.tandemSkillPath}`)
  }
  const image = await runCommand(
    'docker',
    ['image', 'inspect', '--format', '{{.Id}}', config.workerImageId],
    {
      timeoutMs: 60_000,
    },
  )
  if (image.stdout.trim() !== config.workerImageId) {
    throw new Error(
      `Worker image mismatch: expected ${config.workerImageId}, received ${image.stdout.trim()}`,
    )
  }
  await runCommand('copilot', ['--version'], { timeoutMs: 30_000 })
}

async function cleanupStaleWorkerContainers() {
  const result = await runCommand(
    'docker',
    [
      'ps',
      '--all',
      '--quiet',
      '--filter',
      'label=com.sfenton.admin-issue-controller=true',
    ],
    { timeoutMs: 30_000 },
  )
  for (const containerId of result.stdout.split(/\r?\n/).filter(Boolean)) {
    await runCommand('docker', ['rm', '--force', containerId], {
      timeoutMs: 30_000,
    })
  }
}

function statePath(config: AdminIssueControllerConfig) {
  return join(config.stateDirectory, 'state.json')
}

function assertState(value: unknown): asserts value is AdminIssueControllerState {
  if (!value || typeof value !== 'object') throw new Error('Controller state must be an object')
  const state = value as Partial<AdminIssueControllerState>
  if (state.version !== STATE_VERSION) throw new Error(`Unsupported controller state version ${state.version}`)
  if (!Array.isArray(state.ignoredUids) || !state.issues || typeof state.issues !== 'object') {
    throw new Error('Controller state is malformed')
  }
}

function loadState(config: AdminIssueControllerConfig) {
  const path = statePath(config)
  if (!existsSync(path)) {
    throw new Error(`Controller is not baselined. Run baseline first; missing ${path}`)
  }
  const state = JSON.parse(readFileSync(path, 'utf8')) as unknown
  assertState(state)
  return state
}

function writeState(config: AdminIssueControllerConfig, state: AdminIssueControllerState) {
  mkdirSync(config.stateDirectory, { mode: 0o700, recursive: true })
  const path = statePath(config)
  const temporaryPath = `${path}.${process.pid}.tmp`
  state.updatedAt = now()
  writeFileSync(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 })
  renameSync(temporaryPath, path)
  chmodSync(path, 0o600)
}

async function withControllerLock<T>(
  config: AdminIssueControllerConfig,
  callback: () => Promise<T>,
): Promise<T> {
  mkdirSync(config.stateDirectory, { mode: 0o700, recursive: true })
  const lockPath = join(config.stateDirectory, 'controller.lock')
  try {
    mkdirSync(lockPath, { mode: 0o700 })
  } catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'EEXIST') throw error
    const ownerPath = join(lockPath, 'owner.json')
    let ownerPid: number | undefined
    let deadOwner = false
    if (existsSync(ownerPath)) {
      try {
        const owner = JSON.parse(readFileSync(ownerPath, 'utf8')) as { pid?: unknown }
        if (Number.isInteger(owner.pid)) ownerPid = Number(owner.pid)
      } catch {
        ownerPid = undefined
      }
    }
    if (ownerPid !== undefined) {
      try {
        process.kill(ownerPid, 0)
        throw new Error(`Controller lock is already held by PID ${ownerPid}`, { cause: error })
      } catch (processError) {
        if (
          !(processError instanceof Error) ||
          !('code' in processError) ||
          processError.code !== 'ESRCH'
        ) {
          throw processError
        }
        deadOwner = true
      }
    }
    const ageMs = Date.now() - statSync(lockPath).mtimeMs
    if (!deadOwner && ageMs < 6 * 60 * 60 * 1000) {
      throw new Error(`Controller lock is already held: ${lockPath}`, { cause: error })
    }
    rmSync(lockPath, { force: true, recursive: true })
    mkdirSync(lockPath, { mode: 0o700 })
  }
  writeFileSync(join(lockPath, 'owner.json'), JSON.stringify({ pid: process.pid, startedAt: now() }), {
    mode: 0o600,
  })
  try {
    return await callback()
  } finally {
    rmSync(lockPath, { force: true, recursive: true })
  }
}

function actionableTodoItem(item: HassTodoItem): item is ActionableTodoItem {
  if (item.status !== 'needs_action') return false
  if (!item.uid?.trim() || !item.summary?.trim()) {
    throw new Error('Home Assistant returned an actionable Admin To-Do item without uid or summary')
  }
  return true
}

async function findIssueByUid(config: AdminIssueControllerConfig, uid: string) {
  const marker = adminIssueMarker(uid)
  for (let page = 1; page <= 100; page += 1) {
    const issues = await ghApi<GitHubIssue[]>(
      config,
      'GET',
      `repos/${config.repository}/issues?state=all&sort=created&direction=desc&per_page=100&page=${page}`,
    )
    const match = issues.find((issue) => issue.body?.includes(marker))
    if (match) return match
    if (issues.length < 100) return undefined
  }
  throw new Error(`Repository exceeds the controller's 10,000-issue reconciliation safety limit`)
}

async function listIssueComments(config: AdminIssueControllerConfig, issueNumber: number) {
  const comments: GitHubIssueComment[] = []
  for (let page = 1; page <= 100; page += 1) {
    const batch = await ghApi<GitHubIssueComment[]>(
      config,
      'GET',
      `repos/${config.repository}/issues/${issueNumber}/comments?per_page=100&page=${page}`,
    )
    comments.push(...batch)
    if (batch.length < 100) return comments
  }
  throw new Error(`Issue #${issueNumber} exceeds the controller's 10,000-comment safety limit`)
}

async function postIssueCommentOnce(
  config: AdminIssueControllerConfig,
  issueNumber: number,
  uid: string,
  receipt: string,
  body: string,
) {
  const marker = controllerReceiptMarker(uid, receipt)
  const comments = await listIssueComments(config, issueNumber)
  const existing = comments.find((comment) => comment.body?.includes(marker))
  if (existing) return existing
  const controllerBody = body.includes(CONTROLLER_COMMENT_MARKER)
    ? body
    : `${CONTROLLER_COMMENT_MARKER}\n${body}`
  return await ghApi<GitHubIssueComment>(
    config,
    'POST',
    `repos/${config.repository}/issues/${issueNumber}/comments`,
    { body: controllerBody.includes(marker) ? controllerBody : `${controllerBody}\n\n${marker}` },
  )
}

function buildInitialInput(item: ActionableTodoItem): AdminIssueInput {
  const fingerprint = todoFingerprint(item.summary, item.description)
  return {
    body: item.description?.trim() || '',
    createdAt: now(),
    externalId: `todo:${fingerprint}`,
    revision: 1,
    source: 'todo-created',
  }
}

async function reconcileTodos(
  config: AdminIssueControllerConfig,
  client: HassAdminTodoClient,
  state: AdminIssueControllerState,
) {
  const items = await client.getItems(config.todoEntityId)
  for (const item of items) {
    if (!actionableTodoItem(item) || state.ignoredUids.includes(item.uid)) continue
    const fingerprint = todoFingerprint(item.summary, item.description)
    let record = state.issues[item.uid]
    if (!record) {
      let issue = await findIssueByUid(config, item.uid)
      if (!issue) {
        issue = await ghApi<GitHubIssue>(
          config,
          'POST',
          `repos/${config.repository}/issues`,
          {
            body: issueBody({
              description: item.description ?? '',
              summary: item.summary,
              uid: item.uid,
            }),
            labels: config.issueLabels,
            title: issueTitle(item.summary),
          },
        )
      }
      const createdAt = now()
      record = {
        commentCursor: 0,
        createdAt,
        description: item.description?.trim() || '',
        generation: 1,
        inputRevision: 1,
        inputs: [buildInitialInput(item)],
        issueNumber: issue.number,
        issueUrl: issue.html_url,
        phase: 'queued',
        processedRevision: 0,
        receipts: {
          githubIssueCreatedAt: createdAt,
        },
        repairAttempts: 0,
        sessionName: sessionNameForIssue(issue.number, item.uid),
        taskFingerprint: fingerprint,
        title: issueTitle(item.summary),
        uid: item.uid,
        updatedAt: createdAt,
        workerRuns: 0,
      }
      state.issues[item.uid] = record
      writeState(config, state)
      continue
    }

    if (record.taskFingerprint === fingerprint) continue
    const previousFingerprint = record.taskFingerprint
    await ghApi(
      config,
      'PATCH',
      `repos/${config.repository}/issues/${record.issueNumber}`,
      {
        body: issueBody({
          description: item.description ?? '',
          summary: item.summary,
          uid: item.uid,
        }),
        title: issueTitle(item.summary),
      },
    )
    await postIssueCommentOnce(
      config,
      record.issueNumber,
      record.uid,
      `todo-update-${fingerprint}`,
      [
        '**Admin To-Do updated**',
        '',
        item.description?.trim() || '_No additional details were supplied._',
      ].join('\n'),
    )
    record.taskFingerprint = fingerprint
    record.title = issueTitle(item.summary)
    record.description = item.description?.trim() || ''
    appendIssueInput(record, {
      body: item.description?.trim() || '',
      createdAt: now(),
      externalId: `todo:${fingerprint}`,
      source: 'todo-updated',
    })
    if (previousFingerprint !== fingerprint && !['deploying', 'completed'].includes(record.phase)) {
      record.phase = 'queued'
    }
    writeState(config, state)
  }
}

async function getIssue(config: AdminIssueControllerConfig, issueNumber: number) {
  return await ghApi<GitHubIssue>(
    config,
    'GET',
    `repos/${config.repository}/issues/${issueNumber}`,
  )
}

async function reconcileGitHubInputs(
  config: AdminIssueControllerConfig,
  state: AdminIssueControllerState,
) {
  for (const record of Object.values(state.issues)) {
    if (record.phase === 'completed') continue
    const issue = await getIssue(config, record.issueNumber)
    const comments = await listIssueComments(config, record.issueNumber)
    const unseenComments = comments
      .filter((comment) => comment.id > record.commentCursor)
      .sort((left, right) => left.id - right.id)
    for (const comment of unseenComments) {
      record.commentCursor = Math.max(record.commentCursor, comment.id)
      if (!isTrustedIssueComment(comment, config.ownerId, config.ownerLogin)) {
        continue
      }
      appendIssueInput(record, {
        body: comment.body ?? '',
        createdAt: comment.created_at ?? now(),
        externalId: `comment:${comment.id}`,
        source: 'issue-comment',
      })
      if (
        record.phase === 'awaiting-user' &&
        record.receipts.awaitingIosVerificationAt &&
        comment.body?.trim().toLowerCase() === 'ios verification passed'
      ) {
        record.receipts.iosVerifiedAt = comment.created_at ?? now()
        markIssueInputsProcessed(record, record.inputRevision, comment.created_at ?? now())
        record.phase = 'deploying'
      } else if (record.phase === 'awaiting-user' && record.receipts.awaitingIosVerificationAt) {
        await startNewGeneration(config, record)
      } else if (!['deploying', 'completed'].includes(record.phase)) {
        record.phase = 'queued'
      }
    }

    if (issue.state === 'closed' && !record.receipts.issueClosedAt) {
      const controllerCompleted = comments.some((comment) =>
        comment.body?.includes(controllerReceiptMarker(record.uid, 'completed')),
      )
      if (controllerCompleted && record.pr?.mergeSha && record.receipts.deployedAt) {
        record.phase = 'deploying'
        record.receipts.issueClosedAt = issue.updated_at
      } else {
        record.phase = 'paused'
        record.receipts.manuallyClosedAt = issue.updated_at
      }
    } else if (issue.state === 'open' && record.phase === 'paused') {
      await startNewGeneration(config, record)
      markIssueInputsProcessed(record, record.inputRevision, issue.updated_at)
      appendIssueInput(record, {
        body: 'The issue was reopened by its owner. Reassess the current repository state before continuing.',
        createdAt: issue.updated_at,
        externalId: `reopen:${record.generation}:${issue.updated_at}`,
        source: 'issue-comment',
      })
      delete record.receipts.manuallyClosedAt
    }

    record.updatedAt = now()
    writeState(config, state)
  }
}

async function startNewGeneration(
  config: AdminIssueControllerConfig,
  record: AdminIssueRecord,
) {
  if (record.pr && !record.pr.mergeSha) {
    await ghApi(
      config,
      'PATCH',
      `repos/${config.repository}/pulls/${record.pr.number}`,
      { state: 'closed' },
    )
    record.receipts.supersededPrClosedAt = now()
  }
  await cleanupWorktree(config, record, true)
  beginAdminIssueGeneration(record, now())
}

async function ensureWorktree(
  config: AdminIssueControllerConfig,
  state: AdminIssueControllerState,
  record: AdminIssueRecord,
) {
  await runCommand('git', ['fetch', '--quiet', 'origin', 'master'], {
    cwd: config.repositoryPath,
    timeoutMs: 120_000,
  })
  if (record.worktreePath && existsSync(record.worktreePath)) return record.worktreePath

  const branch =
    record.branch ?? branchNameForIssue(record.issueNumber, record.generation, record.title)
  const path = join(config.worktreeRoot, `issue-${record.issueNumber}-g${record.generation}`)
  mkdirSync(config.worktreeRoot, { mode: 0o700, recursive: true })
  if (existsSync(path)) {
    throw new Error(`Refusing to reuse an untracked worktree path: ${path}`)
  }
  const branchExists = await runCommand(
    'git',
    ['show-ref', '--verify', '--quiet', `refs/heads/${branch}`],
    { allowFailure: true, cwd: config.repositoryPath },
  )
  if (branchExists.exitCode === 0) {
    await runCommand('git', ['worktree', 'add', path, branch], {
      cwd: config.repositoryPath,
      timeoutMs: 120_000,
    })
  } else {
    await runCommand('git', ['worktree', 'add', '-b', branch, path, 'origin/master'], {
      cwd: config.repositoryPath,
      timeoutMs: 120_000,
    })
  }

  record.branch = branch
  record.worktreePath = realpathSync(path)
  record.baseSha ??= (
    await runCommand('git', ['rev-parse', 'origin/master'], { cwd: record.worktreePath })
  ).stdout.trim()
  record.updatedAt = now()
  writeState(config, state)

  await runCommand('npm', ['ci', '--no-audit', '--no-fund'], {
    cwd: record.worktreePath,
    env: {
      CI: 'true',
      HUSKY: '0',
      HOME: homedir(),
      LANG: process.env.LANG ?? 'C.UTF-8',
      PATH: process.env.PATH,
    },
    maxOutputBytes: 25 * 1024 * 1024,
    timeoutMs: 20 * 60 * 1000,
  })
  mkdirSync(join(record.worktreePath, 'node_modules/.vite-temp'), { recursive: true })
  return record.worktreePath
}

function prepareCopilotHome(config: AdminIssueControllerConfig) {
  const copilotHome = join(config.workerHome, '.copilot')
  const extensionDirectory = join(copilotHome, 'extensions', 'admin-issue-worker')
  const skillDirectory = join(copilotHome, 'skills', 'tandem-research')
  for (const path of [
    'agents',
    'copilot-instructions.md',
    'extensions',
    'hooks',
    'installed-plugins',
    'instructions',
    'mcp-config.json',
    'mcp.json',
    'skills',
  ]) {
    rmSync(join(copilotHome, path), { force: true, recursive: true })
  }
  mkdirSync(extensionDirectory, { mode: 0o700, recursive: true })
  mkdirSync(skillDirectory, { mode: 0o700, recursive: true })
  mkdirSync(join(copilotHome, 'logs'), { mode: 0o700, recursive: true })
  copyFileSync(
    config.workerExtensionPath,
    join(extensionDirectory, 'extension.mjs'),
  )
  chmodSync(join(extensionDirectory, 'extension.mjs'), 0o600)
  copyFileSync(
    config.tandemSkillPath,
    join(skillDirectory, 'SKILL.md'),
  )
  chmodSync(join(skillDirectory, 'SKILL.md'), 0o600)
  writeFileSync(
    join(copilotHome, 'settings.json'),
    `${JSON.stringify(
      {
        banner: 'never',
        disableAllHooks: true,
        experimental: true,
        memory: false,
        notifications: false,
        sandbox: { enabled: false },
        showTipsOnStartup: false,
      },
      null,
      2,
    )}\n`,
    { mode: 0o600 },
  )
}

export function assertWorkerHostConfigurationSafe(
  worktreePath: string,
  policyHookDirectory = '/etc/github-copilot/policy.d',
) {
  const projectExtensions = join(worktreePath, '.github/extensions')
  if (existsSync(projectExtensions) && readdirSync(projectExtensions, { recursive: true }).length > 0) {
    throw new Error('Project Copilot extensions are not allowed in autonomous worker sessions')
  }
  if (
    existsSync(policyHookDirectory) &&
    readdirSync(policyHookDirectory).some((entry) => entry.endsWith('.json'))
  ) {
    throw new Error('Copilot policy hooks are not allowed in autonomous worker sessions')
  }
}

async function getGitCommonDirectory(worktreePath: string) {
  const result = await runCommand('git', ['rev-parse', '--git-common-dir'], { cwd: worktreePath })
  return realpathSync(resolve(worktreePath, result.stdout.trim()))
}

function buildWorkerEnvironment(
  config: AdminIssueControllerConfig,
  worktreePath: string,
  gitCommonDirectory: string,
  githubToken: string,
) {
  const copilotHome = join(config.workerHome, '.copilot')
  const environment: NodeJS.ProcessEnv = {
    ADMIN_ISSUE_GIT_COMMON_DIR: gitCommonDirectory,
    ADMIN_ISSUE_WORKER_IMAGE: config.workerImageId,
    ADMIN_ISSUE_WORKSPACE: worktreePath,
    COPILOT_HOME: copilotHome,
    GH_TOKEN: githubToken,
    HOME: config.workerHome,
    LANG: process.env.LANG ?? 'C.UTF-8',
    PATH: process.env.PATH,
    TERM: process.env.TERM ?? 'xterm-256color',
    TZ: process.env.TZ ?? 'UTC',
  }
  return environment
}

function buildWorkerPrompt(record: AdminIssueRecord) {
  const pendingInputs = record.inputs.filter((input) => input.revision > record.processedRevision)
  const issueContext = pendingInputs
    .map(
      (input) =>
        `### Input ${input.revision} (${input.source}, ${input.createdAt})\n${input.body}`,
    )
    .join('\n\n')
  return `/tandem-research ${record.title}

You are working on GitHub issue #${record.issueNumber} in ${record.issueUrl}.

Use the tandem-research workflow to investigate the issue before implementation. The operator's issue text and follow-up comments below are canonical. Make changes only through the admin_issue_workspace tool. Do not use host filesystem, shell, GitHub, Home Assistant, network, commit, push, merge, deployment, or issue-mutation tools. The trusted host controller owns those operations.

If a consequential product or design decision remains, stop and return needs_input with concise options and your recommendation. Otherwise implement the complete fix in the assigned worktree, update the directly owned tests, run the relevant tests through admin_issue_workspace, iterate until they pass, and perform a meaningful code review. Treat iOS/WebKit-specific behavior as requiring explicit manual follow-up.

Do not modify Git metadata, the .github directory, controller infrastructure, dependency manifests or lockfiles, test-policy scripts, or build/test configuration. If the fix truly requires one of those protected surfaces, return needs_input and explain why.

Return a final response containing exactly one JSON object and no Markdown fence:
{
  "schemaVersion": 1,
  "decision": "needs_input" | "ready_for_pr" | "blocked",
  "summary": "concise current result",
  "questions": [{ "question": "...", "options": ["...", "..."], "recommendation": "..." }],
  "changeSummary": ["..."],
  "tests": [{ "command": "...", "result": "passed" | "failed" }],
  "review": { "approved": true | false, "findings": ["..."] },
  "pr": { "title": "...", "body": "..." },
  "iosFollowUp": { "required": true | false, "reason": "..." },
  "reason": "..."
}

For needs_input, provide at least one question. For ready_for_pr, changeSummary and tests must be non-empty, review.approved must be true, and pr title/body must be present. For blocked, explain the blocker. Omit fields that do not apply.

Always include schemaVersion, decision, summary, questions, and iosFollowUp. Use an empty questions array for ready_for_pr and blocked. A ready_for_pr outcome is valid only when every listed test passed.

${issueContext}`
}

function parseJsonLines(output: string) {
  const events: Array<Record<string, unknown>> = []
  for (const line of output.split(/\r?\n/)) {
    if (!line.trim()) continue
    try {
      const value = JSON.parse(line) as unknown
      if (value && typeof value === 'object') events.push(value as Record<string, unknown>)
    } catch {
      // CLI diagnostics may appear beside JSON stream events.
    }
  }
  return events
}

function extractFinalAssistantResponse(output: string) {
  const events = parseJsonLines(output)
  const assistantMessages = events
    .filter((event) => event.type === 'assistant.message')
    .map((event) => event.data)
    .filter((data): data is Record<string, unknown> => Boolean(data && typeof data === 'object'))
    .map((data) => data.content)
    .filter((content): content is string => typeof content === 'string')
  const final = assistantMessages.at(-1)
  if (!final) throw new Error('Copilot worker emitted no final assistant message')
  return final
}

async function runCopilotWorker(
  config: AdminIssueControllerConfig,
  state: AdminIssueControllerState,
  record: AdminIssueRecord,
) {
  const worktreePath = await ensureWorktree(config, state, record)
  assertProtectedPathsUntouched(await changedFiles(worktreePath))
  assertWorkerHostConfigurationSafe(worktreePath)
  prepareCopilotHome(config)
  const githubToken = (
    await runCommand('gh', ['auth', 'token'], {
      cwd: config.repositoryPath,
      timeoutMs: 30_000,
    })
  ).stdout.trim()
  if (!githubToken) throw new Error('gh auth token returned an empty token')
  const gitCommonDirectory = await getGitCommonDirectory(worktreePath)
  const environment = buildWorkerEnvironment(
    config,
    worktreePath,
    gitCommonDirectory,
    githubToken,
  )
  const commonArgs = [
    '-C',
    worktreePath,
    '--model',
    'gpt-5.6-sol',
    '--effort',
    'max',
    '--context',
    'default',
    '--disable-builtin-mcps',
    '--no-ask-user',
    '--no-color',
    '--output-format',
    'json',
    '--stream',
    'on',
    '--secret-env-vars',
    'GH_TOKEN',
    '--available-tools',
    'admin_issue_workspace,skill,task,read_agent,write_agent',
    '--allow-tool',
    'custom-tool(admin_issue_workspace)',
    '-p',
    buildWorkerPrompt(record),
  ]
  const shouldResume = Boolean(record.receipts.sessionCreatedAt)
  let result = await runCommand(
    'copilot',
    [shouldResume ? `--resume=${record.sessionName}` : '--name', ...(shouldResume ? [] : [record.sessionName]), ...commonArgs],
    {
      allowFailure: true,
      cwd: worktreePath,
      env: environment,
      maxOutputBytes: MAX_WORKER_OUTPUT_BYTES,
      timeoutMs: config.workerTimeoutMinutes * 60_000,
    },
  )
  if (
    result.exitCode !== 0 &&
    !shouldResume &&
    /already exists|session.*exists|duplicate/i.test(`${result.stderr}\n${result.stdout}`)
  ) {
    result = await runCommand('copilot', [`--resume=${record.sessionName}`, ...commonArgs], {
      allowFailure: true,
      cwd: worktreePath,
      env: environment,
      maxOutputBytes: MAX_WORKER_OUTPUT_BYTES,
      timeoutMs: config.workerTimeoutMinutes * 60_000,
    })
  }

  mkdirSync(join(config.stateDirectory, 'worker-logs'), { mode: 0o700, recursive: true })
  const logPath = join(
    config.stateDirectory,
    'worker-logs',
    `issue-${record.issueNumber}-run-${record.workerRuns + 1}.jsonl`,
  )
  writeFileSync(logPath, `${result.stdout}\n${result.stderr}`, { mode: 0o600 })
  if (result.exitCode !== 0) {
    throw new Error(
      `Copilot worker failed with exit ${result.exitCode}; see ${logPath}\n${truncate(
        result.stderr,
        12_000,
      )}`,
    )
  }

  const outcome = parseWorkerOutcome(extractFinalAssistantResponse(result.stdout))
  record.workerRuns += 1
  markIssueInputsProcessed(record, record.inputRevision, now())
  record.lastOutcome = outcome
  record.receipts.sessionCreatedAt ??= now()
  record.receipts.lastWorkerRunAt = now()
  record.updatedAt = now()
  writeState(config, state)
  return outcome
}

async function changedFiles(worktreePath: string) {
  const tracked = (
    await runCommand('git', ['diff', '--name-only', '--diff-filter=ACMRTUXB', 'HEAD', '--'], {
      cwd: worktreePath,
    })
  ).stdout
    .split(/\r?\n/)
    .filter(Boolean)
  const untracked = (
    await runCommand('git', ['ls-files', '--others', '--exclude-standard'], { cwd: worktreePath })
  ).stdout
    .split(/\r?\n/)
    .filter(Boolean)
  const ignoredProtected = (
    await runCommand(
      'git',
      [
        'ls-files',
        '--others',
        '--ignored',
        '--exclude-standard',
        '--',
        '.github',
        '.env*',
        '.npmrc',
        '.yarnrc',
        '.yarnrc.yml',
        '.gitattributes',
        '.gitignore',
        '.gitmodules',
        'eslint.config.js',
        'ops/admin-issue-controller',
        'package-lock.json',
        'package.json',
        'playwright.config.ts',
        'scripts/admin-issue-controller.test.ts',
        'scripts/admin-issue-controller.ts',
        'scripts/design-system',
        'scripts/e2e-coverage-check.ts',
        'scripts/i18n',
        'scripts/lib/adminIssueController.ts',
        'scripts/lib/hassAdminTodo.test.ts',
        'scripts/lib/hassAdminTodo.ts',
        'scripts/test-change-policy.ts',
        'tsconfig.app.json',
        'tsconfig.json',
        'tsconfig.node.json',
        'tsconfig.validation.json',
        'vite.config.ts',
        'vitest.config.ts',
      ],
      { cwd: worktreePath },
    )
  ).stdout
    .split(/\r?\n/)
    .filter(Boolean)
  return [...new Set([...tracked, ...untracked, ...ignoredProtected])].sort()
}

function assertProtectedPathsUntouched(files: string[]) {
  for (const file of files) {
    const normalized = file.replaceAll('\\', '/')
    if (
      normalized.startsWith('/') ||
      normalized.split('/').includes('..') ||
      isMaskedWorkspaceFile(normalized) ||
      PROTECTED_WORKER_PATHS.some(
        (protectedPath) =>
          normalized === protectedPath.replace(/\/$/, '') || normalized.startsWith(protectedPath),
      )
    ) {
      throw new Error(`Worker changed protected path: ${file}`)
    }
  }
}

export function assertWorkerChangesSafe(worktreePath: string, files: string[]) {
  if (files.length === 0) throw new Error('Worker reported ready_for_pr but made no repository changes')
  assertProtectedPathsUntouched(files)
  for (const file of files) {
    const normalized = file.replaceAll('\\', '/')
    if (
      normalized !== 'index.html' &&
      !ALLOWED_WORKER_PATHS.some((allowedPath) => normalized.startsWith(allowedPath))
    ) {
      throw new Error(`Worker changed a path outside the auto-deployed dashboard: ${file}`)
    }
    const absolute = resolve(worktreePath, file)
    if (existsSync(absolute)) {
      const metadata = lstatSync(absolute)
      if (metadata.isSymbolicLink()) {
        throw new Error(`Worker created or changed a symbolic link: ${file}`)
      }
      if (!metadata.isFile()) {
        throw new Error(`Worker created or changed a non-regular file: ${file}`)
      }
      if (metadata.size > 64 * 1024 * 1024) {
        throw new Error(`Worker changed an oversized file: ${file}`)
      }
    }
  }
}

function workspaceChangeDigest(worktreePath: string, files: string[]) {
  const digest = createHash('sha256')
  for (const file of files) {
    digest.update(file)
    digest.update('\0')
    const absolute = resolve(worktreePath, file)
    if (!existsSync(absolute)) {
      digest.update('<deleted>')
    } else {
      digest.update(readFileSync(absolute))
    }
    digest.update('\0')
  }
  return digest.digest('hex')
}

function shellQuote(value: string) {
  return `'${value.replaceAll("'", "'\"'\"'")}'`
}

async function runWorkspaceContainer(
  config: AdminIssueControllerConfig,
  worktreePath: string,
  command: string,
  timeoutMs: number,
) {
  const gitCommonDirectory = await getGitCommonDirectory(worktreePath)
  const containerName = `admin-issue-validate-${process.pid}-${Date.now()}`
  const uid = process.getuid?.() ?? 1000
  const gid = process.getgid?.() ?? 1000
  const maskedWorkspaceFiles = new Set<string>()
  for (const entry of readdirSync(worktreePath)) {
    if (isMaskedWorkspaceFile(entry)) maskedWorkspaceFiles.add(entry)
  }
  const maskedMounts = [...maskedWorkspaceFiles].flatMap((path) => [
    '--mount',
    `type=bind,src=/dev/null,dst=/workspace/${path},readonly`,
  ])
  const readOnlyMounts = [...new Set([...PROTECTED_WORKER_PATHS, 'node_modules'])]
    .map((path) => path.replace(/\/$/, ''))
    .filter((path) => existsSync(join(worktreePath, path)))
    .flatMap((path) => [
      '--mount',
      `type=bind,src=${join(worktreePath, path)},dst=/workspace/${path},readonly`,
    ])
  try {
    const result = await runCommand(
      'docker',
      [
        'run',
        '--name',
        containerName,
        '--label',
        'com.sfenton.admin-issue-controller=true',
        '--network',
        'none',
        '--read-only',
        '--cap-drop',
        'ALL',
        '--security-opt',
        'no-new-privileges',
        '--pids-limit',
        '512',
        '--memory',
        '4g',
        '--cpus',
        '4',
        '--shm-size',
        '2g',
        '--user',
        `${uid}:${gid}`,
        '--tmpfs',
        `/tmp:rw,noexec,nosuid,nodev,size=1g,uid=${uid},gid=${gid}`,
        '--tmpfs',
        `/home/worker:rw,nosuid,nodev,size=128m,uid=${uid},gid=${gid}`,
        '--tmpfs',
        `/workspace/node_modules/.vite-temp:rw,nosuid,nodev,size=256m,uid=${uid},gid=${gid}`,
        '--tmpfs',
        `/workspace/.cache:rw,nosuid,nodev,size=256m,uid=${uid},gid=${gid}`,
        '--mount',
        `type=bind,src=${worktreePath},dst=/workspace`,
        ...maskedMounts,
        ...readOnlyMounts,
        '--mount',
        `type=bind,src=${gitCommonDirectory},dst=${gitCommonDirectory},readonly`,
        '--workdir',
        '/workspace',
        '--env',
        'CI=true',
        '--env',
        'HOME=/home/worker',
        config.workerImageId,
        '/bin/sh',
        '-lc',
        command,
      ],
      {
        allowFailure: true,
        maxOutputBytes: 30 * 1024 * 1024,
        timeoutMs,
      },
    )
    if (result.exitCode !== 0) {
      throw new Error(
        truncate(
          `Validation command failed: ${command}\n${result.stdout}\n${result.stderr}`,
          40_000,
        ),
      )
    }
    return result
  } finally {
    await runCommand('docker', ['rm', '-f', containerName], {
      allowFailure: true,
      timeoutMs: 30_000,
    })
  }
}

async function validateWorkerChanges(
  config: AdminIssueControllerConfig,
  record: AdminIssueRecord,
) {
  if (!record.worktreePath) throw new Error('Worker worktree is missing')
  const files = await changedFiles(record.worktreePath)
  assertWorkerChangesSafe(record.worktreePath, files)
  const initialDigest = workspaceChangeDigest(record.worktreePath, files)
  await runCommand('git', ['diff', '--check'], { cwd: record.worktreePath })

  const unitTests = files.filter(
    (file) => /\.(test)\.(ts|tsx)$/.test(file) && !file.startsWith('e2e/'),
  )
  const playwrightTests = files.filter((file) => file.startsWith('e2e/') && /\.spec\.ts$/.test(file))
  await runWorkspaceContainer(
    config,
    record.worktreePath,
    'npm run test:change-policy',
    5 * 60_000,
  )
  if (unitTests.length > 0) {
    await runWorkspaceContainer(
      config,
      record.worktreePath,
      `npx vitest run ${unitTests.map(shellQuote).join(' ')}`,
      15 * 60_000,
    )
  }
  if (playwrightTests.length > 0) {
    await runWorkspaceContainer(
      config,
      record.worktreePath,
      `npx playwright test ${playwrightTests.map(shellQuote).join(' ')}`,
      30 * 60_000,
    )
  }
  if (files.some((file) => file.startsWith('src/'))) {
    await runWorkspaceContainer(config, record.worktreePath, 'npm run i18n:check', 10 * 60_000)
  }
  await runWorkspaceContainer(config, record.worktreePath, 'npm run build', 20 * 60_000)
  const validatedFiles = await changedFiles(record.worktreePath)
  assertWorkerChangesSafe(record.worktreePath, validatedFiles)
  if (
    files.join('\0') !== validatedFiles.join('\0') ||
    initialDigest !== workspaceChangeDigest(record.worktreePath, validatedFiles)
  ) {
    throw new Error('Validation commands changed the proposed repository files')
  }
  return files
}

function validatedWorkerInput(record: AdminIssueRecord) {
  return `${record.generation}:${record.processedRevision}`
}

export async function recoverableCommittedHead(record: AdminIssueRecord) {
  if (
    !record.worktreePath ||
    !record.branch ||
    !record.baseSha ||
    record.receipts.validatedWorkerInput !== validatedWorkerInput(record)
  ) {
    return undefined
  }
  const status = await runCommand(
    'git',
    ['status', '--porcelain=v1', '--untracked-files=all'],
    { cwd: record.worktreePath },
  )
  if (status.stdout.trim()) return undefined
  const branch = await runCommand('git', ['branch', '--show-current'], {
    cwd: record.worktreePath,
  })
  if (branch.stdout.trim() !== record.branch) {
    throw new Error(
      `Worker worktree is on ${branch.stdout.trim() || 'a detached HEAD'}, expected ${record.branch}`,
    )
  }
  const headSha = (
    await runCommand('git', ['rev-parse', 'HEAD'], { cwd: record.worktreePath })
  ).stdout.trim()
  if (headSha === record.baseSha) return undefined
  const ancestry = await runCommand(
    'git',
    ['merge-base', '--is-ancestor', record.baseSha, headSha],
    { allowFailure: true, cwd: record.worktreePath },
  )
  if (ancestry.exitCode !== 0) {
    throw new Error(`Committed worker head ${headSha} does not descend from base ${record.baseSha}`)
  }
  return headSha
}

async function pushWorkerBranch(
  config: AdminIssueControllerConfig,
  record: AdminIssueRecord,
) {
  if (!record.worktreePath || !record.branch) throw new Error('Worker branch is incomplete')
  await runCommand(
    'git',
    [
      '-c',
      'core.hooksPath=/dev/null',
      'push',
      '--set-upstream',
      'origin',
      `${record.branch}:${record.branch}`,
    ],
    {
      cwd: record.worktreePath,
      timeoutMs: 5 * 60_000,
    },
  )
}

async function commitAndPush(
  config: AdminIssueControllerConfig,
  record: AdminIssueRecord,
  outcome: Extract<AdminIssueWorkerOutcome, { decision: 'ready_for_pr' }>,
) {
  if (!record.worktreePath || !record.branch) throw new Error('Worker branch is incomplete')
  await runCommand('git', ['-c', 'core.hooksPath=/dev/null', 'add', '--all'], {
    cwd: record.worktreePath,
  })
  await runCommand('git', ['diff', '--cached', '--check'], { cwd: record.worktreePath })
  const messageDirectory = mkdtempSync(join(tmpdir(), 'admin-issue-commit-'))
  try {
    const messagePath = join(messageDirectory, 'message.txt')
    writeFileSync(
      messagePath,
      `${outcome.pr.title.trim()}\n\nCo-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>\n`,
      { mode: 0o600 },
    )
    await runCommand('git', ['-c', 'core.hooksPath=/dev/null', 'commit', '--file', messagePath], {
      cwd: record.worktreePath,
      timeoutMs: 120_000,
    })
  } finally {
    rmSync(messageDirectory, { force: true, recursive: true })
  }
  const headSha = (
    await runCommand('git', ['rev-parse', 'HEAD'], { cwd: record.worktreePath })
  ).stdout.trim()
  await pushWorkerBranch(config, record)
  return headSha
}

async function findPullRequest(config: AdminIssueControllerConfig, branch: string) {
  const owner = config.repository.split('/')[0]
  const pulls = await ghApi<GitHubPullRequest[]>(
    config,
    'GET',
    `repos/${config.repository}/pulls?state=all&head=${encodeURIComponent(`${owner}:${branch}`)}&per_page=10`,
  )
  return pulls.at(0)
}

async function createOrUpdatePullRequest(
  config: AdminIssueControllerConfig,
  record: AdminIssueRecord,
  outcome: Extract<AdminIssueWorkerOutcome, { decision: 'ready_for_pr' }>,
  headSha: string,
) {
  if (!record.branch) throw new Error('Worker branch is missing')
  const body = truncate(
    `${neutralizeGitHubClosingReferences(outcome.pr.body.trim())}\n\nTracked issue: #${record.issueNumber}\n\n<!-- admin-issue-controller:pr -->`,
    MAX_GITHUB_BODY_BYTES,
  )
  let pullRequest = await findPullRequest(config, record.branch)
  if (!pullRequest) {
    pullRequest = await ghApi<GitHubPullRequest>(
      config,
      'POST',
      `repos/${config.repository}/pulls`,
      {
        base: 'master',
        body,
        head: record.branch,
        title: outcome.pr.title.trim(),
      },
    )
  } else if (!pullRequest.merged_at) {
    pullRequest = await ghApi<GitHubPullRequest>(
      config,
      'PATCH',
      `repos/${config.repository}/pulls/${pullRequest.number}`,
      {
        body,
        title: outcome.pr.title.trim(),
      },
    )
  }
  record.pr = {
    headSha,
    number: pullRequest.number,
    url: pullRequest.html_url,
  }
  record.phase = 'pull-request'
  record.receipts.prOpenedAt ??= now()
  await postIssueCommentOnce(
    config,
    record.issueNumber,
    record.uid,
    `pr-r${record.processedRevision}`,
    formatPullRequestComment(record.uid, record.processedRevision, record.pr, outcome),
  )
  return pullRequest
}

async function waitForRequiredChecks(
  config: AdminIssueControllerConfig,
  record: AdminIssueRecord,
  refreshInputs: () => Promise<boolean>,
) {
  if (!record.pr) throw new Error('Pull request is missing')
  const deadline = Date.now() + config.deploymentTimeoutMinutes * 60_000
  while (Date.now() < deadline) {
    const response = await ghApi<{ check_runs: CheckRun[] }>(
      config,
      'GET',
      `repos/${config.repository}/commits/${record.pr.headSha}/check-runs?per_page=100`,
    )
    const latestByName = new Map<string, CheckRun>()
    for (const check of response.check_runs.sort((left, right) => left.id - right.id)) {
      if (check.app.id === config.requiredCheckAppId) latestByName.set(check.name, check)
    }
    const required = config.requiredChecks.map((name) => latestByName.get(name))
    if (required.every(Boolean)) {
      const failed = required.find(
        (check) => check?.status === 'completed' && check.conclusion !== 'success',
      )
      if (failed) {
        let logs = `${failed.name}: ${failed.conclusion ?? failed.status}`
        const runId = failed.details_url?.match(/\/actions\/runs\/(\d+)/)?.[1]
        if (runId) {
          const result = await runCommand(
            'gh',
            ['run', 'view', runId, '--repo', config.repository, '--log-failed'],
            {
              allowFailure: true,
              cwd: config.repositoryPath,
              maxOutputBytes: 2 * 1024 * 1024,
              timeoutMs: 120_000,
            },
          )
          logs = truncate(`${logs}\n\n${result.stdout}\n${result.stderr}`, 30_000)
        }
        return { logs, success: false as const }
      }
      if (required.every((check) => check?.status === 'completed' && check.conclusion === 'success')) {
        if (!(await refreshInputs())) return { interrupted: true as const }
        return { success: true as const }
      }
    }
    await sleep(config.deploymentPollSeconds * 1000)
    if (!(await refreshInputs())) return { interrupted: true as const }
  }
  throw new Error(`Required checks did not finish within ${config.deploymentTimeoutMinutes} minutes`)
}

async function mergePullRequest(config: AdminIssueControllerConfig, record: AdminIssueRecord) {
  if (!record.pr) throw new Error('Pull request is missing')
  const current = await ghApi<GitHubPullRequest>(
    config,
    'GET',
    `repos/${config.repository}/pulls/${record.pr.number}`,
  )
  if (!current.merged_at) {
    await runCommand(
      'gh',
      [
        'pr',
        'merge',
        String(record.pr.number),
        '--repo',
        config.repository,
        '--merge',
        '--match-head-commit',
        record.pr.headSha,
      ],
      {
        cwd: config.repositoryPath,
        timeoutMs: 5 * 60_000,
      },
    )
  }
  const merged = await ghApi<GitHubPullRequest>(
    config,
    'GET',
    `repos/${config.repository}/pulls/${record.pr.number}`,
  )
  if (!merged.merged_at || !merged.merge_commit_sha) {
    throw new Error(`Pull request #${record.pr.number} did not report a merge commit`)
  }
  record.pr.mergeSha = merged.merge_commit_sha
  record.phase = 'deploying'
  record.receipts.mergedAt = merged.merged_at
  return merged.merge_commit_sha
}

async function waitForDeploymentReceipt(
  config: AdminIssueControllerConfig,
  mergeSha: string,
  refreshInputs: () => Promise<boolean>,
) {
  const deadline = Date.now() + config.deploymentTimeoutMinutes * 60_000
  while (Date.now() < deadline) {
    const response = await ghApi<{ workflow_runs: WorkflowRun[] }>(
      config,
      'GET',
      `repos/${config.repository}/actions/workflows/${encodeURIComponent(
        config.requiredWorkflow,
      )}/runs?head_sha=${mergeSha}&event=push&per_page=20`,
    )
    const run = response.workflow_runs.find((candidate) => candidate.head_sha === mergeSha)
    if (!run || run.status !== 'completed') {
      await sleep(config.deploymentPollSeconds * 1000)
      if (!(await refreshInputs())) return undefined
      continue
    }
    if (run.conclusion !== 'success') {
      throw new Error(`Deployment run ${run.html_url} concluded ${run.conclusion}`)
    }

    const artifactDirectory = mkdtempSync(join(tmpdir(), 'admin-issue-deployment-'))
    try {
      const artifactName = `dashboard-deployment-receipt-${mergeSha}-${run.run_attempt}`
      await runCommand(
        'gh',
        [
          'run',
          'download',
          String(run.id),
          '--repo',
          config.repository,
          '--name',
          artifactName,
          '--dir',
          artifactDirectory,
        ],
        {
          cwd: config.repositoryPath,
          timeoutMs: 120_000,
        },
      )
      const receiptPath = join(artifactDirectory, 'deployment-receipt.json')
      if (!existsSync(receiptPath)) {
        throw new Error(`Deployment artifact ${artifactName} did not contain deployment-receipt.json`)
      }
      const receipt = JSON.parse(readFileSync(receiptPath, 'utf8')) as DeploymentReceipt
      if (
        !deploymentReceiptIsAccepted(receipt, mergeSha, {
          id: run.id,
          runAttempt: run.run_attempt,
        })
      ) {
        throw new Error(`Deployment receipt ${artifactName} did not satisfy the accepted v2 contract`)
      }
      if (!(await refreshInputs())) return undefined
      return { receipt, run }
    } finally {
      rmSync(artifactDirectory, { force: true, recursive: true })
    }
  }
  throw new Error(`Deployment did not finish within ${config.deploymentTimeoutMinutes} minutes`)
}

async function cleanupWorktree(
  config: AdminIssueControllerConfig,
  record: AdminIssueRecord,
  deleteBranch = false,
) {
  if (!record.worktreePath) return
  const path = record.worktreePath
  if (!path.startsWith(`${resolve(config.worktreeRoot)}/`)) {
    throw new Error(`Refusing to clean worktree outside configured root: ${path}`)
  }
  if (existsSync(path)) {
    await runCommand('git', ['worktree', 'remove', '--force', path], {
      cwd: config.repositoryPath,
      timeoutMs: 120_000,
    })
  } else {
    await runCommand('git', ['worktree', 'prune'], {
      cwd: config.repositoryPath,
      timeoutMs: 120_000,
    })
  }
  if (deleteBranch && record.branch) {
    const remoteBranch = await runCommand(
      'git',
      ['ls-remote', '--exit-code', '--heads', 'origin', `refs/heads/${record.branch}`],
      { allowFailure: true, cwd: config.repositoryPath, timeoutMs: 60_000 },
    )
    if (remoteBranch.exitCode === 0) {
      await runCommand(
        'git',
        ['-c', 'core.hooksPath=/dev/null', 'push', 'origin', '--delete', record.branch],
        {
          cwd: config.repositoryPath,
          timeoutMs: 120_000,
        },
      )
    } else if (remoteBranch.exitCode !== 2) {
      throw new Error(
        `Could not determine whether remote branch ${record.branch} exists: ${remoteBranch.stderr}`,
      )
    }
    const localBranch = await runCommand(
      'git',
      ['show-ref', '--verify', '--quiet', `refs/heads/${record.branch}`],
      { allowFailure: true, cwd: config.repositoryPath },
    )
    if (localBranch.exitCode === 0) {
      await runCommand('git', ['branch', '--delete', '--force', record.branch], {
        cwd: config.repositoryPath,
        timeoutMs: 30_000,
      })
    } else if (localBranch.exitCode !== 1) {
      throw new Error(`Could not determine whether local branch ${record.branch} exists`)
    }
    record.receipts.branchRemovedAt = now()
  }
  record.receipts.worktreeRemovedAt = now()
  record.worktreePath = undefined
}

async function finalizeIssue(
  config: AdminIssueControllerConfig,
  client: HassAdminTodoClient,
  state: AdminIssueControllerState,
  record: AdminIssueRecord,
  deployment: {
    receipt: DeploymentReceipt
    run: WorkflowRun
  },
) {
  if (!record.pr?.mergeSha || !record.lastOutcome || record.lastOutcome.decision !== 'ready_for_pr') {
    throw new Error('Cannot finalize without a merged ready_for_pr outcome')
  }
  const outcome = record.lastOutcome
  if (record.inputRevision > record.processedRevision) {
    await postIssueCommentOnce(
      config,
      record.issueNumber,
      record.uid,
      `follow-up-g${record.generation}`,
      [
        '**The current fix deployed successfully, and a newer update is queued.**',
        '',
        `- Pull request: ${record.pr.url}`,
        `- Deployment: ${deployment.run.html_url}`,
        '',
        'The issue will remain open while the follow-up is handled in a new isolated worktree generation.',
      ].join('\n'),
    )
    await startNewGeneration(config, record)
    writeState(config, state)
    return
  }
  if (outcome.iosFollowUp.required && !record.receipts.iosVerifiedAt) {
    await postIssueCommentOnce(
      config,
      record.issueNumber,
      record.uid,
      `ios-follow-up-${record.pr.mergeSha}`,
      [
        '**Deployment succeeded, but manual iOS verification is still required.**',
        '',
        outcome.iosFollowUp.reason,
        '',
        `- Pull request: ${record.pr.url}`,
        `- Deployment: ${deployment.run.html_url}`,
        '',
        'After verifying the fix on the affected iOS device or simulator, reply with exactly `iOS verification passed`. The issue and Admin To-Do item will remain open until then.',
      ].join('\n'),
    )
    record.phase = 'awaiting-user'
    record.receipts.awaitingIosVerificationAt = now()
    writeState(config, state)
    return
  }

  await postIssueCommentOnce(
    config,
    record.issueNumber,
    record.uid,
    'completed',
    formatCompletionComment({
      deployment: {
        deployedSha: deployment.receipt.deployedSha,
        disposition: deployment.receipt.disposition,
        runId: deployment.run.id,
        url: deployment.run.html_url,
      },
      issue: record,
    }),
  )
  await ghApi(config, 'PATCH', `repos/${config.repository}/issues/${record.issueNumber}`, {
    state: 'closed',
    state_reason: 'completed',
  })
  record.receipts.issueClosedAt = now()
  writeState(config, state)

  let items = await client.getItems(config.todoEntityId)
  let completed = items.find((item) => item.uid === record.uid)
  let receipt = await client.getState(config.completionReceiptEntityId)
  if (!adminCompletionBoundarySatisfied(completed?.status, receipt.state, record.uid)) {
    await client.completeItem(config.completionScript, record.uid)
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await sleep(750)
      items = await client.getItems(config.todoEntityId)
      completed = items.find((item) => item.uid === record.uid)
      receipt = await client.getState(config.completionReceiptEntityId)
      if (adminCompletionBoundarySatisfied(completed?.status, receipt.state, record.uid)) break
    }
  }
  if (!adminCompletionBoundarySatisfied(completed?.status, receipt.state, record.uid)) {
    throw new Error(`Admin To-Do item ${record.uid} did not become completed`)
  }
  record.receipts.todoCompletedAt = now()
  writeState(config, state)
  await cleanupWorktree(config, record, true)
  record.phase = 'completed'
  writeState(config, state)
}

async function handleWorkerOutcome(
  config: AdminIssueControllerConfig,
  state: AdminIssueControllerState,
  record: AdminIssueRecord,
  outcome: AdminIssueWorkerOutcome,
  refreshInputs: () => Promise<boolean>,
) {
  if (outcome.decision === 'needs_input') {
    await postIssueCommentOnce(
      config,
      record.issueNumber,
      record.uid,
      `questions-r${record.processedRevision}`,
      formatQuestionsComment(record.uid, record.processedRevision, outcome),
    )
    record.phase = 'awaiting-user'
    writeState(config, state)
    return false
  }
  if (outcome.decision === 'blocked') {
    await postIssueCommentOnce(
      config,
      record.issueNumber,
      record.uid,
      `blocked-r${record.processedRevision}`,
      formatBlockedComment(record.uid, record.processedRevision, outcome),
    )
    record.phase = 'blocked'
    writeState(config, state)
    return false
  }

  record.phase = 'ready-for-pr'
  writeState(config, state)
  const committedHead = await recoverableCommittedHead(record)
  if (committedHead) {
    if (!(await refreshInputs())) return false
    await pushWorkerBranch(config, record)
    await createOrUpdatePullRequest(config, record, outcome, committedHead)
    writeState(config, state)
    return true
  }
  try {
    await validateWorkerChanges(config, record)
  } catch (error) {
    if (record.repairAttempts >= config.maxRepairAttempts) {
      await blockRecord(
        config,
        state,
        record,
        `Controller validation still fails after ${record.repairAttempts} repair attempts.\n\n${truncate(
          error instanceof Error ? error.message : String(error),
          30_000,
        )}`,
      )
      return false
    }
    record.repairAttempts += 1
    appendIssueInput(record, {
      body: `Trusted controller validation failed. Fix the implementation and rerun the relevant tests.\n\n${truncate(
        error instanceof Error ? error.message : String(error),
        30_000,
      )}`,
      createdAt: now(),
      externalId: `validation-failure:${record.repairAttempts}:${record.workerRuns}`,
      source: 'ci-failure',
    })
    record.phase = 'queued'
    writeState(config, state)
    return true
  }

  record.receipts.validatedAt = now()
  record.receipts.validatedWorkerInput = validatedWorkerInput(record)
  writeState(config, state)
  if (!(await refreshInputs())) return false
  const headSha = await commitAndPush(config, record, outcome)
  await createOrUpdatePullRequest(config, record, outcome, headSha)
  writeState(config, state)
  return true
}

async function blockRecord(
  config: AdminIssueControllerConfig,
  state: AdminIssueControllerState,
  record: AdminIssueRecord,
  reason: string,
) {
  const outcome: Extract<AdminIssueWorkerOutcome, { decision: 'blocked' }> = {
    decision: 'blocked',
    iosFollowUp: { reason: '', required: false },
    questions: [],
    reason,
    schemaVersion: 1,
    summary: 'The autonomous fix could not pass its required validation.',
  }
  record.lastOutcome = outcome
  record.phase = 'blocked'
  await postIssueCommentOnce(
    config,
    record.issueNumber,
    record.uid,
    `controller-blocked-r${record.inputRevision}-a${record.repairAttempts}`,
    formatBlockedComment(record.uid, record.inputRevision, outcome),
  )
  writeState(config, state)
}

async function processRecord(
  config: AdminIssueControllerConfig,
  client: HassAdminTodoClient,
  state: AdminIssueControllerState,
  record: AdminIssueRecord,
) {
  const refreshInputs = async (expectedPhase: AdminIssueRecord['phase']) => {
    await reconcileTodos(config, client, state)
    await reconcileGitHubInputs(config, state)
    return (
      record.phase === expectedPhase &&
      record.inputRevision === record.processedRevision
    )
  }
  state.activeUid = record.uid
  writeState(config, state)
  try {
    while (true) {
      if (record.phase === 'queued' || record.phase === 'researching' || record.phase === 'implementing') {
        record.phase = 'researching'
        writeState(config, state)
        const outcome = await runCopilotWorker(config, state, record)
        if (!(await refreshInputs('researching'))) return
        await handleWorkerOutcome(
          config,
          state,
          record,
          outcome,
          () => refreshInputs('ready-for-pr'),
        )
        return
      }

      if (record.phase === 'ready-for-pr') {
        if (!record.lastOutcome || record.lastOutcome.decision !== 'ready_for_pr') {
          throw new Error('ready-for-pr record is missing a ready_for_pr outcome')
        }
        await handleWorkerOutcome(
          config,
          state,
          record,
          record.lastOutcome,
          () => refreshInputs('ready-for-pr'),
        )
        return
      }

      if (record.phase === 'pull-request') {
        if (!record.pr) throw new Error('pull-request record is missing PR metadata')
        const pullRequest = await ghApi<GitHubPullRequest>(
          config,
          'GET',
          `repos/${config.repository}/pulls/${record.pr.number}`,
        )
        if (pullRequest.merged_at && pullRequest.merge_commit_sha) {
          record.pr.mergeSha = pullRequest.merge_commit_sha
          record.phase = 'deploying'
          record.receipts.mergedAt = pullRequest.merged_at
          writeState(config, state)
          return
        }
        if (pullRequest.state === 'closed') {
          await blockRecord(
            config,
            state,
            record,
            `Pull request #${pullRequest.number} was closed without being merged.`,
          )
          return
        }
        const checks = await waitForRequiredChecks(
          config,
          record,
          () => refreshInputs('pull-request'),
        )
        if ('interrupted' in checks) return
        if (!checks.success) {
          if (record.repairAttempts >= config.maxRepairAttempts) {
            await blockRecord(
              config,
              state,
              record,
              `Required pull-request checks still fail after ${record.repairAttempts} repair attempts.\n\n${checks.logs}`,
            )
            return
          }
          record.repairAttempts += 1
          appendIssueInput(record, {
            body: `Protected pull-request checks failed. Diagnose and repair the branch.\n\n${checks.logs}`,
            createdAt: now(),
            externalId: `ci-failure:${record.pr.headSha}:${record.repairAttempts}`,
            source: 'ci-failure',
          })
          record.phase = 'queued'
          writeState(config, state)
          return
        }
        record.receipts.checksPassedAt = now()
        const mergeSha = await mergePullRequest(config, record)
        record.pr.mergeSha = mergeSha
        writeState(config, state)
        return
      }

      if (record.phase === 'deploying') {
        if (!record.pr?.mergeSha) throw new Error('deploying record is missing merge SHA')
        const deployment = await waitForDeploymentReceipt(
          config,
          record.pr.mergeSha,
          () => refreshInputs('deploying'),
        )
        if (!deployment) return
        record.receipts.deployedAt = deployment.receipt.deployedAt
        record.receipts.deploymentRunUrl = deployment.run.html_url
        writeState(config, state)
        await finalizeIssue(config, client, state, record, deployment)
        return
      }

      return
    }
  } finally {
    state.activeUid = undefined
    writeState(config, state)
  }
}

async function baseline(config: AdminIssueControllerConfig, client: HassAdminTodoClient) {
  const path = statePath(config)
  if (existsSync(path)) throw new Error(`Refusing to replace existing controller state: ${path}`)
  const items = await client.getItems(config.todoEntityId)
  const ignoredUids = items.filter(actionableTodoItem).map((item) => item.uid)
  const timestamp = now()
  const state = baselineAdminIssueState(ignoredUids, timestamp)
  writeState(config, state)
  process.stdout.write(`Baselined ${ignoredUids.length} existing Admin To-Do item(s).\n`)
}

async function runOnce(config: AdminIssueControllerConfig, client: HassAdminTodoClient) {
  await verifyRepositoryIdentity(config)
  await cleanupStaleWorkerContainers()
  const state = loadState(config)
  await reconcileTodos(config, client, state)
  await reconcileGitHubInputs(config, state)
  const ready = Object.values(state.issues)
    .filter((record) => record.inputRevision > record.processedRevision)
    .filter((record) => !['completed', 'paused', 'pull-request', 'deploying'].includes(record.phase))
    .sort((left, right) => left.inputs[0].createdAt.localeCompare(right.inputs[0].createdAt))
  const inFlight = Object.values(state.issues).find((record) =>
    ['pull-request', 'deploying', 'ready-for-pr'].includes(record.phase),
  )
  const selected = inFlight ?? ready[0]
  if (selected) await processRecord(config, client, state, selected)
}

async function main() {
  loadControllerEnvironment()
  const [command = 'once', configArgument = 'ops/admin-issue-controller/controller.json'] =
    process.argv.slice(2)
  const config = loadAdminIssueControllerConfig(configArgument)
  if (command === 'status') {
    process.stdout.write(`${JSON.stringify(loadState(config), null, 2)}\n`)
    return
  }
  const client = new HassAdminTodoClient()
  if (command === 'baseline') {
    await withControllerLock(config, async () => {
      await verifyRuntimePreconditions(config)
      await baseline(config, client)
    })
    return
  }
  if (command === 'once') {
    await withControllerLock(config, async () => runOnce(config, client))
    return
  }
  if (command !== 'run') throw new Error(`Unknown command ${command}; expected baseline, once, run, or status`)

  while (true) {
    try {
      await withControllerLock(config, async () => runOnce(config, client))
    } catch (error) {
      process.stderr.write(
        `[${now()}] ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`,
      )
    }
    await sleep(config.pollSeconds * 1000)
  }
}

const executedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : ''
if (import.meta.url === executedPath) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
