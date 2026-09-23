#!/usr/bin/env tsx

import { spawn } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
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
import { basename, extname, join, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  CONTROLLER_COMMENT_MARKER,
  adminTodoCompletionRequired,
  adminIssueMarker,
  appendIssueInput,
  assertAdminIssueControllerState,
  assertCandidateAuthorized,
  assertCandidateVisualEvidence,
  assertFinalizationAuthorized,
  assertVisualEvidenceForCandidate,
  authorizedIosFollowUp,
  baselineAdminIssueState,
  beginAdminIssueGeneration,
  branchNameForIssue,
  candidateRequiresVisualEvidence,
  controllerReceiptMarker,
  deploymentReceiptIsAccepted,
  formatBlockedComment,
  formatCompletionComment,
  formatPullRequestComment,
  formatQuestionsComment,
  formatResolvedWithoutPrComment,
  formatSubmittedImageMarkdown,
  formatVisualEvidenceMarkdown,
  githubAutomationIssueMarker,
  githubAutomationIssueUid,
  isTrustedIssueComment,
  issueBody,
  issueTitle,
  markIssueInputsProcessed,
  migrateAdminIssueControllerState,
  neutralizeGitHubClosingReferences,
  parseAdminTodoAttachments,
  parseWorkerOutcome,
  sessionNameForIssue,
  todoFingerprint,
  type AdminIssueControllerState,
  type AdminIssueCandidate,
  type AdminIssueChecksReceipt,
  type AdminIssueDiffReceipt,
  type AdminIssueInput,
  type AdminIssueInputAttachment,
  type AdminIssueRecord,
  type AdminIssueValidationReceipt,
  type AdminIssueVisualEvidenceDraft,
  type AdminIssueVisualEvidenceReceipt,
  type AdminIssueWorkerOutcome,
  type GitHubIssueComment,
} from './lib/adminIssueController'
import {
  HassAdminTodoClient,
  adminCompletionBoundarySatisfied,
  type HassTodoItem,
} from './lib/hassAdminTodo'

export interface AdminIssueControllerConfig {
  completionReceiptEntityId: string
  completionScript: string
  deploymentPollSeconds: number
  deploymentTimeoutMinutes: number
  hassMcpConfigPath: string
  hassMcpServerName: string
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
  runnerControllerConfigPath: string
  runnerControllerService: string
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
  author_association?: string
  body: string | null
  created_at: string
  html_url: string
  number: number
  pull_request?: unknown
  state: 'open' | 'closed'
  title: string
  updated_at: string
  user?: {
    id?: number
    login?: string
  } | null
}

export interface GitHubPullRequest {
  base: {
    ref: string
    repo: {
      full_name: string
    } | null
  }
  head: {
    ref: string
    repo: {
      full_name: string
    } | null
    sha: string
  }
  body: string | null
  draft: boolean
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
  completed_at: string | null
  details_url: string | null
  id: number
  name: string
  status: string
}

interface GitHubCommit {
  parents: Array<{
    sha: string
  }>
  sha: string
}

interface WorkflowRun {
  conclusion: string | null
  created_at: string
  event: string
  head_branch: string | null
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

const MAX_GITHUB_BODY_BYTES = 60_000
const MAX_WORKER_OUTPUT_BYTES = 50 * 1024 * 1024
const MAX_BASE_RESYNCS_PER_GENERATION = 2
const DEPLOYMENT_RECOVERY_POLL_INTERVAL_MS = 5 * 60_000
const PULL_REQUEST_HEAD_PROPAGATION_TIMEOUT_MS = 2 * 60_000
const ALLOWED_WORKER_PATHS = ['e2e/', 'public/', 'src/']
const DEPLOYMENT_WORKER_MUTABLE_PATHS = [
  '.github/workflows/deploy-dashboard.yml',
  'scripts/deploy-dashboard-ci.test.ts',
  'scripts/deploy-dashboard-ci.ts',
] as const
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

export class AdminIssueProvenanceError extends Error {}

export class AdminIssueDeploymentRunError extends AdminIssueProvenanceError {
  constructor(
    readonly run: Pick<WorkflowRun, 'conclusion' | 'html_url'> &
      Partial<Pick<WorkflowRun, 'id' | 'run_attempt'>>,
  ) {
    super(
      `Deployment run ${run.html_url} concluded ${run.conclusion ?? 'without a conclusion'}`,
    )
  }
}

class AdminIssueWorktreeIntegrityError extends AdminIssueProvenanceError {}

export function assertDeploymentRunSucceeded(
  run: Pick<WorkflowRun, 'conclusion' | 'html_url'>,
) {
  if (run.conclusion !== 'success') {
    throw new AdminIssueDeploymentRunError(run)
  }
}

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

function parseSystemdUserService(value: unknown, field: string) {
  const service = parseNonEmptyString(value, field)
  if (!/^[A-Za-z0-9_.@-]+\.service$/.test(service)) {
    throw new Error(`${field} must be a systemd service unit name`)
  }
  return service
}

function parseStringArray(value: unknown, field: string) {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string' || !entry.trim())) {
    throw new Error(`${field} must be an array of non-empty strings`)
  }
  return value.map((entry) => entry.trim())
}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function workflowDigestRotationRequired(files: string[], workflowPath: string) {
  return files.includes(workflowPath)
}

export function updateWorkflowDigestConfig(
  value: unknown,
  workflowSha256: string,
) {
  if (!/^[a-f0-9]{64}$/.test(workflowSha256)) {
    throw new Error('workflowSha256 must be a lowercase SHA-256 digest')
  }
  if (!object(value)) {
    throw new Error('Runner controller config must be a JSON object')
  }
  if (value.version !== 1) {
    throw new Error('Runner controller config version must be 1')
  }
  if (
    typeof value.workflowSha256 !== 'string' ||
    !/^[a-f0-9]{64}$/.test(value.workflowSha256)
  ) {
    throw new Error('Runner controller config workflowSha256 is invalid')
  }
  return {
    ...value,
    workflowSha256,
  }
}

export function selectWorkerHassMcpConfig(value: unknown, serverName: string) {
  if (!object(value) || !object(value.mcpServers)) {
    throw new Error('HASS MCP config must contain an mcpServers object')
  }
  const server = value.mcpServers[serverName]
  if (!object(server)) {
    throw new Error(`HASS MCP server ${serverName} is not configured`)
  }
  const hasUrl = typeof server.url === 'string' && server.url.trim().length > 0
  const hasCommand = typeof server.command === 'string' && server.command.trim().length > 0
  if (hasUrl === hasCommand) {
    throw new Error(`HASS MCP server ${serverName} must configure exactly one transport`)
  }
  if (hasUrl) {
    let protocol: string
    try {
      protocol = new URL(String(server.url)).protocol
    } catch {
      throw new Error(`HASS MCP server ${serverName} URL is invalid`)
    }
    if (!['http:', 'https:'].includes(protocol)) {
      throw new Error(`HASS MCP server ${serverName} must use HTTP or HTTPS`)
    }
  }
  return {
    mcpServers: {
      [serverName]: server,
    },
  }
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

function assertPrivateRegularFile(path: string, field: string) {
  const file = lstatSync(path)
  if (!file.isFile()) {
    throw new Error(`${field} must reference a regular file`)
  }
  if (process.platform !== 'win32' && (file.mode & 0o077) !== 0) {
    throw new Error(`${field} must not be readable by group or other users`)
  }
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
  const hassMcpConfigPath = resolveInside(
    homedir(),
    realpathSync(
      parseNonEmptyString(raw.hassMcpConfigPath, 'hassMcpConfigPath').replace(
        /^~(?=\/|$)/,
        homedir(),
      ),
    ),
    'hassMcpConfigPath',
  )
  const hassMcpConfigStat = statSync(hassMcpConfigPath)
  if (!hassMcpConfigStat.isFile()) {
    throw new Error('hassMcpConfigPath must reference a regular file')
  }
  if (process.platform !== 'win32' && (hassMcpConfigStat.mode & 0o077) !== 0) {
    throw new Error('hassMcpConfigPath must not be readable by group or other users')
  }
  const hassMcpServerName = parseNonEmptyString(
    raw.hassMcpServerName ?? 'hass',
    'hassMcpServerName',
  )
  const runnerControllerConfigPath = resolveInside(
    homedir(),
    parseNonEmptyString(
      raw.runnerControllerConfigPath ??
        '~/.config/ha-dashboard-runner/controller.json',
      'runnerControllerConfigPath',
    ),
    'runnerControllerConfigPath',
  )
  if (existsSync(runnerControllerConfigPath)) {
    assertPrivateRegularFile(
      runnerControllerConfigPath,
      'runnerControllerConfigPath',
    )
  }
  if (
    !/^[A-Za-z0-9_.-]+$/.test(hassMcpServerName) ||
    ['__proto__', 'constructor', 'prototype'].includes(hassMcpServerName)
  ) {
    throw new Error('hassMcpServerName contains unsupported characters')
  }
  selectWorkerHassMcpConfig(
    JSON.parse(readFileSync(hassMcpConfigPath, 'utf8')) as unknown,
    hassMcpServerName,
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
    if (pathsOverlap(path, hassMcpConfigPath)) {
      throw new Error(`hassMcpConfigPath must not overlap ${field}`)
    }
  }
  if (pathsOverlap(repositoryPath, hassMcpConfigPath)) {
    throw new Error('hassMcpConfigPath must not overlap repositoryPath')
  }
  if (pathsOverlap(repositoryPath, runnerControllerConfigPath)) {
    throw new Error('runnerControllerConfigPath must not overlap repositoryPath')
  }
  if (pathsOverlap(hassMcpConfigPath, runnerControllerConfigPath)) {
    throw new Error('runnerControllerConfigPath must not overlap hassMcpConfigPath')
  }
  for (let index = 0; index < mutablePaths.length; index += 1) {
    if (pathsOverlap(mutablePaths[index][1], runnerControllerConfigPath)) {
      throw new Error(
        `runnerControllerConfigPath must not overlap ${mutablePaths[index][0]}`,
      )
    }
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
    hassMcpConfigPath,
    hassMcpServerName,
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
    runnerControllerConfigPath,
    runnerControllerService: parseSystemdUserService(
      raw.runnerControllerService ??
        'ha-dashboard-runner-controller.service',
      'runnerControllerService',
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

async function rotateRunnerWorkflowDigest(
  config: AdminIssueControllerConfig,
  mergeSha: string,
  files: string[],
) {
  const workflowPath = `.github/workflows/${config.requiredWorkflow}`
  if (!workflowDigestRotationRequired(files, workflowPath)) return
  if (!existsSync(config.runnerControllerConfigPath)) {
    throw new AdminIssueProvenanceError(
      `Runner controller config is missing at ${config.runnerControllerConfigPath}`,
    )
  }
  assertPrivateRegularFile(
    config.runnerControllerConfigPath,
    'runnerControllerConfigPath',
  )
  await runCommand('git', ['fetch', '--quiet', 'origin', 'master'], {
    cwd: config.repositoryPath,
    timeoutMs: 120_000,
  })
  const onMaster = await runCommand(
    'git',
    ['merge-base', '--is-ancestor', mergeSha, 'origin/master'],
    {
      allowFailure: true,
      cwd: config.repositoryPath,
      timeoutMs: 30_000,
    },
  )
  if (onMaster.exitCode !== 0) {
    throw new AdminIssueProvenanceError(
      `Merged workflow commit ${mergeSha} is not on current origin/master`,
    )
  }
  const source = (
    await runCommand('git', ['show', `${mergeSha}:${workflowPath}`], {
      cwd: config.repositoryPath,
      timeoutMs: 30_000,
    })
  ).stdout
  const workflowSha256 = createHash('sha256').update(source).digest('hex')
  const currentSerialized = readFileSync(
    config.runnerControllerConfigPath,
    'utf8',
  )
  const current = JSON.parse(currentSerialized) as unknown
  const updated = updateWorkflowDigestConfig(current, workflowSha256)
  if (object(current) && current.workflowSha256 === workflowSha256) {
    await assertRunnerControllerActive(config)
    return
  }
  const temporaryPath = `${config.runnerControllerConfigPath}.${process.pid}.tmp`
  writeFileSync(temporaryPath, `${JSON.stringify(updated, null, 2)}\n`, {
    mode: 0o600,
  })
  renameSync(temporaryPath, config.runnerControllerConfigPath)
  chmodSync(config.runnerControllerConfigPath, 0o600)
  try {
    await runCommand(
      'systemctl',
      ['--user', 'restart', config.runnerControllerService],
      { timeoutMs: 30_000 },
    )
    await assertRunnerControllerActive(config)
  } catch (error) {
    const restorePath = `${config.runnerControllerConfigPath}.${process.pid}.restore`
    writeFileSync(restorePath, currentSerialized, { mode: 0o600 })
    renameSync(restorePath, config.runnerControllerConfigPath)
    chmodSync(config.runnerControllerConfigPath, 0o600)
    await runCommand(
      'systemctl',
      ['--user', 'restart', config.runnerControllerService],
      { allowFailure: true, timeoutMs: 30_000 },
    )
    throw new AdminIssueProvenanceError(
      `Runner controller trust rotation failed and the prior config was restored: ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
  }
}

async function assertRunnerControllerActive(config: AdminIssueControllerConfig) {
  const active = await runCommand(
    'systemctl',
    ['--user', 'is-active', config.runnerControllerService],
    { allowFailure: true, timeoutMs: 30_000 },
  )
  if (active.exitCode !== 0 || active.stdout.trim() !== 'active') {
    throw new AdminIssueProvenanceError(
      `Runner controller ${config.runnerControllerService} is not active`,
    )
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

export function loadAdminIssueControllerState(
  config: AdminIssueControllerConfig,
  allowMigration = false,
) {
  const path = statePath(config)
  if (!existsSync(path)) {
    throw new Error(`Controller is not baselined. Run baseline first; missing ${path}`)
  }
  const serialized = readFileSync(path, 'utf8')
  const value = JSON.parse(serialized) as unknown
  if (object(value) && value.version === 1) {
    if (!allowMigration) {
      throw new Error('Controller state version 1 requires a locked run to migrate to version 2')
    }
    const migratedAt = now()
    const migrated = migrateAdminIssueControllerState(value, migratedAt)
    const backupPath = join(
      config.stateDirectory,
      `state.v1-backup-${migratedAt.replaceAll(':', '-')}.json`,
    )
    writeFileSync(backupPath, serialized, { flag: 'wx', mode: 0o600 })
    chmodSync(backupPath, 0o600)
    writeState(config, migrated)
    return migrated
  }
  assertAdminIssueControllerState(value)
  return value
}

function writeState(config: AdminIssueControllerConfig, state: AdminIssueControllerState) {
  assertAdminIssueControllerState(state)
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

async function listOpenIssues(config: AdminIssueControllerConfig) {
  const issues: GitHubIssue[] = []
  for (let page = 1; page <= 100; page += 1) {
    const batch = await ghApi<GitHubIssue[]>(
      config,
      'GET',
      `repos/${config.repository}/issues?state=open&sort=created&direction=asc&per_page=100&page=${page}`,
    )
    issues.push(...batch.filter((issue) => !issue.pull_request))
    if (batch.length < 100) return issues
  }
  throw new Error(`Repository exceeds the controller's 10,000-open-issue safety limit`)
}

function trustedGitHubAutomationIssue(
  config: Pick<AdminIssueControllerConfig, 'ownerId' | 'ownerLogin'>,
  issue: GitHubIssue,
) {
  const marker = githubAutomationIssueMarker(issue.body)
  if (!marker) return undefined
  const login = issue.user?.login?.toLowerCase()
  const owner = issue.user?.id === config.ownerId &&
    login === config.ownerLogin.toLowerCase() &&
    issue.author_association === 'OWNER'
  return owner || login === 'github-actions[bot]' ? marker : undefined
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
  const controllerBody = body.includes(CONTROLLER_COMMENT_MARKER)
    ? body
    : `${CONTROLLER_COMMENT_MARKER}\n${body}`
  const desiredBody = controllerBody.includes(marker)
    ? controllerBody
    : `${controllerBody}\n\n${marker}`
  if (Buffer.byteLength(desiredBody) > MAX_GITHUB_BODY_BYTES) {
    throw new Error(`GitHub issue comment exceeds ${MAX_GITHUB_BODY_BYTES} bytes`)
  }
  const comments = await listIssueComments(config, issueNumber)
  const existing = comments.find((comment) => comment.body?.includes(marker))
  if (existing) {
    if (existing.body === desiredBody) return existing
    return await ghApi<GitHubIssueComment>(
      config,
      'PATCH',
      `repos/${config.repository}/issues/comments/${existing.id}`,
      { body: desiredBody },
    )
  }
  return await ghApi<GitHubIssueComment>(
    config,
    'POST',
    `repos/${config.repository}/issues/${issueNumber}/comments`,
    { body: desiredBody },
  )
}

function buildInitialInput(
  item: ActionableTodoItem,
  body = item.description?.trim() || '',
  attachments: AdminIssueInputAttachment[] = [],
): AdminIssueInput {
  const fingerprint = todoFingerprint(item.summary, item.description)
  return {
    ...(attachments.length > 0 ? { attachments } : {}),
    body,
    createdAt: now(),
    externalId: `todo:${fingerprint}`,
    revision: 1,
    source: 'todo-created',
  }
}

async function loadTodoAttachments(
  config: AdminIssueControllerConfig,
  client: HassAdminTodoClient,
  uid: string,
  description: string | undefined,
) {
  const parsed = parseAdminTodoAttachments(description)
  if (parsed.attachments.length === 0) {
    return { attachments: [] as AdminIssueInputAttachment[], description: parsed.description }
  }
  const githubToken = (
    await runCommand('gh', ['auth', 'token'], {
      cwd: config.repositoryPath,
      timeoutMs: 30_000,
    })
  ).stdout.trim()
  if (!githubToken) throw new Error('gh auth token returned an empty token')
  const attachmentDirectory = join(
    config.stateDirectory,
    'input-attachments',
    uid.replace(/[^A-Za-z0-9._-]+/g, '-'),
  )
  mkdirSync(attachmentDirectory, { mode: 0o700, recursive: true })
  const attachments: AdminIssueInputAttachment[] = []
  for (const attachment of parsed.attachments) {
    const bytes = await client.getAdminTodoAttachment(attachment.id)
    if (bytes.length !== attachment.sizeBytes) {
      throw new Error(`Admin To-Do attachment ${attachment.id} size does not match its manifest`)
    }
    const digest = createHash('sha256').update(bytes).digest('hex')
    if (digest !== attachment.sha256) {
      throw new Error(`Admin To-Do attachment ${attachment.id} hash does not match its manifest`)
    }
    const mediaType = visualEvidenceMediaType(Buffer.from(bytes))
    if (mediaType !== attachment.mediaType) {
      throw new Error(`Admin To-Do attachment ${attachment.id} type does not match its manifest`)
    }
    const extension = mediaType === 'image/png'
      ? '.png'
      : mediaType === 'image/jpeg'
        ? '.jpg'
        : '.webp'
    const localPath = join(attachmentDirectory, `${attachment.id}${extension}`)
    writeFileSync(localPath, bytes, { mode: 0o600 })
    const githubUrl = await uploadGitHubUserAttachment(
      config,
      githubToken,
      bytes,
      basename(attachment.name).slice(0, 240) || `${attachment.id}${extension}`,
      mediaType,
    )
    attachments.push({
      githubUrl,
      id: attachment.id,
      localPath,
      mediaType,
      name: attachment.name,
      sha256: digest,
      sizeBytes: bytes.length,
    })
  }
  return { attachments, description: parsed.description }
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
      const attachmentInput = await loadTodoAttachments(
        config,
        client,
        item.uid,
        item.description,
      )
      let issue = await findIssueByUid(config, item.uid)
      if (!issue) {
        issue = await ghApi<GitHubIssue>(
          config,
          'POST',
          `repos/${config.repository}/issues`,
          {
            body: issueBody({
              attachments: attachmentInput.attachments.map((attachment) => ({
                alt: attachment.name,
                url: attachment.githubUrl as string,
              })),
              description: attachmentInput.description,
              summary: item.summary,
              uid: item.uid,
            }),
            labels: config.issueLabels,
            title: issueTitle(item.summary),
          },
        )
      } else if (attachmentInput.attachments.length > 0) {
        issue = await ghApi<GitHubIssue>(
          config,
          'PATCH',
          `repos/${config.repository}/issues/${issue.number}`,
          {
            body: issueBody({
              attachments: attachmentInput.attachments.map((attachment) => ({
                alt: attachment.name,
                url: attachment.githubUrl as string,
              })),
              description: attachmentInput.description,
              summary: item.summary,
              uid: item.uid,
            }),
          },
        )
      }
      const createdAt = now()
      record = {
        commentCursor: 0,
        createdAt,
        description: attachmentInput.description,
        generation: 1,
        inputRevision: 1,
        inputs: [
          buildInitialInput(
            item,
            attachmentInput.description,
            attachmentInput.attachments,
          ),
        ],
        issueNumber: issue.number,
        issueUrl: issue.html_url,
        phase: 'queued',
        processedRevision: 0,
        provenance: { kind: 'none' },
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
    const attachmentInput = await loadTodoAttachments(
      config,
      client,
      item.uid,
      item.description,
    )
    await ghApi(
      config,
      'PATCH',
      `repos/${config.repository}/issues/${record.issueNumber}`,
      {
        body: issueBody({
          attachments: attachmentInput.attachments.map((attachment) => ({
            alt: attachment.name,
            url: attachment.githubUrl as string,
          })),
          description: attachmentInput.description,
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
        attachmentInput.description || '_No additional details were supplied._',
        ...(attachmentInput.attachments.length > 0
          ? [
            '',
            ...attachmentInput.attachments.map(
              (attachment) => formatSubmittedImageMarkdown(
                attachment.name,
                attachment.githubUrl as string,
              ),
            ),
          ]
          : []),
      ].join('\n'),
    )
    record.taskFingerprint = fingerprint
    record.title = issueTitle(item.summary)
    record.description = attachmentInput.description
    appendIssueInput(record, {
      ...(attachmentInput.attachments.length > 0
        ? { attachments: attachmentInput.attachments }
        : {}),
      body: attachmentInput.description,
      createdAt: now(),
      externalId: `todo:${fingerprint}`,
      source: 'todo-updated',
    })
    if (previousFingerprint !== fingerprint && !['deploying', 'completed'].includes(record.phase)) {
      record.phase = 'queued'
    }
    writeState(config, state)
  }

  for (const record of Object.values(state.issues)) {
    for (const input of record.inputs) {
      if (!['todo-created', 'todo-updated'].includes(input.source)) continue
      for (const attachment of input.attachments ?? []) {
        const receiptKey = `todoAttachmentDeleted:${attachment.id}`
        if (record.receipts[receiptKey]) continue
        await client.deleteAdminTodoAttachment(attachment.id)
        record.receipts[receiptKey] = now()
        writeState(config, state)
      }
    }
  }
}

async function reconcileGitHubAutomationIssues(
  config: AdminIssueControllerConfig,
  state: AdminIssueControllerState,
) {
  const trackedIssueNumbers = new Set(
    Object.values(state.issues).map((record) => record.issueNumber),
  )
  for (const issue of await listOpenIssues(config)) {
    const marker = trustedGitHubAutomationIssue(config, issue)
    if (trackedIssueNumbers.has(issue.number) || !marker) {
      continue
    }
    const uid = githubAutomationIssueUid(issue.number)
    const createdAt = issue.created_at || now()
    const body = issue.body?.trim() || ''
    const fingerprint = todoFingerprint(issue.title, body)
    const record: AdminIssueRecord = {
      automationKind: marker === 'layout-failure-commit-' ? 'layout' : 'deployment',
      commentCursor: 0,
      createdAt,
      description: body,
      generation: 1,
      inputRevision: 1,
      inputs: [{
        body: `${issue.title}\n\n${body}`.trim(),
        createdAt,
        externalId: `github-issue:${issue.number}:${fingerprint}`,
        revision: 1,
        source: 'github-issue',
      }],
      issueNumber: issue.number,
      issueUrl: issue.html_url,
      origin: 'github-automation',
      phase: 'queued',
      processedRevision: 0,
      provenance: { kind: 'none' },
      receipts: { githubIssueDiscoveredAt: now() },
      repairAttempts: 0,
      sessionName: sessionNameForIssue(issue.number, uid),
      taskFingerprint: fingerprint,
      title: issueTitle(issue.title),
      uid,
      updatedAt: createdAt,
      workerRuns: 0,
    }
    state.issues[uid] = record
    trackedIssueNumbers.add(issue.number)
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

async function loadGitHubCommentAttachments(
  config: AdminIssueControllerConfig,
  record: AdminIssueRecord,
  comment: GitHubIssueComment,
) {
  const body = comment.body ?? ''
  const matches = [...body.matchAll(
    /!\[([^\]]*)\]\((https:\/\/github\.com\/user-attachments\/assets\/[A-Za-z0-9-]+)\)/g,
  )]
  const unique = [...new Map(matches.map((match) => [match[2], match])).values()].slice(0, 4)
  if (unique.length === 0) return [] as AdminIssueInputAttachment[]
  const githubToken = (
    await runCommand('gh', ['auth', 'token'], {
      cwd: config.repositoryPath,
      timeoutMs: 30_000,
    })
  ).stdout.trim()
  if (!githubToken) throw new Error('gh auth token returned an empty token')
  const attachmentDirectory = join(
    config.stateDirectory,
    'input-attachments',
    record.uid.replace(/[^A-Za-z0-9._-]+/g, '-'),
    `comment-${comment.id}`,
  )
  mkdirSync(attachmentDirectory, { mode: 0o700, recursive: true })
  const attachments: AdminIssueInputAttachment[] = []
  for (const match of unique) {
    const githubUrl = match[2]
    const response = await fetch(githubUrl, {
      headers: {
        Accept: 'image/avif,image/webp,image/png,image/jpeg',
        Authorization: `Bearer ${githubToken}`,
      },
      redirect: 'follow',
    })
    if (!response.ok) {
      throw new Error(`GitHub issue attachment download failed with HTTP ${response.status}`)
    }
    const bytes = new Uint8Array(await response.arrayBuffer())
    if (bytes.length <= 0 || bytes.length > MAX_VISUAL_EVIDENCE_BYTES) {
      throw new Error(`GitHub issue attachment exceeds the ${MAX_VISUAL_EVIDENCE_BYTES}-byte limit`)
    }
    const mediaType = visualEvidenceMediaType(Buffer.from(bytes))
    const extension = mediaType === 'image/png'
      ? '.png'
      : mediaType === 'image/jpeg'
        ? '.jpg'
        : '.webp'
    const id = githubUrl.split('/').at(-1) as string
    const localPath = join(attachmentDirectory, `${id}${extension}`)
    writeFileSync(localPath, bytes, { mode: 0o600 })
    attachments.push({
      githubUrl,
      id,
      localPath,
      mediaType,
      name: match[1].trim() || `Issue attachment ${attachments.length + 1}`,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      sizeBytes: bytes.length,
    })
  }
  return attachments
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
      const attachments = await loadGitHubCommentAttachments(config, record, comment)
      appendIssueInput(record, {
        ...(attachments.length > 0 ? { attachments } : {}),
        body: comment.body ?? '',
        createdAt: comment.created_at ?? now(),
        externalId: `comment:${comment.id}`,
        source: 'issue-comment',
      })
      if (
        record.provenance.kind === 'legacy-untrusted' ||
        (
          record.provenance.kind === 'active' &&
          (
            record.provenance.quarantine ||
            (
              record.provenance.transition &&
              ['aborted', 'failed', 'quarantined'].includes(record.provenance.transition.stage)
            )
          )
        )
      ) {
        await startNewGeneration(config, record)
      } else if (
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
      const controllerResolvedWithoutPr = comments.some((comment) =>
        comment.body?.includes(
          controllerReceiptMarker(
            record.uid,
            `resolved-without-pr-r${record.processedRevision}`,
          ),
        ),
      )
      if (
        controllerCompleted &&
        record.provenance.kind === 'active' &&
        record.provenance.merge &&
        record.provenance.deployment
      ) {
        record.phase = 'deploying'
        record.receipts.issueClosedAt = issue.updated_at
      } else if (
        controllerResolvedWithoutPr &&
        record.lastOutcome?.decision === 'resolved_without_pr'
      ) {
        record.phase = 'resolving'
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
  if (record.pr) {
    const pullRequest = await ghApi<GitHubPullRequest>(
      config,
      'GET',
      `repos/${config.repository}/pulls/${record.pr.number}`,
    )
    if (pullRequest.state === 'open' && !pullRequest.merged_at) {
      await ghApi(
        config,
        'PATCH',
        `repos/${config.repository}/pulls/${record.pr.number}`,
        { state: 'closed' },
      )
      record.receipts.supersededPrClosedAt = now()
    }
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
  if (record.worktreePath && existsSync(record.worktreePath)) {
    if (
      record.provenance.kind !== 'active' ||
      record.provenance.generation !== record.generation
    ) {
      throw new Error('Existing worktree does not have active version-2 provenance')
    }
    return record.worktreePath
  }

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
  const preparedBaseSha = (
    await runCommand('git', ['rev-parse', 'origin/master'], { cwd: record.worktreePath })
  ).stdout.trim()
  record.provenance = {
    epoch: randomUUID(),
    generation: record.generation,
    kind: 'active',
    preparedBaseSha,
    resyncAttempts: 0,
    revision: record.processedRevision,
  }
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

export function prepareCopilotHome(config: AdminIssueControllerConfig) {
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
  const hassMcpConfig = selectWorkerHassMcpConfig(
    JSON.parse(readFileSync(config.hassMcpConfigPath, 'utf8')) as unknown,
    config.hassMcpServerName,
  )
  writeFileSync(
    join(copilotHome, 'mcp-config.json'),
    `${JSON.stringify(hassMcpConfig, null, 2)}\n`,
    { mode: 0o600 },
  )
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
    existsSync(join(worktreePath, '.mcp.json')) ||
    existsSync(join(worktreePath, '.github/mcp.json'))
  ) {
    throw new Error('Project MCP configuration is not allowed in autonomous worker sessions')
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
  record?: Pick<AdminIssueRecord, 'automationKind'>,
) {
  const copilotHome = join(config.workerHome, '.copilot')
  const environment: NodeJS.ProcessEnv = {
    ADMIN_ISSUE_GIT_COMMON_DIR: gitCommonDirectory,
    ADMIN_ISSUE_WORKER_IMAGE: config.workerImageId,
    ADMIN_ISSUE_WORKSPACE: worktreePath,
    ...(record?.automationKind === 'deployment'
      ? { ADMIN_ISSUE_MUTABLE_PATHS: DEPLOYMENT_WORKER_MUTABLE_PATHS.join(',') }
      : {}),
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

export function buildWorkerPrompt(record: AdminIssueRecord) {
  const pendingInputs = record.inputs.filter((input) => input.revision > record.processedRevision)
  const issueContext = pendingInputs
    .map(
      (input) => {
        const attachments = input.attachments?.length
          ? `\n\nSubmitted images:\n${input.attachments
            .map((attachment) => `- ${workerAttachmentPath(record, input.revision, attachment)}`)
            .join('\n')}`
          : ''
        return `### Input ${input.revision} (${input.source}, ${input.createdAt})\n${input.body}${attachments}`
      },
    )
    .join('\n\n')
  const protectedSurfaceGuidance = record.automationKind === 'deployment'
    ? `This trusted deployment-failure issue may modify only these infrastructure paths in addition to ordinary dashboard paths: ${DEPLOYMENT_WORKER_MUTABLE_PATHS.join(', ')}. Keep every change scoped to deployment diagnosis, recovery, or regression coverage.`
    : 'Do not modify Git metadata, the .github directory, controller infrastructure, dependency manifests or lockfiles, test-policy scripts, or build/test configuration. If the fix truly requires one of those protected surfaces, return needs_input and explain why.'
  return `/tandem-research ${record.title}

You are working on GitHub issue #${record.issueNumber} in ${record.issueUrl}.

Use the tandem-research workflow to investigate the issue before implementation. The operator's issue text and follow-up comments below are canonical. Make repository changes only through the admin_issue_workspace tool. Use the configured Home Assistant MCP server directly whenever current HA state, history, traces, configuration, services, or validation are relevant. It is a trusted local execution surface with operator-equivalent Home Assistant access. Follow the server's skill-guide and safety contracts, prefer read-only diagnosis before mutation, perform only issue-scoped HA actions, verify their results, and never expose credentials or secret-bearing configuration. Do not use host filesystem, host shell, GitHub, general network, commit, push, merge, deployment, or issue-mutation tools. The trusted host controller owns those operations.

Gather available Home Assistant evidence yourself before asking the operator for diagnostics or authorization. Do not offer an input option that merely authorizes a capability already available to you. Treat submitted images as canonical issue evidence and inspect them when relevant. If a consequential product or design decision remains after repository and Home Assistant investigation, stop and return needs_input with concise options and your recommendation. Otherwise implement the complete fix in the assigned worktree, update the directly owned tests, run the relevant tests through admin_issue_workspace, iterate until they pass, and perform a meaningful code review.

Classify whether the proposed result has a meaningful visible React state. CSS and visual-asset changes always require proposed fixed-behavior images. Logic-only focus, accessibility, Home Assistant, test, documentation, controller, and other non-demonstrable changes may set visualChange.required to false with a specific reason. When visual evidence is required, generate one to four deterministic PNG, JPEG, or WebP images and store them only below artifacts/admin-issue-${record.issueNumber}/; this ignored directory is not part of the commit. Use focused states and viewports that make the fix reviewable, label mock-backed evidence visibly, and never actuate devices merely to capture an image. Each caption must explicitly say whether the image is mock or live evidence. The host controller embeds the same uploaded images in both the pull request and the GitHub issue update. Images supplement tests.

Manual iOS follow-up is exceptional. Set iosFollowUp.required only when the canonical issue explicitly identifies iOS, Safari, WebKit, safe-area, or software-keyboard behavior, or discusses an iPhone/iPad in a browser-interface context; the repository candidate must also change a browser-facing surface, and the reason must name the platform-specific behavior that cannot be certified locally. An iPhone involved only as a Home Assistant presence device is not an iOS browser-verification gate. Generic responsive layout, wrapping, focus restoration, or Linux WebKit limitations do not create the gate by themselves.

If Home Assistant work fully resolves the issue, or investigation proves that no repository change is appropriate, keep the worktree clean and return resolved_without_pr. Explain the verified resolution and why no pull request or deployment is needed. Never create an unrelated repository change merely to satisfy the lifecycle.

${protectedSurfaceGuidance}

Return a final response containing exactly one JSON object and no Markdown fence:
{
  "schemaVersion": 1,
  "decision": "needs_input" | "ready_for_pr" | "resolved_without_pr" | "blocked",
  "summary": "concise current result",
  "questions": [{ "question": "...", "options": ["...", "..."], "recommendation": "..." }],
  "issueTitle": "concise PR-quality issue title",
  "resolutionType": "home_assistant" | "no_repository_change",
  "resolution": "verified resolution and why no repository change is needed",
  "verification": ["specific verified evidence"],
  "changeSummary": ["..."],
  "tests": [{ "command": "...", "result": "passed" | "failed" }],
  "visualChange": { "required": true | false, "reason": "why images are or are not useful" },
  "visualEvidence": [{ "path": "artifacts/admin-issue-${record.issueNumber}/fixed-phone.png", "alt": "Accessible description of the fixed state", "caption": "Mock evidence: concise state and viewport description" }],
  "review": { "approved": true | false, "findings": ["..."] },
  "pr": { "title": "...", "body": "..." },
  "iosFollowUp": { "required": true | false, "reason": "..." },
  "reason": "..."
}

For needs_input, provide at least one question. For ready_for_pr, changeSummary and tests must be non-empty, review.approved must be true, pr title/body and visualChange must be present, and visualEvidence must follow the visual classification above. For resolved_without_pr, issueTitle, resolutionType, resolution, and verification must be present and the worktree must remain clean. For blocked, explain the blocker. Omit fields that do not apply.

Always include schemaVersion, decision, summary, questions, visualEvidence, and iosFollowUp. Use empty questions and visualEvidence arrays when they do not apply. A ready_for_pr outcome is valid only when every listed test passed.

${issueContext}`
}

function workerAttachmentPath(
  record: Pick<AdminIssueRecord, 'issueNumber'>,
  revision: number,
  attachment: Pick<AdminIssueInputAttachment, 'id' | 'mediaType'>,
) {
  const extension = attachment.mediaType === 'image/png'
    ? '.png'
    : attachment.mediaType === 'image/jpeg'
      ? '.jpg'
      : '.webp'
  return `artifacts/admin-issue-${record.issueNumber}/reported/input-${revision}-${attachment.id}${extension}`
}

function materializeWorkerInputAttachments(record: AdminIssueRecord) {
  if (!record.worktreePath) throw new Error('Worker worktree is missing')
  for (const input of record.inputs) {
    for (const attachment of input.attachments ?? []) {
      if (!existsSync(attachment.localPath)) {
        throw new Error(`Worker input attachment is missing: ${attachment.localPath}`)
      }
      const destination = resolve(
        record.worktreePath,
        workerAttachmentPath(record, input.revision, attachment),
      )
      mkdirSync(join(destination, '..'), { mode: 0o700, recursive: true })
      copyFileSync(attachment.localPath, destination)
      chmodSync(destination, 0o400)
    }
  }
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

function assertReadyOutcomeMatchesCandidate(
  record: AdminIssueRecord,
  outcome: Extract<AdminIssueWorkerOutcome, { decision: 'ready_for_pr' }>,
) {
  const { candidate } = assertCandidateAuthorized(record, true)
  const expectedEvidence = (candidate.visualEvidence ?? []).map((evidence) => ({
    alt: evidence.alt,
    caption: evidence.caption,
    path: evidence.path,
  }))
  if (JSON.stringify(expectedEvidence) !== JSON.stringify(outcome.visualEvidence)) {
    throw new AdminIssueProvenanceError(
      'Recovered worker outcome visual evidence does not match the authorized candidate',
    )
  }
  if (
    candidate.visualChange &&
    JSON.stringify(candidate.visualChange) !== JSON.stringify(outcome.visualChange)
  ) {
    throw new AdminIssueProvenanceError(
      'Recovered worker outcome visual classification does not match the authorized candidate',
    )
  }
}

export function restoreReadyOutcomeFromWorkerLog(
  config: Pick<AdminIssueControllerConfig, 'stateDirectory'>,
  record: AdminIssueRecord,
) {
  if (record.lastOutcome?.decision === 'ready_for_pr') {
    assertReadyOutcomeMatchesCandidate(record, record.lastOutcome)
    return record.lastOutcome
  }
  if (record.workerRuns < 1) {
    throw new AdminIssueProvenanceError(
      'Blocked deployment has no successful worker run to restore',
    )
  }
  const logPath = join(
    config.stateDirectory,
    'worker-logs',
    `issue-${record.issueNumber}-run-${record.workerRuns}.jsonl`,
  )
  if (!existsSync(logPath)) {
    throw new AdminIssueProvenanceError(
      `Blocked deployment worker log is missing: ${logPath}`,
    )
  }
  const outcome = parseWorkerOutcome(
    extractFinalAssistantResponse(readFileSync(logPath, 'utf8')),
  )
  if (outcome.decision !== 'ready_for_pr') {
    throw new AdminIssueProvenanceError(
      'Latest successful worker run did not authorize the merged candidate',
    )
  }
  assertReadyOutcomeMatchesCandidate(record, outcome)
  record.lastOutcome = outcome
  return outcome
}

interface WorkerSessionCandidate {
  id: string
  name: string
  summaryCount: number
  updatedAt: string
}

export function selectWorkerSessionCandidate(
  candidates: readonly WorkerSessionCandidate[],
  sessionName: string,
) {
  const matching = candidates
    .filter((candidate) => candidate.name.toLowerCase() === sessionName.toLowerCase())
    .sort((left, right) =>
      right.summaryCount - left.summaryCount ||
      right.updatedAt.localeCompare(left.updatedAt) ||
      left.id.localeCompare(right.id),
    )
  if (matching.length === 0) return undefined
  if (
    matching.length > 1 &&
    matching[0].summaryCount === matching[1].summaryCount &&
    matching[0].updatedAt === matching[1].updatedAt
  ) {
    throw new Error(`Multiple indistinguishable Copilot sessions match ${sessionName}`)
  }
  return matching[0]
}

function workerSessionCandidates(config: AdminIssueControllerConfig) {
  const root = join(config.workerHome, '.copilot', 'session-state')
  if (!existsSync(root)) return [] as WorkerSessionCandidate[]
  const candidates: WorkerSessionCandidate[] = []
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const workspacePath = join(root, entry.name, 'workspace.yaml')
    if (!existsSync(workspacePath)) continue
    const workspace = readFileSync(workspacePath, 'utf8')
    const field = (name: string) =>
      workspace.match(new RegExp(`^${name}:\\s*(.*)$`, 'm'))?.[1]?.trim()
    const id = field('id')
    const name = field('name')
    const updatedAt = field('updated_at')
    const summaryCount = Number(field('summary_count') ?? '0')
    if (
      id &&
      name &&
      updatedAt &&
      !Number.isNaN(Date.parse(updatedAt)) &&
      Number.isInteger(summaryCount)
    ) {
      candidates.push({ id, name, summaryCount, updatedAt })
    }
  }
  return candidates
}

function bindWorkerSessionId(
  config: AdminIssueControllerConfig,
  state: AdminIssueControllerState,
  record: AdminIssueRecord,
) {
  if (record.sessionId) return { id: record.sessionId, resume: Boolean(record.receipts.sessionCreatedAt) }
  const existing = selectWorkerSessionCandidate(
    workerSessionCandidates(config),
    record.sessionName,
  )
  if (existing) {
    record.sessionId = existing.id
    record.receipts.sessionCreatedAt ??= now()
    writeState(config, state)
    return { id: existing.id, resume: true }
  }
  record.sessionId = randomUUID()
  writeState(config, state)
  return { id: record.sessionId, resume: false }
}

async function runCopilotWorker(
  config: AdminIssueControllerConfig,
  state: AdminIssueControllerState,
  record: AdminIssueRecord,
) {
  const worktreePath = await ensureWorktree(config, state, record)
  materializeWorkerInputAttachments(record)
  assertProtectedPathsUntouched(await changedFiles(worktreePath), record)
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
    record,
  )
  const session = bindWorkerSessionId(config, state, record)
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
    '--enable-mcp-server',
    config.hassMcpServerName,
    '--allow-all-mcp-server-instructions',
    '--no-ask-user',
    '--no-color',
    '--output-format',
    'json',
    '--stream',
    'on',
    '--secret-env-vars',
    'GH_TOKEN',
    '--available-tools',
    'admin_issue_workspace,skill,task,read_agent,write_agent,tool_search_tool,mcp:*',
    '--allow-tool',
    'custom-tool(admin_issue_workspace)',
    '--allow-tool',
    config.hassMcpServerName,
    '-p',
    buildWorkerPrompt(record),
  ]
  const result = await runCommand(
    'copilot',
    [
      `--session-id=${session.id}`,
      ...(session.resume ? [] : ['--name', record.sessionName]),
      ...commonArgs,
    ],
    {
      allowFailure: true,
      cwd: worktreePath,
      env: environment,
      maxOutputBytes: MAX_WORKER_OUTPUT_BYTES,
      timeoutMs: config.workerTimeoutMinutes * 60_000,
    },
  )

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

function workerMutableInfrastructurePaths(record?: Pick<AdminIssueRecord, 'automationKind'>) {
  return new Set<string>(
    record?.automationKind === 'deployment' ? DEPLOYMENT_WORKER_MUTABLE_PATHS : [],
  )
}

function assertProtectedPathsUntouched(
  files: string[],
  record?: Pick<AdminIssueRecord, 'automationKind'>,
) {
  const mutableInfrastructurePaths = workerMutableInfrastructurePaths(record)
  for (const file of files) {
    const normalized = file.replaceAll('\\', '/')
    if (mutableInfrastructurePaths.has(normalized)) {
      continue
    }
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

export function assertWorkerChangesSafe(
  worktreePath: string,
  files: string[],
  record?: Pick<AdminIssueRecord, 'automationKind'>,
) {
  if (files.length === 0) throw new Error('Worker reported ready_for_pr but made no repository changes')
  const mutableInfrastructurePaths = workerMutableInfrastructurePaths(record)
  assertProtectedPathsUntouched(files, record)
  for (const file of files) {
    const normalized = file.replaceAll('\\', '/')
    if (
      normalized !== 'index.html' &&
      !ALLOWED_WORKER_PATHS.some((allowedPath) => normalized.startsWith(allowedPath)) &&
      !mutableInfrastructurePaths.has(normalized)
    ) {
      throw new Error(
        mutableInfrastructurePaths.size > 0
          ? `Worker changed a path outside its authorized repair scope: ${file}`
          : `Worker changed a path outside the auto-deployed dashboard: ${file}`,
      )
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

export interface AdminIssueWorktreeSnapshot {
  branch: string
  gitOperations: string[]
  headSha: string
  status: string
  treeSha: string
}

export async function readWorktreeSnapshot(
  worktreePath: string,
): Promise<AdminIssueWorktreeSnapshot> {
  const [branch, head, tree, status, gitDirectory] = await Promise.all([
    runCommand('git', ['branch', '--show-current'], { cwd: worktreePath }),
    runCommand('git', ['rev-parse', 'HEAD'], { cwd: worktreePath }),
    runCommand('git', ['rev-parse', 'HEAD^{tree}'], { cwd: worktreePath }),
    runCommand('git', ['status', '--porcelain=v2', '-z', '--untracked-files=all'], {
      cwd: worktreePath,
    }),
    runCommand('git', ['rev-parse', '--absolute-git-dir'], { cwd: worktreePath }),
  ])
  const gitOperations = [
    'CHERRY_PICK_HEAD',
    'MERGE_HEAD',
    'REBASE_HEAD',
    'REVERT_HEAD',
    'rebase-apply',
    'rebase-merge',
  ].filter((marker) => existsSync(join(gitDirectory.stdout.trim(), marker)))
  return {
    branch: branch.stdout.trim(),
    gitOperations,
    headSha: head.stdout.trim(),
    status: status.stdout,
    treeSha: tree.stdout.trim(),
  }
}

export function assertExactCandidateSnapshot(
  snapshot: AdminIssueWorktreeSnapshot,
  record: AdminIssueRecord,
  headSha: string,
  treeSha: string,
) {
  if (snapshot.branch !== record.branch) {
    throw new AdminIssueWorktreeIntegrityError(
      `Worker worktree is on ${snapshot.branch || 'a detached HEAD'}, expected ${record.branch}`,
    )
  }
  if (snapshot.headSha !== headSha || snapshot.treeSha !== treeSha) {
    throw new AdminIssueWorktreeIntegrityError(
      `Worker worktree moved during validation: expected ${headSha}/${treeSha}, received ${snapshot.headSha}/${snapshot.treeSha}`,
    )
  }
  if (snapshot.status || snapshot.gitOperations.length > 0) {
    throw new AdminIssueWorktreeIntegrityError(
      'Committed candidate worktree must remain clean with no Git operation in progress',
    )
  }
}

export async function createCommittedDiffReceipt(
  record: AdminIssueRecord,
  baseSha: string,
  headSha: string,
): Promise<AdminIssueDiffReceipt> {
  if (!record.worktreePath || record.provenance.kind !== 'active') {
    throw new Error('Committed diff requires an active issue worktree')
  }
  const mergeBase = (
    await runCommand('git', ['merge-base', baseSha, headSha], { cwd: record.worktreePath })
  ).stdout.trim()
  if (mergeBase !== baseSha) {
    throw new Error(`Candidate ${headSha} does not contain target base ${baseSha}`)
  }
  const [tree, rawDiff, names] = await Promise.all([
    runCommand('git', ['rev-parse', `${headSha}^{tree}`], { cwd: record.worktreePath }),
    runCommand(
      'git',
      ['diff-tree', '--no-commit-id', '-r', '--no-renames', '--raw', '-z', baseSha, headSha, '--'],
      { cwd: record.worktreePath },
    ),
    runCommand('git', ['diff', '--name-only', '--no-renames', '-z', baseSha, headSha, '--'], {
      cwd: record.worktreePath,
    }),
  ])
  const files = names.stdout.split('\0').filter(Boolean).sort()
  assertWorkerChangesSafe(record.worktreePath, files, record)
  return {
    baseSha,
    entryCount: files.length,
    epoch: record.provenance.epoch,
    files,
    generation: record.generation,
    headSha,
    manifestSha256: createHash('sha256').update(rawDiff.stdout).digest('hex'),
    mergeBaseSha: mergeBase,
    revision: record.processedRevision,
    treeSha: tree.stdout.trim(),
  }
}

function validationCommands(files: string[]) {
  const unitTests = files.filter(
    (file) => /\.(test)\.(ts|tsx)$/.test(file) && !file.startsWith('e2e/'),
  )
  const playwrightTests = files.filter((file) => file.startsWith('e2e/') && /\.spec\.ts$/.test(file))
  return [
    { command: 'npm run test:change-policy', timeoutMs: 5 * 60_000 },
    ...(unitTests.length > 0
      ? [{
        command: `npx vitest run ${unitTests.map(shellQuote).join(' ')}`,
        timeoutMs: 15 * 60_000,
      }]
      : []),
    ...(playwrightTests.length > 0
      ? [{
        command: `npx playwright test ${playwrightTests.map(shellQuote).join(' ')}`,
        timeoutMs: 30 * 60_000,
      }]
      : []),
    ...(files.some((file) => file.startsWith('src/'))
      ? [{ command: 'npm run i18n:check', timeoutMs: 10 * 60_000 }]
      : []),
    { command: 'npm run build', timeoutMs: 20 * 60_000 },
  ]
}

const MAX_VISUAL_EVIDENCE_BYTES = 10 * 1024 * 1024

function visualEvidenceMediaType(bytes: Buffer) {
  if (
    bytes.length >= 20 &&
    bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) &&
    bytes.subarray(-8).equals(Buffer.from([0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]))
  ) {
    return 'image/png' as const
  }
  if (
    bytes.length >= 4 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff &&
    bytes.at(-2) === 0xff &&
    bytes.at(-1) === 0xd9
  ) {
    return 'image/jpeg' as const
  }
  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
    bytes.subarray(8, 12).toString('ascii') === 'WEBP' &&
    bytes.readUInt32LE(4) + 8 === bytes.length
  ) {
    return 'image/webp' as const
  }
  throw new Error('Visual evidence is not a valid PNG, JPEG, or WebP image')
}

export function collectVisualEvidenceReceipts(
  record: Pick<AdminIssueRecord, 'issueNumber' | 'worktreePath'>,
  diff: AdminIssueDiffReceipt,
  drafts: AdminIssueVisualEvidenceDraft[],
  existing: AdminIssueVisualEvidenceReceipt[] = [],
  visualChange?: AdminIssueCandidate['visualChange'],
) {
  if (!record.worktreePath) throw new Error('Worker worktree is missing')
  if (candidateRequiresVisualEvidence(diff.files, visualChange) && drafts.length === 0) {
    throw new Error(
      'Dashboard runtime changes require one to four proposed fixed-behavior images',
    )
  }
  if (drafts.length > 4) throw new Error('Visual evidence exceeds the four-image limit')
  const worktreePath = realpathSync(record.worktreePath)
  const evidenceRoot = resolve(worktreePath, 'artifacts', `admin-issue-${record.issueNumber}`)
  const hashes = new Set<string>()
  return drafts.map((draft, index) => {
    const absolutePath = resolve(worktreePath, draft.path)
    const evidenceRelativePath = relative(evidenceRoot, absolutePath)
    if (
      evidenceRelativePath === '' ||
      evidenceRelativePath === '..' ||
      evidenceRelativePath.startsWith('../')
    ) {
      throw new Error(
        `Visual evidence ${index + 1} must be below artifacts/admin-issue-${record.issueNumber}/`,
      )
    }
    const prior = existing.find((item) =>
      item.path === draft.path &&
      item.alt === draft.alt &&
      item.caption === draft.caption &&
      item.diffManifestSha256 === diff.manifestSha256,
    )
    if (!existsSync(absolutePath)) {
      if (prior?.url) {
        if (hashes.has(prior.sha256)) throw new Error('Visual evidence contains duplicate images')
        hashes.add(prior.sha256)
        return prior
      }
      throw new Error(`Visual evidence file does not exist: ${draft.path}`)
    }
    const file = lstatSync(absolutePath)
    if (file.isSymbolicLink() || !file.isFile() || realpathSync(absolutePath) !== absolutePath) {
      throw new Error(`Visual evidence must be a regular non-symlink file: ${draft.path}`)
    }
    if (file.size <= 0 || file.size > MAX_VISUAL_EVIDENCE_BYTES) {
      throw new Error(
        `Visual evidence must be between 1 byte and ${MAX_VISUAL_EVIDENCE_BYTES} bytes: ${draft.path}`,
      )
    }
    if (!/\b(?:live|mock)\b/i.test(draft.caption)) {
      throw new Error(`Visual evidence ${index + 1} caption must identify live or mock provenance`)
    }
    const bytes = readFileSync(absolutePath)
    const mediaType = visualEvidenceMediaType(bytes)
    const extension = extname(absolutePath).toLowerCase()
    const expectedExtensions =
      mediaType === 'image/png'
        ? ['.png']
        : mediaType === 'image/jpeg'
          ? ['.jpg', '.jpeg']
          : ['.webp']
    if (!expectedExtensions.includes(extension)) {
      throw new Error(`Visual evidence extension does not match its bytes: ${draft.path}`)
    }
    const sha256 = createHash('sha256').update(bytes).digest('hex')
    if (hashes.has(sha256)) throw new Error('Visual evidence contains duplicate images')
    hashes.add(sha256)
    return {
      ...draft,
      diffManifestSha256: diff.manifestSha256,
      mediaType,
      sha256,
      sizeBytes: bytes.length,
      ...(prior?.sha256 === sha256 && prior.url ? { url: prior.url } : {}),
    } satisfies AdminIssueVisualEvidenceReceipt
  })
}

async function validateAndPersistVisualEvidence(
  config: AdminIssueControllerConfig,
  state: AdminIssueControllerState,
  record: AdminIssueRecord,
  outcome: Extract<AdminIssueWorkerOutcome, { decision: 'ready_for_pr' }>,
  originalDiffManifestSha256: string,
) {
  const { candidate } = assertCandidateAuthorized(record)
  if (
    candidateRequiresVisualEvidence(candidate.diff.files, candidate.visualChange) &&
    originalDiffManifestSha256 !== candidate.diff.manifestSha256
  ) {
    throw new Error(
      'Master synchronization changed the committed diff; regenerate proposed fixed-behavior images',
    )
  }
  candidate.visualEvidence = collectVisualEvidenceReceipts(
    record,
    candidate.diff,
    outcome.visualEvidence ?? [],
    candidate.visualEvidence,
    candidate.visualChange,
  )
  assertCandidateVisualEvidence(record)
  writeState(config, state)
}

async function validateCommittedCandidate(
  config: AdminIssueControllerConfig,
  record: AdminIssueRecord,
  candidate: Pick<AdminIssueCandidate, 'diff' | 'headSha' | 'treeSha'>,
) {
  if (!record.worktreePath) throw new Error('Worker worktree is missing')
  await runCommand(
    'git',
    ['diff', '--check', candidate.diff.baseSha, candidate.headSha, '--'],
    { cwd: record.worktreePath },
  )
  const commands = validationCommands(candidate.diff.files)
  for (const command of commands) {
    assertExactCandidateSnapshot(
      await readWorktreeSnapshot(record.worktreePath),
      record,
      candidate.headSha,
      candidate.treeSha,
    )
    await runWorkspaceContainer(config, record.worktreePath, command.command, command.timeoutMs)
    assertExactCandidateSnapshot(
      await readWorktreeSnapshot(record.worktreePath),
      record,
      candidate.headSha,
      candidate.treeSha,
    )
  }
  if (record.provenance.kind !== 'active') {
    throw new Error('Validation completed without active provenance')
  }
  return {
    commands: commands.map(({ command }) => command),
    commandsSha256: createHash('sha256')
      .update(JSON.stringify(commands.map(({ command }) => command)))
      .digest('hex'),
    completedAt: now(),
    diffManifestSha256: candidate.diff.manifestSha256,
    epoch: record.provenance.epoch,
    generation: record.generation,
    headSha: candidate.headSha,
    revision: record.processedRevision,
    treeSha: candidate.treeSha,
  } satisfies AdminIssueValidationReceipt
}

async function commitWorkerChanges(
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
  const treeSha = (
    await runCommand('git', ['rev-parse', 'HEAD^{tree}'], { cwd: record.worktreePath })
  ).stdout.trim()
  return { headSha, treeSha }
}

function activeProvenance(record: AdminIssueRecord) {
  if (record.provenance.kind !== 'active') {
    throw new AdminIssueProvenanceError('Issue does not have active version-2 provenance')
  }
  return record.provenance
}

function markRecordQuarantined(
  config: AdminIssueControllerConfig,
  state: AdminIssueControllerState,
  record: AdminIssueRecord,
  reason: string,
  diagnostics = reason,
) {
  const provenance = activeProvenance(record)
  provenance.quarantine = {
    detectedAt: now(),
    diagnosticsSha256: createHash('sha256').update(diagnostics).digest('hex'),
    reason,
  }
  if (provenance.transition) provenance.transition.stage = 'quarantined'
  writeState(config, state)
}

function quarantineRecord(
  config: AdminIssueControllerConfig,
  state: AdminIssueControllerState,
  record: AdminIssueRecord,
  reason: string,
  diagnostics = reason,
) {
  markRecordQuarantined(config, state, record, reason, diagnostics)
  throw new AdminIssueProvenanceError(reason)
}

export function assertPullRequestBinding(
  repository: string,
  branch: string,
  pullRequest: GitHubPullRequest,
  candidateHeadSha: string,
) {
  classifyPullRequestHead(repository, branch, pullRequest, candidateHeadSha)
}

export function classifyPullRequestHead(
  repository: string,
  branch: string,
  pullRequest: GitHubPullRequest,
  candidateHeadSha: string,
  allowedStaleHeadSha?: string,
): 'current' | 'stale' {
  const expectedRepository = repository.toLowerCase()
  if (
    pullRequest.base.repo?.full_name.toLowerCase() !== expectedRepository ||
    pullRequest.head.repo?.full_name.toLowerCase() !== expectedRepository
  ) {
    throw new AdminIssueProvenanceError(
      `Pull request #${pullRequest.number} does not remain within ${repository}`,
    )
  }
  if (pullRequest.base.ref !== 'master') {
    throw new AdminIssueProvenanceError(
      `Pull request #${pullRequest.number} targets ${pullRequest.base.ref}, expected master`,
    )
  }
  if (pullRequest.head.ref !== branch) {
    throw new AdminIssueProvenanceError(
      `Pull request #${pullRequest.number} uses head ${pullRequest.head.ref}, expected ${branch}`,
    )
  }
  const expectedUrl = `https://github.com/${repository}/pull/${pullRequest.number}`.toLowerCase()
  if (pullRequest.html_url.toLowerCase() !== expectedUrl) {
    throw new AdminIssueProvenanceError(
      `Pull request #${pullRequest.number} URL does not belong to ${repository}`,
    )
  }
  if (pullRequest.head.sha === candidateHeadSha) return 'current'
  if (allowedStaleHeadSha && pullRequest.head.sha === allowedStaleHeadSha) return 'stale'
  throw new AdminIssueProvenanceError(
    `Pull request #${pullRequest.number} head ${pullRequest.head.sha} does not match authorized candidate ${candidateHeadSha}`,
  )
}

async function getPullRequest(
  config: AdminIssueControllerConfig,
  record: AdminIssueRecord,
  expectedCandidate?: AdminIssueCandidate,
  requireVisualEvidence = true,
) {
  if (!record.pr) throw new AdminIssueProvenanceError('Pull request is missing')
  const pullRequest = await ghApi<GitHubPullRequest>(
    config,
    'GET',
    `repos/${config.repository}/pulls/${record.pr.number}`,
  )
  if (!record.branch) throw new AdminIssueProvenanceError('Worker branch is missing')
  const candidate = expectedCandidate ?? assertCandidateAuthorized(record).candidate
  assertPullRequestBinding(config.repository, record.branch, pullRequest, candidate.headSha)
  if (
    pullRequest.number !== record.pr.number ||
    pullRequest.html_url.toLowerCase() !== record.pr.url.toLowerCase()
  ) {
    throw new AdminIssueProvenanceError('Live pull request identity does not match controller state')
  }
  if (requireVisualEvidence) {
    assertPullRequestContainsVisualEvidence(record, pullRequest, expectedCandidate)
  }
  return pullRequest
}

async function remoteBranchHead(
  config: AdminIssueControllerConfig,
  record: AdminIssueRecord,
) {
  if (!record.branch) throw new AdminIssueProvenanceError('Worker branch is missing')
  const remote = await runCommand(
    'git',
    ['ls-remote', '--heads', 'origin', `refs/heads/${record.branch}`],
    { cwd: config.repositoryPath, timeoutMs: 60_000 },
  )
  const lines = remote.stdout.split(/\r?\n/).filter(Boolean)
  if (lines.length > 1) {
    throw new AdminIssueProvenanceError(`Remote branch ${record.branch} resolved ambiguously`)
  }
  return lines[0]?.split(/\s+/)[0]
}

async function waitForPullRequestHead(
  config: AdminIssueControllerConfig,
  record: AdminIssueRecord,
  candidateHeadSha: string,
  allowedStaleHeadSha?: string,
) {
  if (!record.pr) throw new AdminIssueProvenanceError('Pull request is missing')
  if (!record.branch) throw new AdminIssueProvenanceError('Worker branch is missing')
  const deadline = Date.now() + PULL_REQUEST_HEAD_PROPAGATION_TIMEOUT_MS
  while (true) {
    const pullRequest = await ghApi<GitHubPullRequest>(
      config,
      'GET',
      `repos/${config.repository}/pulls/${record.pr.number}`,
    )
    const headState = classifyPullRequestHead(
      config.repository,
      record.branch,
      pullRequest,
      candidateHeadSha,
      allowedStaleHeadSha,
    )
    if (headState === 'current') return pullRequest
    if (Date.now() >= deadline) {
      throw new AdminIssueProvenanceError(
        `Pull request #${pullRequest.number} did not advance from ${allowedStaleHeadSha} to ${candidateHeadSha}`,
      )
    }
    await sleep(5_000)
  }
}

async function fetchMaster(
  config: AdminIssueControllerConfig,
  record: AdminIssueRecord,
) {
  if (!record.worktreePath) throw new AdminIssueProvenanceError('Worker worktree is missing')
  await runCommand('git', ['fetch', '--quiet', 'origin', 'master'], {
    cwd: record.worktreePath,
    timeoutMs: 120_000,
  })
  return (
    await runCommand('git', ['rev-parse', 'origin/master'], { cwd: record.worktreePath })
  ).stdout.trim()
}

export function shouldVerifyExistingPullRequestVisualEvidence(
  candidate: AdminIssueCandidate,
) {
  return (
    !candidateRequiresVisualEvidence(candidate.diff.files, candidate.visualChange) ||
    (candidate.visualEvidence?.length ?? 0) > 0
  )
}

export async function prepareCommittedCandidate(
  config: AdminIssueControllerConfig,
  state: AdminIssueControllerState,
  record: AdminIssueRecord,
  outcome: Extract<AdminIssueWorkerOutcome, { decision: 'ready_for_pr' }>,
) {
  if (!record.worktreePath || !record.branch) {
    throw new AdminIssueProvenanceError('Worker branch is incomplete')
  }
  const provenance = activeProvenance(record)
  if (provenance.transition || provenance.quarantine) {
    throw new AdminIssueProvenanceError('Cannot create a candidate while provenance is unresolved')
  }
  const snapshot = await readWorktreeSnapshot(record.worktreePath)
  if (snapshot.branch !== record.branch || snapshot.gitOperations.length > 0) {
    quarantineRecord(
      config,
      state,
      record,
      'Worker worktree branch or Git operation state is unexpected before commit',
      JSON.stringify(snapshot),
    )
  }
  const previousCandidate = provenance.candidate
  const expectedHead = previousCandidate?.headSha ?? provenance.preparedBaseSha
  if (snapshot.headSha !== expectedHead) {
    quarantineRecord(
      config,
      state,
      record,
      `Unjournaled local head ${snapshot.headSha}; expected ${expectedHead}`,
      JSON.stringify(snapshot),
    )
  }
  if (record.pr && previousCandidate) {
    await getPullRequest(
      config,
      record,
      previousCandidate,
      shouldVerifyExistingPullRequestVisualEvidence(previousCandidate),
    )
  }
  const files = await changedFiles(record.worktreePath)
  if (files.length === 0) {
    if (previousCandidate && snapshot.treeSha === previousCandidate.treeSha && snapshot.status === '') {
      previousCandidate.visualChange = outcome.visualChange
      if (provenance.revision === record.processedRevision) {
        writeState(config, state)
        return previousCandidate
      }
      const diff = await createCommittedDiffReceipt(
        record,
        previousCandidate.targetBaseSha,
        previousCandidate.headSha,
      )
      provenance.revision = record.processedRevision
      provenance.candidate = {
        diff,
        ...(previousCandidate.expectedRemoteHeadSha
          ? { expectedRemoteHeadSha: previousCandidate.expectedRemoteHeadSha }
          : {}),
        headSha: previousCandidate.headSha,
        targetBaseSha: previousCandidate.targetBaseSha,
        treeSha: previousCandidate.treeSha,
        visualChange: outcome.visualChange,
      }
      writeState(config, state)
      return provenance.candidate
    }
    throw new Error('Worker reported ready_for_pr but made no repository changes')
  }
  assertWorkerChangesSafe(record.worktreePath, files)
  const expectedRemoteHeadSha = previousCandidate?.headSha
  const targetBaseSha = previousCandidate?.targetBaseSha ?? provenance.preparedBaseSha
  const committed = await commitWorkerChanges(record, outcome)
  const commitLine = (
    await runCommand('git', ['rev-list', '--parents', '-n', '1', committed.headSha], {
      cwd: record.worktreePath,
    })
  ).stdout.trim().split(/\s+/)
  if (
    commitLine.length !== 2 ||
    commitLine[0] !== committed.headSha ||
    commitLine[1] !== expectedHead
  ) {
    quarantineRecord(
      config,
      state,
      record,
      `Committed candidate ${committed.headSha} does not descend directly from expected head ${expectedHead}`,
    )
  }
  provenance.revision = record.processedRevision
  provenance.transition = undefined
  provenance.merge = undefined
  provenance.deployment = undefined
  provenance.quarantine = undefined
  let diff: AdminIssueDiffReceipt | undefined
  try {
    diff = await createCommittedDiffReceipt(record, targetBaseSha, committed.headSha)
  } catch (error) {
    quarantineRecord(
      config,
      state,
      record,
      `Committed candidate could not be authorized: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
  if (!diff) throw new AdminIssueProvenanceError('Committed candidate diff was not created')
  provenance.candidate = {
    diff,
    ...(expectedRemoteHeadSha ? { expectedRemoteHeadSha } : {}),
    headSha: committed.headSha,
    targetBaseSha,
    treeSha: committed.treeSha,
    visualChange: outcome.visualChange,
  }
  writeState(config, state)
  return provenance.candidate
}

async function validateAndPersistCandidate(
  config: AdminIssueControllerConfig,
  state: AdminIssueControllerState,
  record: AdminIssueRecord,
) {
  const provenance = activeProvenance(record)
  const candidate = provenance.candidate
  if (!candidate) throw new AdminIssueProvenanceError('Committed candidate is missing')
  candidate.validation = await validateCommittedCandidate(config, record, candidate)
  candidate.checks = undefined
  provenance.merge = undefined
  provenance.deployment = undefined
  record.receipts.validatedAt = candidate.validation.completedAt
  delete record.receipts.checksPassedAt
  delete record.receipts.mergedAt
  delete record.receipts.deployedAt
  delete record.receipts.deploymentRunUrl
  writeState(config, state)
  return candidate
}

async function pushCandidate(
  config: AdminIssueControllerConfig,
  state: AdminIssueControllerState,
  record: AdminIssueRecord,
) {
  if (!record.worktreePath || !record.branch) {
    throw new AdminIssueProvenanceError('Worker branch is incomplete')
  }
  const { candidate } = assertCandidateAuthorized(record)
  assertExactCandidateSnapshot(
    await readWorktreeSnapshot(record.worktreePath),
    record,
    candidate.headSha,
    candidate.treeSha,
  )
  const remoteBefore = await remoteBranchHead(config, record)
  if (remoteBefore === candidate.headSha) return
  if (remoteBefore !== candidate.expectedRemoteHeadSha) {
    quarantineRecord(
      config,
      state,
      record,
      `Remote branch ${record.branch} is ${remoteBefore ?? 'absent'}, expected ${candidate.expectedRemoteHeadSha ?? 'absent'}`,
    )
  }
  const push = await runCommand(
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
      allowFailure: true,
      cwd: record.worktreePath,
      timeoutMs: 5 * 60_000,
    },
  )
  const remoteAfter = await remoteBranchHead(config, record)
  if (push.exitCode !== 0 && remoteAfter !== candidate.headSha) {
    quarantineRecord(
      config,
      state,
      record,
      'Candidate push was rejected and the remote did not confirm the intended head',
      `${push.stdout}\n${push.stderr}`,
    )
  }
  if (remoteAfter !== candidate.headSha) {
    quarantineRecord(
      config,
      state,
      record,
      `Remote branch ${record.branch} did not confirm candidate ${candidate.headSha}`,
    )
  }
}

async function handleBaseSyncConflict(
  config: AdminIssueControllerConfig,
  state: AdminIssueControllerState,
  record: AdminIssueRecord,
  mergeOutput: string,
) {
  if (!record.worktreePath) throw new AdminIssueProvenanceError('Worker worktree is missing')
  const provenance = activeProvenance(record)
  const transition = provenance.transition
  if (!transition) throw new AdminIssueProvenanceError('Base-sync transition is missing')
  const [status, unmerged] = await Promise.all([
    runCommand('git', ['status', '--porcelain=v2', '-z', '--untracked-files=all'], {
      allowFailure: true,
      cwd: record.worktreePath,
    }),
    runCommand('git', ['diff', '--name-only', '--diff-filter=U', '-z', '--'], {
      allowFailure: true,
      cwd: record.worktreePath,
    }),
  ])
  transition.stage = 'conflict-observed'
  transition.diagnostics = {
    outputSha256: createHash('sha256').update(mergeOutput).digest('hex'),
    outputTail: truncate(mergeOutput, 12_000),
    statusSha256: createHash('sha256').update(status.stdout).digest('hex'),
    unmergedPaths: unmerged.stdout.split('\0').filter(Boolean).sort(),
  }
  writeState(config, state)

  const snapshot = await readWorktreeSnapshot(record.worktreePath)
  if (!snapshot.gitOperations.includes('MERGE_HEAD')) {
    quarantineRecord(
      config,
      state,
      record,
      'Base synchronization failed without a recoverable merge operation',
      JSON.stringify({ mergeOutput, snapshot }),
    )
  }
  const abort = await runCommand('git', ['merge', '--abort'], {
    allowFailure: true,
    cwd: record.worktreePath,
  })
  if (abort.exitCode !== 0) {
    quarantineRecord(
      config,
      state,
      record,
      'Base synchronization conflict could not be aborted safely',
      `${mergeOutput}\n${abort.stdout}\n${abort.stderr}`,
    )
  }
  const restored = await readWorktreeSnapshot(record.worktreePath)
  if (
    restored.branch !== record.branch ||
    restored.headSha !== transition.fromHeadSha ||
    restored.treeSha !== transition.fromTreeSha ||
    restored.status ||
    restored.gitOperations.length > 0
  ) {
    quarantineRecord(
      config,
      state,
      record,
      'Base synchronization abort did not restore the exact prior candidate',
      JSON.stringify(restored),
    )
  }
  transition.stage = 'aborted'
  transition.restoration = {
    clean: true,
    headSha: restored.headSha,
    noGitOperationInProgress: true,
    treeSha: restored.treeSha,
    verifiedAt: now(),
  }
  writeState(config, state)
  throw new AdminIssueProvenanceError(
    `Base synchronization conflicted with ${transition.targetBaseSha}; the prior candidate was restored and the generation was blocked`,
  )
}

function assertTransitionTarget(
  record: AdminIssueRecord,
  transition: NonNullable<
    Extract<AdminIssueRecord['provenance'], { kind: 'active' }>['transition']
  >,
  snapshot: AdminIssueWorktreeSnapshot,
) {
  if (!record.branch || snapshot.branch !== record.branch) {
    throw new AdminIssueProvenanceError('Base-sync worktree is on the wrong branch')
  }
  if (
    !transition.toHeadSha ||
    !transition.toTreeSha ||
    snapshot.headSha !== transition.toHeadSha ||
    snapshot.treeSha !== transition.toTreeSha ||
    snapshot.status ||
    snapshot.gitOperations.length > 0
  ) {
    throw new AdminIssueProvenanceError('Base-sync target does not match the persisted transition')
  }
}

async function verifyBaseSyncParents(
  record: AdminIssueRecord,
  headSha: string,
  fromHeadSha: string,
  targetBaseSha: string,
) {
  if (!record.worktreePath) throw new AdminIssueProvenanceError('Worker worktree is missing')
  const parents = (
    await runCommand('git', ['rev-list', '--parents', '-n', '1', headSha], {
      cwd: record.worktreePath,
    })
  ).stdout.trim().split(/\s+/)
  if (
    parents.length !== 3 ||
    parents[0] !== headSha ||
    parents[1] !== fromHeadSha ||
    parents[2] !== targetBaseSha
  ) {
    throw new AdminIssueProvenanceError(
      `Base-sync commit ${headSha} does not have the expected ordered parents`,
    )
  }
}

export async function synchronizeCandidateBase(
  config: AdminIssueControllerConfig,
  state: AdminIssueControllerState,
  record: AdminIssueRecord,
  requestedBaseSha?: string,
  validationRunner = validateCommittedCandidate,
) {
  if (!record.worktreePath || !record.branch) {
    throw new AdminIssueProvenanceError('Worker branch is incomplete')
  }
  const provenance = activeProvenance(record)
  if (provenance.quarantine) {
    throw new AdminIssueProvenanceError(`Issue provenance is quarantined: ${provenance.quarantine.reason}`)
  }
  let transition = provenance.transition
  if (!transition) {
    const { candidate } = assertCandidateAuthorized(record)
    const targetBaseSha = requestedBaseSha ?? await fetchMaster(config, record)
    if (targetBaseSha === candidate.targetBaseSha) return false
    if (provenance.resyncAttempts >= MAX_BASE_RESYNCS_PER_GENERATION) {
      throw new AdminIssueProvenanceError(
        `Master advanced more than ${MAX_BASE_RESYNCS_PER_GENERATION} times during generation ${record.generation}`,
      )
    }
    const baseAdvance = await runCommand(
      'git',
      ['merge-base', '--is-ancestor', candidate.targetBaseSha, targetBaseSha],
      { allowFailure: true, cwd: record.worktreePath },
    )
    if (baseAdvance.exitCode !== 0) {
      throw new AdminIssueProvenanceError(
        `New target base ${targetBaseSha} does not descend from ${candidate.targetBaseSha}`,
      )
    }
    assertExactCandidateSnapshot(
      await readWorktreeSnapshot(record.worktreePath),
      record,
      candidate.headSha,
      candidate.treeSha,
    )
    const remoteHead = await remoteBranchHead(config, record)
    const allowedRemoteHeads = new Set(
      [candidate.headSha, candidate.expectedRemoteHeadSha].filter(
        (value): value is string => Boolean(value),
      ),
    )
    if (remoteHead && !allowedRemoteHeads.has(remoteHead)) {
      quarantineRecord(
        config,
        state,
        record,
        `Remote branch ${record.branch} changed unexpectedly to ${remoteHead}`,
      )
    }
    if (record.pr) {
      const pullRequest = await ghApi<GitHubPullRequest>(
        config,
        'GET',
        `repos/${config.repository}/pulls/${record.pr.number}`,
      )
      if (!remoteHead) {
        quarantineRecord(config, state, record, 'Pull request exists without a remote branch head')
      }
      assertPullRequestBinding(config.repository, record.branch, pullRequest, remoteHead)
    }
    provenance.resyncAttempts += 1
    candidate.checks = undefined
    provenance.merge = undefined
    provenance.deployment = undefined
    transition = {
      attempt: provenance.resyncAttempts,
      epoch: provenance.epoch,
      ...(remoteHead ? { expectedRemoteHeadSha: remoteHead } : {}),
      fromBaseSha: candidate.targetBaseSha,
      fromHeadSha: candidate.headSha,
      fromTreeSha: candidate.treeSha,
      generation: record.generation,
      id: randomUUID(),
      revision: record.processedRevision,
      stage: 'intent',
      startedAt: now(),
      targetBaseSha,
    }
    provenance.transition = transition
    delete record.receipts.checksPassedAt
    delete record.receipts.mergedAt
    delete record.receipts.deployedAt
    delete record.receipts.deploymentRunUrl
    writeState(config, state)
  } else if (requestedBaseSha && transition.targetBaseSha !== requestedBaseSha) {
    throw new AdminIssueProvenanceError('Cannot change the target base of an in-flight transition')
  }

  if (['aborted', 'failed', 'quarantined'].includes(transition.stage)) {
    throw new AdminIssueProvenanceError(
      `Base synchronization cannot continue from ${transition.stage}`,
    )
  }

  if (transition.stage === 'intent' || transition.stage === 'conflict-observed') {
    const before = await readWorktreeSnapshot(record.worktreePath)
    if (before.gitOperations.length > 0) {
      await handleBaseSyncConflict(config, state, record, 'Recovered an in-progress base merge')
    }
    if (
      before.branch !== record.branch ||
      before.headSha !== transition.fromHeadSha ||
      before.treeSha !== transition.fromTreeSha ||
      before.status
    ) {
      quarantineRecord(
        config,
        state,
        record,
        'Local head changed after base-sync intent but before the target SHA was persisted',
        JSON.stringify(before),
      )
    }
    const merge = await runCommand(
      'git',
      [
        '-c',
        'core.hooksPath=/dev/null',
        'merge',
        '--no-ff',
        '--no-edit',
        transition.targetBaseSha,
      ],
      { allowFailure: true, cwd: record.worktreePath, timeoutMs: 5 * 60_000 },
    )
    if (merge.exitCode !== 0) {
      await handleBaseSyncConflict(
        config,
        state,
        record,
        `${merge.stdout}\n${merge.stderr}`,
      )
    }
    const created = await readWorktreeSnapshot(record.worktreePath)
    if (created.status || created.gitOperations.length > 0) {
      quarantineRecord(
        config,
        state,
        record,
        'Base synchronization produced a dirty or incomplete Git state',
        JSON.stringify(created),
      )
    }
    await verifyBaseSyncParents(
      record,
      created.headSha,
      transition.fromHeadSha,
      transition.targetBaseSha,
    )
    transition.toHeadSha = created.headSha
    transition.toTreeSha = created.treeSha
    transition.stage = 'local-created'
    writeState(config, state)
  }

  const targetSnapshot = await readWorktreeSnapshot(record.worktreePath)
  try {
    assertTransitionTarget(record, transition, targetSnapshot)
    await verifyBaseSyncParents(
      record,
      targetSnapshot.headSha,
      transition.fromHeadSha,
      transition.targetBaseSha,
    )
  } catch (error) {
    quarantineRecord(
      config,
      state,
      record,
      error instanceof Error ? error.message : String(error),
      JSON.stringify(targetSnapshot),
    )
  }

  if (transition.stage === 'local-created') {
    let diff: AdminIssueDiffReceipt
    let validation: AdminIssueValidationReceipt
    try {
      diff = await createCommittedDiffReceipt(
        record,
        transition.targetBaseSha,
        transition.toHeadSha as string,
      )
      validation = await validationRunner(config, record, {
        diff,
        headSha: transition.toHeadSha as string,
        treeSha: transition.toTreeSha as string,
      })
    } catch (error) {
      transition.stage = 'failed'
      transition.diagnostics = {
        outputSha256: createHash('sha256')
          .update(error instanceof Error ? error.message : String(error))
          .digest('hex'),
        outputTail: truncate(error instanceof Error ? error.message : String(error), 12_000),
        statusSha256: createHash('sha256').update(targetSnapshot.status).digest('hex'),
        unmergedPaths: [],
      }
      writeState(config, state)
      throw new AdminIssueProvenanceError(
        `Synchronized candidate failed exact diff authorization or validation: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
    transition.provisionalDiff = diff
    transition.provisionalValidation = validation
    transition.stage = 'validated'
    writeState(config, state)
  }

  if (transition.stage === 'validated') {
    if (!transition.toHeadSha || !transition.provisionalDiff || !transition.provisionalValidation) {
      quarantineRecord(config, state, record, 'Validated base-sync transition is incomplete')
    }
    const remoteBefore = await remoteBranchHead(config, record)
    if (remoteBefore !== transition.toHeadSha) {
      if (remoteBefore !== transition.expectedRemoteHeadSha) {
        quarantineRecord(
          config,
          state,
          record,
          `Remote branch changed during base synchronization to ${remoteBefore ?? 'absent'}`,
        )
      }
      const push = await runCommand(
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
          allowFailure: true,
          cwd: record.worktreePath,
          timeoutMs: 5 * 60_000,
        },
      )
      if (push.exitCode !== 0) {
        const observedRemote = await remoteBranchHead(config, record)
        if (observedRemote !== transition.toHeadSha) {
          quarantineRecord(
            config,
            state,
            record,
            'Base-sync push was rejected and the remote did not confirm the intended target',
            `${push.stdout}\n${push.stderr}`,
          )
        }
      }
    }
    transition.stage = 'pushed'
    writeState(config, state)
  }

  if (transition.stage === 'pushed') {
    if (!transition.toHeadSha) {
      quarantineRecord(config, state, record, 'Pushed base-sync transition is missing its head')
    }
    const remoteHeadSha = await remoteBranchHead(config, record)
    if (remoteHeadSha !== transition.toHeadSha) {
      quarantineRecord(config, state, record, 'Remote branch no longer matches the base-sync target')
    }
    let prHeadSha: string | undefined
    let prNumber: number | undefined
    if (record.pr) {
      const pullRequest = await waitForPullRequestHead(
        config,
        record,
        transition.toHeadSha,
        transition.expectedRemoteHeadSha,
      )
      prHeadSha = pullRequest.head.sha
      prNumber = pullRequest.number
    }
    transition.confirmation = {
      localHeadSha: transition.toHeadSha,
      observedAt: now(),
      ...(prHeadSha ? { prHeadSha } : {}),
      ...(prNumber ? { prNumber } : {}),
      remoteHeadSha,
    }
    transition.stage = 'confirmed'
    writeState(config, state)
  }

  if (transition.stage === 'confirmed') {
    if (
      !transition.toHeadSha ||
      !transition.toTreeSha ||
      !transition.provisionalDiff ||
      !transition.provisionalValidation ||
      transition.confirmation?.localHeadSha !== transition.toHeadSha ||
      transition.confirmation.remoteHeadSha !== transition.toHeadSha
    ) {
      quarantineRecord(config, state, record, 'Confirmed base-sync transition is incomplete')
    }
    assertTransitionTarget(
      record,
      transition,
      await readWorktreeSnapshot(record.worktreePath),
    )
    if (await remoteBranchHead(config, record) !== transition.toHeadSha) {
      quarantineRecord(config, state, record, 'Remote branch drifted before transition promotion')
    }
    if (record.pr) {
      const pullRequest = await ghApi<GitHubPullRequest>(
        config,
        'GET',
        `repos/${config.repository}/pulls/${record.pr.number}`,
      )
      assertPullRequestBinding(
        config.repository,
        record.branch,
        pullRequest,
        transition.toHeadSha,
      )
    }
    const previousVisualEvidence = provenance.candidate?.visualEvidence
    const previousVisualChange = provenance.candidate?.visualChange
    provenance.candidate = {
      diff: transition.provisionalDiff,
      ...(transition.expectedRemoteHeadSha
        ? { expectedRemoteHeadSha: transition.expectedRemoteHeadSha }
        : {}),
      headSha: transition.toHeadSha,
      targetBaseSha: transition.targetBaseSha,
      treeSha: transition.toTreeSha,
      validation: transition.provisionalValidation,
      ...(previousVisualChange
        ? { visualChange: previousVisualChange }
        : {}),
      ...(previousVisualEvidence?.every(
        (item) => item.diffManifestSha256 === transition.provisionalDiff?.manifestSha256,
      )
        ? { visualEvidence: previousVisualEvidence }
        : {}),
    }
    provenance.transition = undefined
    provenance.merge = undefined
    provenance.deployment = undefined
    record.receipts.validatedAt = transition.provisionalValidation.completedAt
    delete record.receipts.checksPassedAt
    delete record.receipts.mergedAt
    delete record.receipts.deployedAt
    delete record.receipts.deploymentRunUrl
    writeState(config, state)
  }
  return true
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

export function pullRequestBodyWithVisualEvidence(
  body: string,
  evidence: AdminIssueVisualEvidenceReceipt[],
) {
  const startMarker = '<!-- admin-issue-visual-evidence:start -->'
  const endMarker = '<!-- admin-issue-visual-evidence:end -->'
  const withoutPrevious = body
    .replace(/<!-- admin-issue-visual-evidence:start -->[\s\S]*?<!-- admin-issue-visual-evidence:end -->/g, '')
    .trim()
  if (evidence.length === 0) return withoutPrevious
  return [
    withoutPrevious,
    startMarker,
    formatVisualEvidenceMarkdown(evidence),
    endMarker,
  ].filter(Boolean).join('\n\n')
}

export function assertPullRequestContainsVisualEvidence(
  record: AdminIssueRecord,
  pullRequest: Pick<GitHubPullRequest, 'body'>,
  expectedCandidate?: AdminIssueCandidate,
) {
  const evidence = expectedCandidate
    ? assertVisualEvidenceForCandidate(expectedCandidate, true)
    : assertCandidateVisualEvidence(record, true).evidence
  const body = pullRequest.body ?? ''
  const start = body.indexOf('<!-- admin-issue-visual-evidence:start -->')
  const end = body.indexOf('<!-- admin-issue-visual-evidence:end -->', start + 1)
  if (evidence.length > 0 && (start < 0 || end < 0 || end <= start)) {
    throw new AdminIssueProvenanceError(
      'Pull request body is missing the proposed fixed-behavior section',
    )
  }
  const evidenceSection = start >= 0 && end > start ? body.slice(start, end) : ''
  assertRenderedVisualEvidence(evidenceSection, evidence, 'Pull request body')
}

function assertRenderedVisualEvidence(
  body: string,
  evidence: readonly AdminIssueVisualEvidenceReceipt[],
  surface: string,
) {
  for (const item of evidence) {
    const target = `](${item.url})`
    const targetIndex = body.indexOf(target)
    const lineStart = body.lastIndexOf('\n', targetIndex) + 1
    if (
      !item.url ||
      targetIndex < 0 ||
      !body.slice(lineStart, targetIndex).startsWith('![')
    ) {
      throw new AdminIssueProvenanceError(
        `${surface} is missing proposed fixed-behavior image ${item.path}`,
      )
    }
  }
}

export function assertIssueCommentBodyContainsVisualEvidence(
  record: AdminIssueRecord,
  body: string | null | undefined,
) {
  const { evidence } = assertCandidateVisualEvidence(record, true)
  if (evidence.length === 0) return
  const commentBody = body ?? ''
  const heading = commentBody.indexOf('## Proposed fixed behavior')
  if (heading < 0) {
    throw new AdminIssueProvenanceError(
      'GitHub issue update is missing the proposed fixed-behavior section',
    )
  }
  assertRenderedVisualEvidence(
    commentBody.slice(heading),
    evidence,
    'GitHub issue update',
  )
}

async function verifyIssueVisualEvidenceComment(
  config: AdminIssueControllerConfig,
  record: AdminIssueRecord,
) {
  const { evidence } = assertCandidateVisualEvidence(record, true)
  if (evidence.length === 0) return
  const marker = controllerReceiptMarker(record.uid, `pr-r${record.processedRevision}`)
  const comments = await listIssueComments(config, record.issueNumber)
  const comment = comments.find((entry) => entry.body?.includes(marker))
  if (!comment) {
    throw new AdminIssueProvenanceError(
      'GitHub issue is missing its pull-request evidence update',
    )
  }
  assertIssueCommentBodyContainsVisualEvidence(record, comment.body)
}

async function publishCandidateVisualEvidence(
  config: AdminIssueControllerConfig,
  state: AdminIssueControllerState,
  record: AdminIssueRecord,
) {
  const { candidate } = assertCandidateAuthorized(record)
  const evidence = candidate.visualEvidence ?? []
  if (evidence.every((item) => item.url)) {
    assertCandidateVisualEvidence(record, true)
    return
  }
  const githubToken = (
    await runCommand('gh', ['auth', 'token'], {
      cwd: config.repositoryPath,
      timeoutMs: 30_000,
    })
  ).stdout.trim()
  if (!githubToken) throw new Error('gh auth token returned an empty token')
  for (const item of evidence) {
    if (item.url) continue
    const [verified] = collectVisualEvidenceReceipts(
      record,
      candidate.diff,
      [{ alt: item.alt, caption: item.caption, path: item.path }],
      [item],
    )
    if (
      verified.sha256 !== item.sha256 ||
      verified.sizeBytes !== item.sizeBytes ||
      verified.mediaType !== item.mediaType
    ) {
      throw new AdminIssueProvenanceError(
        `Visual evidence changed after validation: ${item.path}`,
      )
    }
    if (!record.worktreePath) throw new Error('Worker worktree is missing')
    item.url = await uploadGitHubUserAttachment(
      config,
      githubToken,
      readFileSync(resolve(realpathSync(record.worktreePath), item.path)),
      basename(item.path),
      item.mediaType,
    )
    writeState(config, state)
  }
  assertCandidateVisualEvidence(record, true)
}

async function uploadGitHubUserAttachment(
  config: Pick<AdminIssueControllerConfig, 'repositoryId'>,
  githubToken: string,
  bytes: Uint8Array,
  name: string,
  mediaType: AdminIssueInputAttachment['mediaType'],
) {
  const uploadUrl = new URL('https://uploads.github.com/user-attachments/assets')
  uploadUrl.searchParams.set('name', name)
  uploadUrl.searchParams.set('content_type', mediaType)
  uploadUrl.searchParams.set('repository_id', String(config.repositoryId))
  const response = await fetch(uploadUrl, {
    body: bytes,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${githubToken}`,
      'Content-Type': 'application/octet-stream',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    method: 'POST',
  })
  const responseBody = await response.text()
  if (!response.ok) {
    throw new Error(
      `GitHub user-attachment upload failed with ${response.status}: ${truncate(responseBody, 2_000)}`,
    )
  }
  const uploaded = JSON.parse(responseBody) as { url?: unknown }
  if (
    typeof uploaded.url !== 'string' ||
    !/^https:\/\/github\.com\/user-attachments\/assets\/[A-Za-z0-9-]+$/.test(uploaded.url)
  ) {
    throw new Error('GitHub user-attachment upload returned an invalid attachment URL')
  }
  return uploaded.url
}

async function createOrUpdatePullRequest(
  config: AdminIssueControllerConfig,
  record: AdminIssueRecord,
  outcome: Extract<AdminIssueWorkerOutcome, { decision: 'ready_for_pr' }>,
) {
  if (!record.branch) throw new Error('Worker branch is missing')
  const { candidate } = assertCandidateAuthorized(record)
  if (await remoteBranchHead(config, record) !== candidate.headSha) {
    throw new AdminIssueProvenanceError('Remote branch does not match the authorized candidate')
  }
  const { evidence } = assertCandidateVisualEvidence(record, true)
  const proposedBody = pullRequestBodyWithVisualEvidence(outcome.pr.body.trim(), evidence)
  const body = `${neutralizeGitHubClosingReferences(proposedBody)}\n\nTracked issue: #${record.issueNumber}\n\n<!-- admin-issue-controller:pr -->`
  if (Buffer.byteLength(body) > MAX_GITHUB_BODY_BYTES) {
    throw new Error(`Pull request body exceeds ${MAX_GITHUB_BODY_BYTES} bytes`)
  }
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
  assertPullRequestBinding(config.repository, record.branch, pullRequest, candidate.headSha)
  assertPullRequestContainsVisualEvidence(record, pullRequest)
  record.pr = {
    number: pullRequest.number,
    url: pullRequest.html_url,
  }
  record.phase = 'pull-request'
  record.receipts.prOpenedAt ??= now()
  const issueComment = await postIssueCommentOnce(
    config,
    record.issueNumber,
    record.uid,
    `pr-r${record.processedRevision}`,
    formatPullRequestComment(
      record.uid,
      record.processedRevision,
      record.pr,
      outcome,
      evidence,
    ),
  )
  assertIssueCommentBodyContainsVisualEvidence(record, issueComment.body)
  return pullRequest
}

export function summarizeFailedCheckLogs(raw: string) {
  const ansiEscapePattern = new RegExp(
    `${String.fromCodePoint(27)}\\[[0-?]*[ -/]*[@-~]`,
    'g',
  )
  const normalized = raw
    .replace(ansiEscapePattern, '')
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean)
  const signal = normalized.filter((line) =>
    /\b(?:fail(?:ed|ure)?|error|assertion|expected|received|timeout|timed out|test files?|tests?)\b|[×✕]/i
      .test(line),
  )
  const tail = normalized.slice(-160)
  const selected = [...new Set([...signal.slice(-120), ...tail])]
  return truncate(selected.join('\n'), 30_000)
}

async function rerunFailedWorkflow(
  config: AdminIssueControllerConfig,
  runId: number,
) {
  const result = await runCommand(
    'gh',
    ['run', 'rerun', String(runId), '--failed', '--repo', config.repository],
    {
      allowFailure: true,
      cwd: config.repositoryPath,
      maxOutputBytes: 100_000,
      timeoutMs: 120_000,
    },
  )
  if (result.exitCode !== 0) {
    throw new Error(
      `Failed-check rerun could not be requested for workflow run ${runId}: ${truncate(
        `${result.stdout}\n${result.stderr}`,
        5_000,
      )}`,
    )
  }
}

async function waitForRequiredChecks(
  config: AdminIssueControllerConfig,
  record: AdminIssueRecord,
  refreshInputs: () => Promise<boolean>,
) {
  if (!record.pr) throw new Error('Pull request is missing')
  const { candidate, provenance } = assertCandidateAuthorized(record)
  await verifyIssueVisualEvidenceComment(config, record)
  const deadline = Date.now() + config.deploymentTimeoutMinutes * 60_000
  while (Date.now() < deadline) {
    await getPullRequest(config, record)
    const currentBaseSha = await fetchMaster(config, record)
    if (currentBaseSha !== candidate.targetBaseSha) {
      return { baseAdvancedTo: currentBaseSha }
    }
    const response = await ghApi<{ check_runs: CheckRun[] }>(
      config,
      'GET',
      `repos/${config.repository}/commits/${candidate.headSha}/check-runs?per_page=100`,
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
          const workflowRun = await ghApi<WorkflowRun>(
            config,
            'GET',
            `repos/${config.repository}/actions/runs/${runId}`,
          )
          if (workflowRun.status !== 'completed') {
            await sleep(config.deploymentPollSeconds * 1000)
            if (!(await refreshInputs())) return { interrupted: true as const }
            continue
          }
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
          logs = summarizeFailedCheckLogs(
            `${logs}\n\n${result.stdout}\n${result.stderr}`,
          )
        }
        const failureFingerprint = createHash('sha256')
          .update(`${candidate.headSha}\0${failed.name}\0${failed.id}\0${logs}`)
          .digest('hex')
        const rerunKey = createHash('sha256')
          .update(`${candidate.headSha}\0${failed.name}`)
          .digest('hex')
        return {
          failureFingerprint,
          logs,
          rerunKey,
          runId: runId ? Number(runId) : undefined,
          success: false as const,
        }
      }

      if (
        required.every(
          (check) =>
            check?.status === 'completed' &&
            check.conclusion === 'success' &&
            Boolean(check.completed_at),
        )
      ) {
        if (!(await refreshInputs())) return { interrupted: true as const }
        await getPullRequest(config, record)
        await verifyIssueVisualEvidenceComment(config, record)
        const verifiedBaseSha = await fetchMaster(config, record)
        if (verifiedBaseSha !== candidate.targetBaseSha) {
          return { baseAdvancedTo: verifiedBaseSha }
        }
        return {
          receipt: {
            epoch: provenance.epoch,
            generation: record.generation,
            headSha: candidate.headSha,
            observedAt: now(),
            requiredSetSha256: createHash('sha256')
              .update(JSON.stringify(config.requiredChecks))
              .digest('hex'),
            revision: record.processedRevision,
            runs: required.map((check) => ({
              appId: check?.app.id as number,
              checkRunId: check?.id as number,
              completedAt: check?.completed_at as string,
              conclusion: 'success' as const,
              name: check?.name as string,
            })),
          } satisfies AdminIssueChecksReceipt,
          success: true as const,
        }
      }
    }
    await sleep(config.deploymentPollSeconds * 1000)
    if (!(await refreshInputs())) return { interrupted: true as const }
  }
  throw new Error(`Required checks did not finish within ${config.deploymentTimeoutMinutes} minutes`)
}

async function assertRequiredChecksCurrent(
  config: AdminIssueControllerConfig,
  candidate: AdminIssueCandidate,
) {
  const receipt = candidate.checks
  if (!receipt) throw new AdminIssueProvenanceError('Required-check receipt is missing')
  const requiredSetSha256 = createHash('sha256')
    .update(JSON.stringify(config.requiredChecks))
    .digest('hex')
  if (
    receipt.requiredSetSha256 !== requiredSetSha256 ||
    receipt.runs.length !== config.requiredChecks.length
  ) {
    throw new AdminIssueProvenanceError('Required-check receipt does not match controller policy')
  }
  const response = await ghApi<{ check_runs: CheckRun[] }>(
    config,
    'GET',
    `repos/${config.repository}/commits/${candidate.headSha}/check-runs?per_page=100`,
  )
  const latestByName = new Map<string, CheckRun>()
  for (const check of response.check_runs.sort((left, right) => left.id - right.id)) {
    if (check.app.id === config.requiredCheckAppId) latestByName.set(check.name, check)
  }
  for (const expected of receipt.runs) {
    const current = latestByName.get(expected.name)
    if (
      !current ||
      current.id !== expected.checkRunId ||
      current.app.id !== expected.appId ||
      current.status !== 'completed' ||
      current.conclusion !== 'success' ||
      current.completed_at !== expected.completedAt
    ) {
      throw new AdminIssueProvenanceError(
        `Required check ${expected.name} no longer matches the persisted receipt for ${candidate.headSha}`,
      )
    }
  }
}

export async function waitForMergedPullRequest(
  readPullRequest: () => Promise<GitHubPullRequest>,
  attempts = 10,
  waitForNextAttempt: (milliseconds: number) => Promise<unknown> = sleep,
) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const pullRequest = await readPullRequest()
    if (pullRequest.merged_at && pullRequest.merge_commit_sha) return pullRequest
    if (attempt < attempts) await waitForNextAttempt(2_000)
  }
  return undefined
}

export function findExactMergeCommit(
  revisionList: string,
  baseSha: string,
  candidateHeadSha: string,
) {
  for (const line of revisionList.split(/\r?\n/)) {
    const [commitSha, ...parents] = line.trim().split(/\s+/)
    if (commitSha && parents.length === 2 && parents[0] === baseSha && parents[1] === candidateHeadSha) {
      return commitSha
    }
  }
  return undefined
}

async function exactMergeCommitOnMaster(
  record: AdminIssueRecord,
  baseSha: string,
  candidateHeadSha: string,
) {
  if (!record.worktreePath) throw new AdminIssueProvenanceError('Worker worktree is missing')
  const revisionList = await runCommand(
    'git',
    [
      'rev-list',
      '--first-parent',
      '--parents',
      '--max-count=100',
      'origin/master',
      `^${baseSha}`,
    ],
    { cwd: record.worktreePath },
  )
  return findExactMergeCommit(revisionList.stdout, baseSha, candidateHeadSha)
}

async function mergePullRequest(
  config: AdminIssueControllerConfig,
  record: AdminIssueRecord,
) {
  if (!record.pr) throw new Error('Pull request is missing')
  const { candidate, provenance } = assertCandidateAuthorized(record, true)
  let merged = await getPullRequest(config, record)
  await verifyIssueVisualEvidenceComment(config, record)
  await assertRequiredChecksCurrent(config, candidate)
  if (!merged.merged_at) {
    const currentBaseSha = await fetchMaster(config, record)
    if (currentBaseSha !== candidate.targetBaseSha) {
      return { baseAdvancedTo: currentBaseSha }
    }
    const merge = await runCommand(
      'gh',
      [
        'pr',
        'merge',
        String(record.pr.number),
        '--repo',
        config.repository,
        '--merge',
        '--match-head-commit',
        candidate.headSha,
      ],
      {
        allowFailure: true,
        cwd: config.repositoryPath,
        timeoutMs: 5 * 60_000,
      },
    )
    const observedPullRequest = await waitForMergedPullRequest(
      () => getPullRequest(config, record),
    )
    if (observedPullRequest) {
      merged = observedPullRequest
    } else {
      const advancedBaseSha = await fetchMaster(config, record)
      if (advancedBaseSha !== candidate.targetBaseSha) {
        if (
          await exactMergeCommitOnMaster(
            record,
            candidate.targetBaseSha,
            candidate.headSha,
          )
        ) {
          return { interrupted: true as const }
        }
        if (merge.exitCode === 0) return { interrupted: true as const }
        return { baseAdvancedTo: advancedBaseSha }
      }
      if (merge.exitCode === 0) return { interrupted: true as const }
      throw new Error(`Protected merge failed for #${record.pr.number}\n${merge.stdout}\n${merge.stderr}`)
    }
  }
  if (!merged.merged_at || !merged.merge_commit_sha) {
    const observedPullRequest = await waitForMergedPullRequest(
      () => getPullRequest(config, record),
    )
    if (!observedPullRequest) return { interrupted: true as const }
    merged = observedPullRequest
  }
  const mergeCommit = await ghApi<GitHubCommit>(
    config,
    'GET',
    `repos/${config.repository}/git/commits/${merged.merge_commit_sha}`,
  )
  if (
    mergeCommit.sha !== merged.merge_commit_sha ||
    mergeCommit.parents.length !== 2 ||
    mergeCommit.parents[0]?.sha !== candidate.targetBaseSha ||
    mergeCommit.parents[1]?.sha !== candidate.headSha
  ) {
    throw new AdminIssueProvenanceError(
      `Merge commit ${merged.merge_commit_sha} does not bind exact base ${candidate.targetBaseSha} and candidate ${candidate.headSha}`,
    )
  }
  provenance.merge = {
    baseSha: candidate.targetBaseSha,
    candidateHeadSha: candidate.headSha,
    epoch: provenance.epoch,
    generation: record.generation,
    mergeSha: merged.merge_commit_sha,
    mergedAt: merged.merged_at,
    observedAt: now(),
    prNumber: record.pr.number,
    revision: record.processedRevision,
  }
  record.phase = 'deploying'
  record.receipts.mergedAt = merged.merged_at
  await rotateRunnerWorkflowDigest(
    config,
    merged.merge_commit_sha,
    candidate.diff.files,
  )
  return { mergeSha: merged.merge_commit_sha }
}

async function downloadAcceptedDeploymentReceipt(
  config: AdminIssueControllerConfig,
  run: WorkflowRun,
) {
  assertDeploymentRunSucceeded(run)
  const artifactDirectory = mkdtempSync(join(tmpdir(), 'admin-issue-deployment-'))
  try {
    const artifactName = `dashboard-deployment-receipt-${run.head_sha}-${run.run_attempt}`
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
      throw new AdminIssueProvenanceError(
        `Deployment artifact ${artifactName} did not contain deployment-receipt.json`,
      )
    }
    const receipt = JSON.parse(readFileSync(receiptPath, 'utf8')) as DeploymentReceipt
    if (
      !deploymentReceiptIsAccepted(receipt, run.head_sha, {
        id: run.id,
        runAttempt: run.run_attempt,
      })
    ) {
      throw new AdminIssueProvenanceError(
        `Deployment receipt ${artifactName} did not satisfy the accepted v2 contract`,
      )
    }
    return receipt
  } finally {
    rmSync(artifactDirectory, { force: true, recursive: true })
  }
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
    const receipt = await downloadAcceptedDeploymentReceipt(config, run)
    if (!(await refreshInputs())) return undefined
    return { receipt, run }
  }
  throw new Error(`Deployment did not finish within ${config.deploymentTimeoutMinutes} minutes`)
}

export async function commitIsAncestor(
  repositoryPath: string,
  ancestorSha: string,
  descendantSha: string,
) {
  const result = await runCommand(
    'git',
    ['merge-base', '--is-ancestor', ancestorSha, descendantSha],
    { allowFailure: true, cwd: repositoryPath, timeoutMs: 30_000 },
  )
  if (result.exitCode === 0) return true
  if (result.exitCode === 1) return false
  throw new Error(
    `Could not verify whether ${ancestorSha} is an ancestor of ${descendantSha}`,
  )
}

async function fetchCurrentMaster(config: AdminIssueControllerConfig) {
  await runCommand('git', ['fetch', '--quiet', 'origin', 'master'], {
    cwd: config.repositoryPath,
    timeoutMs: 120_000,
  })
  return (
    await runCommand('git', ['rev-parse', 'origin/master'], {
      cwd: config.repositoryPath,
    })
  ).stdout.trim()
}

function bindVerifiedDeployment(
  record: AdminIssueRecord,
  deployment: {
    receipt: DeploymentReceipt
    run: WorkflowRun
  },
  coverage: 'exact' | 'descendant',
) {
  if (record.provenance.kind !== 'active' || !record.provenance.merge) {
    throw new AdminIssueProvenanceError(
      'Cannot bind deployment without verified merge provenance',
    )
  }
  const mergeSha = record.provenance.merge.mergeSha
  record.provenance.deployment = {
    ...(coverage === 'descendant'
      ? { coverage, coverageVerifiedAt: now() }
      : {}),
    deployedSha: deployment.receipt.deployedSha,
    disposition: deployment.receipt.disposition,
    epoch: record.provenance.epoch,
    generation: record.generation,
    mergeSha,
    receiptHash: createHash('sha256')
      .update(JSON.stringify(deployment.receipt))
      .digest('hex'),
    revision: record.processedRevision,
    sourceSha: String(deployment.receipt.sourceSha),
    workflowHeadSha: deployment.run.head_sha,
    workflowRunAttempt: deployment.run.run_attempt,
    workflowRunId: deployment.run.id,
  }
  record.receipts.deployedAt = deployment.receipt.deployedAt
  record.receipts.deploymentRunUrl = deployment.run.html_url
}

export function hasRecoverableDeployment(record: AdminIssueRecord) {
  if (
    record.phase !== 'blocked' ||
    record.provenance.kind !== 'active' ||
    !record.provenance.merge ||
    record.provenance.deployment
  ) {
    return false
  }
  const reason = record.receipts.controllerBlockedReason ??
    (record.lastOutcome?.decision === 'blocked' ? record.lastOutcome.reason : '')
  return /^Deployment run \S+ concluded (?!success\b)/.test(reason)
}

export function deploymentRecoveryDue(
  record: AdminIssueRecord,
  currentTime = Date.now(),
) {
  if (!hasRecoverableDeployment(record)) return false
  const checkedAt = Date.parse(record.receipts.deploymentRecoveryCheckedAt ?? '')
  return Number.isNaN(checkedAt) ||
    currentTime - checkedAt >= DEPLOYMENT_RECOVERY_POLL_INTERVAL_MS
}

async function assertDeploymentCoversMerge(
  config: AdminIssueControllerConfig,
  record: AdminIssueRecord,
  deployment: {
    receipt: DeploymentReceipt
    run: WorkflowRun
  },
  currentMasterSha: string,
) {
  if (record.provenance.kind !== 'active' || !record.provenance.merge) {
    throw new AdminIssueProvenanceError(
      'Blocked deployment recovery is missing verified merge provenance',
    )
  }
  const merge = record.provenance.merge
  if (
    Date.parse(deployment.receipt.deployedAt) < Date.parse(merge.mergedAt)
  ) {
    throw new AdminIssueProvenanceError(
      'Recovered deployment predates the verified issue merge',
    )
  }
  const [workflowOnMaster, deployedOnMaster, mergeDeployed] = await Promise.all([
    commitIsAncestor(config.repositoryPath, deployment.run.head_sha, currentMasterSha),
    commitIsAncestor(
      config.repositoryPath,
      deployment.receipt.deployedSha,
      currentMasterSha,
    ),
    commitIsAncestor(
      config.repositoryPath,
      merge.mergeSha,
      deployment.receipt.deployedSha,
    ),
  ])
  if (!workflowOnMaster || !deployedOnMaster || !mergeDeployed) {
    throw new AdminIssueProvenanceError(
      'Recovered deployment does not contain the verified issue merge on current master',
    )
  }
}

async function loadBoundDeploymentReceipt(
  config: AdminIssueControllerConfig,
  record: AdminIssueRecord,
) {
  const { deployment, merge } = assertFinalizationAuthorized(record)
  const run = await ghApi<WorkflowRun>(
    config,
    'GET',
    `repos/${config.repository}/actions/runs/${deployment.workflowRunId}`,
  )
  if (
    run.id !== deployment.workflowRunId ||
    run.run_attempt !== deployment.workflowRunAttempt ||
    run.head_sha !== deployment.workflowHeadSha ||
    run.event !== 'push' ||
    run.head_branch !== 'master' ||
    run.status !== 'completed' ||
    run.conclusion !== 'success'
  ) {
    throw new AdminIssueProvenanceError(
      'Bound deployment workflow no longer matches its verified run',
    )
  }
  const receipt = await downloadAcceptedDeploymentReceipt(config, run)
  const receiptHash = createHash('sha256')
    .update(JSON.stringify(receipt))
    .digest('hex')
  if (
    receiptHash !== deployment.receiptHash ||
    receipt.deployedSha !== deployment.deployedSha ||
    receipt.disposition !== deployment.disposition ||
    String(receipt.sourceSha) !== deployment.sourceSha
  ) {
    throw new AdminIssueProvenanceError(
      'Bound deployment receipt no longer matches issue provenance',
    )
  }
  const currentMasterSha = await fetchCurrentMaster(config)
  await assertDeploymentCoversMerge(
    config,
    record,
    { receipt, run },
    currentMasterSha,
  )
  if (
    deployment.coverage !== 'descendant' &&
    (run.head_sha !== merge.mergeSha || receipt.sourceSha !== merge.mergeSha)
  ) {
    throw new AdminIssueProvenanceError(
      'Exact deployment binding no longer matches the verified merge',
    )
  }
  return { receipt, run }
}

async function recoverBlockedDeployments(
  config: AdminIssueControllerConfig,
  client: HassAdminTodoClient,
  state: AdminIssueControllerState,
) {
  const recoverable = Object.values(state.issues)
    .filter((record) => deploymentRecoveryDue(record))
    .sort((left, right) => {
      const leftMergedAt = left.provenance.kind === 'active'
        ? left.provenance.merge?.mergedAt ?? left.createdAt
        : left.createdAt
      const rightMergedAt = right.provenance.kind === 'active'
        ? right.provenance.merge?.mergedAt ?? right.createdAt
        : right.createdAt
      return leftMergedAt.localeCompare(rightMergedAt)
    })
  if (recoverable.length === 0) return false

  const response = await ghApi<{ workflow_runs: WorkflowRun[] }>(
    config,
    'GET',
    `repos/${config.repository}/actions/workflows/${encodeURIComponent(
      config.requiredWorkflow,
    )}/runs?branch=master&event=push&per_page=1`,
  )
  const run = response.workflow_runs[0]
  const checkedAt = now()
  if (
    !run ||
    run.status !== 'completed' ||
    run.conclusion !== 'success' ||
    run.event !== 'push' ||
    run.head_branch !== 'master'
  ) {
    for (const record of recoverable) {
      record.receipts.deploymentRecoveryCheckedAt = checkedAt
      if (run) record.receipts.deploymentRecoveryCheckedRunId = String(run.id)
    }
    writeState(config, state)
    return false
  }

  let receipt: DeploymentReceipt
  let currentMasterSha: string
  try {
    receipt = await downloadAcceptedDeploymentReceipt(config, run)
    currentMasterSha = await fetchCurrentMaster(config)
  } catch (error) {
    const errorHash = createHash('sha256')
      .update(error instanceof Error ? error.message : String(error))
      .digest('hex')
    for (const record of recoverable) {
      record.receipts.deploymentRecoveryCheckedAt = checkedAt
      record.receipts.deploymentRecoveryCheckedRunId = String(run.id)
      record.receipts.deploymentRecoveryErrorHash = errorHash
    }
    writeState(config, state)
    return false
  }

  for (const record of recoverable) {
    record.receipts.deploymentRecoveryCheckedAt = checkedAt
    record.receipts.deploymentRecoveryCheckedRunId = String(run.id)
    try {
      await assertDeploymentCoversMerge(
        config,
        record,
        { receipt, run },
        currentMasterSha,
      )
    } catch (error) {
      record.receipts.deploymentRecoveryErrorHash = createHash('sha256')
        .update(error instanceof Error ? error.message : String(error))
        .digest('hex')
      continue
    }
    let mergeSha: string
    try {
      restoreReadyOutcomeFromWorkerLog(config, record)
      const recoveredMergeSha = record.provenance.kind === 'active'
        ? record.provenance.merge?.mergeSha
        : undefined
      if (!recoveredMergeSha) {
        throw new AdminIssueProvenanceError(
          'Recovered deployment lost its verified merge provenance',
        )
      }
      mergeSha = recoveredMergeSha
    } catch (error) {
      record.receipts.deploymentRecoveryErrorHash = createHash('sha256')
        .update(error instanceof Error ? error.message : String(error))
        .digest('hex')
      continue
    }
    bindVerifiedDeployment(
      record,
      { receipt, run },
      run.head_sha === mergeSha
        ? 'exact'
        : 'descendant',
    )
    record.phase = 'deploying'
    record.receipts.deploymentRecoveredAt = now()
    delete record.receipts.deploymentRecoveryErrorHash
    state.activeUid = record.uid
    writeState(config, state)
    try {
      await finalizeIssue(config, client, state, record, { receipt, run })
    } finally {
      state.activeUid = undefined
      writeState(config, state)
    }
    return true
  }
  writeState(config, state)
  return false
}

async function verifyMergedPullRequest(
  config: AdminIssueControllerConfig,
  record: AdminIssueRecord,
) {
  const { candidate, provenance } = assertCandidateAuthorized(record, true)
  const merge = provenance.merge
  if (!merge || !record.pr || merge.prNumber !== record.pr.number) {
    throw new AdminIssueProvenanceError('Issue does not have a matching verified merge receipt')
  }
  const pullRequest = await getPullRequest(config, record)
  await verifyIssueVisualEvidenceComment(config, record)
  if (
    !pullRequest.merged_at ||
    pullRequest.merge_commit_sha !== merge.mergeSha ||
    pullRequest.merged_at !== merge.mergedAt
  ) {
    throw new AdminIssueProvenanceError(
      `Pull request #${record.pr?.number} no longer matches the verified merge receipt`,
    )
  }
  const commit = await ghApi<GitHubCommit>(
    config,
    'GET',
    `repos/${config.repository}/git/commits/${merge.mergeSha}`,
  )
  if (
    commit.parents.length !== 2 ||
    commit.parents[0]?.sha !== candidate.targetBaseSha ||
    commit.parents[1]?.sha !== candidate.headSha
  ) {
    throw new AdminIssueProvenanceError(
      `Verified merge ${merge.mergeSha} no longer binds the authorized base and candidate`,
    )
  }
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

function cleanupInputAttachmentCopies(
  config: Pick<AdminIssueControllerConfig, 'stateDirectory'>,
  record: AdminIssueRecord,
) {
  const attachmentRoot = resolve(config.stateDirectory, 'input-attachments')
  for (const input of record.inputs) {
    for (const attachment of input.attachments ?? []) {
      const localPath = resolve(attachment.localPath)
      if (!localPath.startsWith(`${attachmentRoot}/`)) {
        throw new AdminIssueProvenanceError(
          `Refusing to remove input attachment outside the state directory: ${localPath}`,
        )
      }
      rmSync(localPath, { force: true })
    }
  }
  record.receipts.inputAttachmentCopiesRemovedAt ??= now()
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
  if (!record.pr || !record.lastOutcome || record.lastOutcome.decision !== 'ready_for_pr') {
    throw new Error('Cannot finalize without a merged ready_for_pr outcome')
  }
  assertFinalizationAuthorized(record)
  await verifyMergedPullRequest(config, record)
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
      `ios-follow-up-${assertFinalizationAuthorized(record).merge.mergeSha}`,
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

  assertFinalizationAuthorized(record)
  await verifyMergedPullRequest(config, record)
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
  assertFinalizationAuthorized(record)
  await verifyMergedPullRequest(config, record)
  await ghApi(config, 'PATCH', `repos/${config.repository}/issues/${record.issueNumber}`, {
    state: 'closed',
    state_reason: 'completed',
  })
  record.receipts.issueClosedAt = now()
  writeState(config, state)

  if (adminTodoCompletionRequired(record)) {
    let items = await client.getItems(config.todoEntityId)
    let completed = items.find((item) => item.uid === record.uid)
    let receipt = await client.getState(config.completionReceiptEntityId)
    if (!adminCompletionBoundarySatisfied(completed?.status, receipt.state, record.uid)) {
      assertFinalizationAuthorized(record)
      await verifyMergedPullRequest(config, record)
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
  }
  assertFinalizationAuthorized(record)
  await verifyMergedPullRequest(config, record)
  await cleanupWorktree(config, record, true)
  cleanupInputAttachmentCopies(config, record)
  record.phase = 'completed'
  writeState(config, state)
}

async function synchronizeIssueTitle(
  config: AdminIssueControllerConfig,
  record: AdminIssueRecord,
  title: string,
) {
  const normalized = issueTitle(title)
  if (record.title === normalized) return
  await ghApi(config, 'PATCH', `repos/${config.repository}/issues/${record.issueNumber}`, {
    title: normalized,
  })
  record.title = normalized
  record.updatedAt = now()
}

async function finalizeResolvedWithoutPullRequest(
  config: AdminIssueControllerConfig,
  client: HassAdminTodoClient,
  state: AdminIssueControllerState,
  record: AdminIssueRecord,
) {
  const outcome = record.lastOutcome
  if (outcome?.decision !== 'resolved_without_pr') {
    throw new Error('resolving record is missing a resolved_without_pr outcome')
  }
  await ensureWorktree(config, state, record)
  if (!record.worktreePath || record.provenance.kind !== 'active') {
    throw new Error('No-PR resolution is missing its isolated worktree')
  }
  const files = await changedFiles(record.worktreePath)
  const snapshot = await readWorktreeSnapshot(record.worktreePath)
  assertResolvedWithoutPullRequestSnapshot(record, snapshot, files)
  record.provenance.revision = record.processedRevision
  await synchronizeIssueTitle(config, record, outcome.issueTitle)
  await postIssueCommentOnce(
    config,
    record.issueNumber,
    record.uid,
    `resolved-without-pr-r${record.processedRevision}`,
    formatResolvedWithoutPrComment(record.uid, record.processedRevision, outcome),
  )
  if (!record.receipts.issueClosedAt) {
    await ghApi(config, 'PATCH', `repos/${config.repository}/issues/${record.issueNumber}`, {
      state: 'closed',
      state_reason: 'completed',
    })
    record.receipts.issueClosedAt = now()
    writeState(config, state)
  }

  if (adminTodoCompletionRequired(record) && !record.receipts.todoCompletedAt) {
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
  }

  await cleanupWorktree(config, record, true)
  cleanupInputAttachmentCopies(config, record)
  record.phase = 'completed'
  record.receipts.resolvedWithoutPrAt = now()
  writeState(config, state)
}

export function assertResolvedWithoutPullRequestSnapshot(
  record: AdminIssueRecord,
  snapshot: AdminIssueWorktreeSnapshot,
  files: readonly string[],
) {
  if (record.provenance.kind !== 'active') {
    throw new AdminIssueProvenanceError(
      'No-PR resolution is missing active worktree provenance',
    )
  }
  if (
    record.pr ||
    record.deployment ||
    record.provenance.candidate ||
    record.provenance.merge ||
    record.provenance.deployment
  ) {
    throw new AdminIssueProvenanceError(
      'No-PR resolution cannot retain candidate, pull-request, merge, or deployment state',
    )
  }
  if (files.length > 0) {
    throw new AdminIssueProvenanceError(
      `No-PR resolution left repository changes: ${files.join(', ')}`,
    )
  }
  if (
    snapshot.headSha !== record.provenance.preparedBaseSha ||
    snapshot.status !== '' ||
    snapshot.gitOperations.length > 0
  ) {
    throw new AdminIssueProvenanceError(
      'No-PR resolution did not leave the isolated worktree at its prepared base',
    )
  }
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
  if (outcome.decision === 'resolved_without_pr') {
    outcome.iosFollowUp = { reason: '', required: false }
    record.lastOutcome = outcome
    record.phase = 'resolving'
    writeState(config, state)
    return false
  }

  record.phase = 'ready-for-pr'
  writeState(config, state)
  try {
    const candidate = await prepareCommittedCandidate(config, state, record, outcome)
    outcome.iosFollowUp = authorizedIosFollowUp(
      record.inputs
        .filter((input) => input.source !== 'ci-failure')
        .map((input) => input.body)
        .join('\n\n'),
      candidate.diff.files,
      outcome.iosFollowUp,
    )
    record.lastOutcome = outcome
    writeState(config, state)
    const originalDiffManifestSha256 = candidate.diff.manifestSha256
    if (
      !candidate.validation ||
      candidate.validation.headSha !== candidate.headSha ||
      candidate.validation.treeSha !== candidate.treeSha ||
      candidate.validation.diffManifestSha256 !== candidate.diff.manifestSha256
    ) {
      await validateAndPersistCandidate(config, state, record)
    }
    const currentBaseSha = await fetchMaster(config, record)
    const authorized = assertCandidateAuthorized(record).candidate
    if (currentBaseSha !== authorized.targetBaseSha) {
      await synchronizeCandidateBase(config, state, record, currentBaseSha)
    }
    await validateAndPersistVisualEvidence(
      config,
      state,
      record,
      outcome,
      originalDiffManifestSha256,
    )
  } catch (error) {
    if (error instanceof AdminIssueProvenanceError) {
      if (error instanceof AdminIssueWorktreeIntegrityError) {
        markRecordQuarantined(config, state, record, error.message)
      }
      await blockRecord(config, state, record, error.message)
      return false
    }
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

  if (!(await refreshInputs())) return false
  try {
    await synchronizeIssueTitle(config, record, outcome.pr.title)
    await pushCandidate(config, state, record)
    await publishCandidateVisualEvidence(config, state, record)
    await createOrUpdatePullRequest(config, record, outcome)
  } catch (error) {
    if (error instanceof AdminIssueProvenanceError) {
      await blockRecord(config, state, record, error.message)
      return false
    }
    throw error
  }
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
    visualEvidence: [],
  }
  record.lastOutcome = outcome
  record.phase = 'blocked'
  record.receipts.controllerBlockedAt = now()
  record.receipts.controllerBlockedReason = reason
  await postIssueCommentOnce(
    config,
    record.issueNumber,
    record.uid,
    `controller-blocked-r${record.inputRevision}-a${record.repairAttempts}`,
    formatBlockedComment(record.uid, record.inputRevision, outcome),
  )
  writeState(config, state)
}

async function queueVisualEvidenceRefreshAfterBaseSync(
  config: AdminIssueControllerConfig,
  state: AdminIssueControllerState,
  record: AdminIssueRecord,
) {
  const { candidate } = assertCandidateAuthorized(record)
  if (!candidateRequiresVisualEvidence(candidate.diff.files)) return false
  try {
    assertCandidateVisualEvidence(record, true)
    return false
  } catch (error) {
    if (record.repairAttempts >= config.maxRepairAttempts) {
      await blockRecord(
        config,
        state,
        record,
        `Base synchronization invalidated proposed fixed-behavior evidence after ${record.repairAttempts} repair attempts.`,
      )
      return true
    }
    record.repairAttempts += 1
    appendIssueInput(record, {
      body: `Master synchronization changed the authorized candidate. Regenerate the proposed fixed-behavior images against the current committed diff.\n\n${truncate(
        error instanceof Error ? error.message : String(error),
        4_000,
      )}`,
      createdAt: now(),
      externalId: `visual-evidence-refresh:${candidate.headSha}`,
      source: 'ci-failure',
    })
    record.phase = 'queued'
    writeState(config, state)
    return true
  }
}

export function hasRecoverableTransition(record: AdminIssueRecord) {
  return (
    record.provenance.kind === 'active' &&
    Boolean(record.provenance.transition) &&
    !record.provenance.quarantine &&
    !['aborted', 'failed', 'quarantined'].includes(record.provenance.transition?.stage ?? '')
  )
}

async function processRecord(
  config: AdminIssueControllerConfig,
  client: HassAdminTodoClient,
  state: AdminIssueControllerState,
  record: AdminIssueRecord,
) {
  const refreshInputs = async (expectedPhase: AdminIssueRecord['phase']) => {
    await reconcileTodos(config, client, state)
    await reconcileGitHubAutomationIssues(config, state)
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
      if (record.provenance.kind === 'legacy-untrusted') {
        await blockRecord(
          config,
          state,
          record,
          'This in-flight record was migrated from state version 1 without exact candidate provenance. Add a new owner comment to start a fresh isolated generation.',
        )
        return
      }
      if (record.provenance.kind === 'active' && record.provenance.quarantine) {
        await blockRecord(
          config,
          state,
          record,
          `Candidate provenance is quarantined: ${record.provenance.quarantine.reason}`,
        )
        return
      }
      if (record.phase === 'blocked' && hasRecoverableTransition(record)) {
        record.phase = 'pull-request'
        writeState(config, state)
      }
      if (record.provenance.kind === 'active' && record.provenance.transition) {
        try {
          await synchronizeCandidateBase(config, state, record)
          if (record.phase === 'pull-request') {
            await queueVisualEvidenceRefreshAfterBaseSync(config, state, record)
          }
        } catch (error) {
          if (error instanceof AdminIssueProvenanceError) {
            await blockRecord(config, state, record, error.message)
            return
          }
          throw error
        }
      }
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

      if (record.phase === 'resolving') {
        try {
          await finalizeResolvedWithoutPullRequest(config, client, state, record)
        } catch (error) {
          if (error instanceof AdminIssueProvenanceError) {
            await blockRecord(config, state, record, error.message)
            return
          }
          throw error
        }
        return
      }

      if (record.phase === 'pull-request') {
        if (!record.pr) throw new Error('pull-request record is missing PR metadata')
        try {
          const pullRequest = await getPullRequest(config, record)
          if (pullRequest.state === 'closed' && !pullRequest.merged_at) {
            await blockRecord(
              config,
              state,
              record,
              `Pull request #${pullRequest.number} was closed without being merged.`,
            )
            return
          }
          if (pullRequest.merged_at) {
            assertCandidateAuthorized(record, true)
            const merged = await mergePullRequest(config, record)
            if ('baseAdvancedTo' in merged) {
              throw new AdminIssueProvenanceError(
                'An already-merged pull request unexpectedly requested base synchronization',
              )
            }
            writeState(config, state)
            return
          }
          const currentBaseSha = await fetchMaster(config, record)
          const currentCandidate = assertCandidateAuthorized(record).candidate
          if (currentBaseSha !== currentCandidate.targetBaseSha) {
            await synchronizeCandidateBase(config, state, record, currentBaseSha)
            await queueVisualEvidenceRefreshAfterBaseSync(config, state, record)
            return
          }
          const checks = await waitForRequiredChecks(
            config,
            record,
            () => refreshInputs('pull-request'),
          )
          if ('interrupted' in checks) return
          if ('baseAdvancedTo' in checks) {
            await synchronizeCandidateBase(config, state, record, checks.baseAdvancedTo)
            await queueVisualEvidenceRefreshAfterBaseSync(config, state, record)
            return
          }
          if (!checks.success) {
            if (
              checks.runId &&
              record.receipts.ciRerunKey !== checks.rerunKey
            ) {
              await rerunFailedWorkflow(config, checks.runId)
              record.receipts.ciRerunKey = checks.rerunKey
              record.receipts.ciRerunRequestedAt = now()
              writeState(config, state)
              return
            }
            if (record.receipts.ciWorkerFailureFingerprint === checks.failureFingerprint) {
              await blockRecord(
                config,
                state,
                record,
                `The same protected-check failure remained after the worker returned without changing the candidate.\n\n${checks.logs}`,
              )
              return
            }
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
            record.receipts.ciWorkerFailureFingerprint = checks.failureFingerprint
            appendIssueInput(record, {
              body: `Protected pull-request checks failed. Diagnose and repair the branch.\n\n${checks.logs}`,
              createdAt: now(),
              externalId: `ci-failure:${currentCandidate.headSha}:${record.repairAttempts}`,
              source: 'ci-failure',
            })
            record.phase = 'queued'
            writeState(config, state)
            return
          }
          const { candidate } = assertCandidateAuthorized(record)
          candidate.checks = checks.receipt
          record.receipts.checksPassedAt = checks.receipt.observedAt
          writeState(config, state)
          const merged = await mergePullRequest(config, record)
          if ('interrupted' in merged) return
          if ('baseAdvancedTo' in merged) {
            candidate.checks = undefined
            delete record.receipts.checksPassedAt
            writeState(config, state)
            await synchronizeCandidateBase(config, state, record, merged.baseAdvancedTo)
            await queueVisualEvidenceRefreshAfterBaseSync(config, state, record)
            return
          }
          writeState(config, state)
          return
        } catch (error) {
          if (error instanceof AdminIssueProvenanceError) {
            await blockRecord(config, state, record, error.message)
            return
          }
          throw error
        }
      }

      if (record.phase === 'deploying') {
        try {
          if (record.provenance.kind !== 'active' || !record.provenance.merge) {
            throw new AdminIssueProvenanceError(
              'deploying record is missing verified merge provenance',
            )
          }
          await verifyMergedPullRequest(config, record)
          const mergeSha = record.provenance.merge.mergeSha
          const deployment = record.provenance.deployment
            ? await loadBoundDeploymentReceipt(config, record)
            : await waitForDeploymentReceipt(
                config,
                mergeSha,
                () => refreshInputs('deploying'),
              )
          if (!deployment) return
          if (!record.provenance.deployment) {
            bindVerifiedDeployment(record, deployment, 'exact')
            writeState(config, state)
          }
          await finalizeIssue(config, client, state, record, deployment)
          return
        } catch (error) {
          if (error instanceof AdminIssueProvenanceError) {
            if (error instanceof AdminIssueDeploymentRunError) {
              record.deployment = {
                conclusion: error.run.conclusion ?? undefined,
                runAttempt: error.run.run_attempt,
                runId: error.run.id,
                url: error.run.html_url,
              }
            }
            await blockRecord(config, state, record, error.message)
            return
          }
          throw error
        }
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
  const state = loadAdminIssueControllerState(config, true)
  await reconcileTodos(config, client, state)
  await reconcileGitHubAutomationIssues(config, state)
  await reconcileGitHubInputs(config, state)
  const recovering = Object.values(state.issues).find(
    (record) => record.phase === 'blocked' && hasRecoverableTransition(record),
  )
  const inFlight = Object.values(state.issues).find((record) =>
    ['pull-request', 'deploying', 'ready-for-pr', 'resolving'].includes(record.phase),
  )
  if (!recovering && !inFlight && await recoverBlockedDeployments(config, client, state)) {
    return
  }
  const ready = Object.values(state.issues)
    .filter((record) => record.inputRevision > record.processedRevision)
    .filter((record) =>
      !['completed', 'paused', 'pull-request', 'deploying', 'resolving'].includes(record.phase))
    .sort((left, right) => left.inputs[0].createdAt.localeCompare(right.inputs[0].createdAt))
  const selected = recovering ?? inFlight ?? ready[0]
  if (selected) await processRecord(config, client, state, selected)
}

async function main() {
  loadControllerEnvironment()
  const [command = 'once', configArgument = 'ops/admin-issue-controller/controller.json'] =
    process.argv.slice(2)
  const config = loadAdminIssueControllerConfig(configArgument)
  if (command === 'status') {
    process.stdout.write(`${JSON.stringify(loadAdminIssueControllerState(config), null, 2)}\n`)
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
