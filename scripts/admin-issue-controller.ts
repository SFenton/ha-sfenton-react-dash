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
import { join, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  CONTROLLER_COMMENT_MARKER,
  adminIssueMarker,
  appendIssueInput,
  assertAdminIssueControllerState,
  assertCandidateAuthorized,
  assertFinalizationAuthorized,
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
  migrateAdminIssueControllerState,
  neutralizeGitHubClosingReferences,
  parseWorkerOutcome,
  sessionNameForIssue,
  todoFingerprint,
  type AdminIssueControllerState,
  type AdminIssueCandidate,
  type AdminIssueChecksReceipt,
  type AdminIssueDiffReceipt,
  type AdminIssueInput,
  type AdminIssueRecord,
  type AdminIssueValidationReceipt,
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

export class AdminIssueProvenanceError extends Error {}

class AdminIssueWorktreeIntegrityError extends AdminIssueProvenanceError {}

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

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
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
      if (
        controllerCompleted &&
        record.provenance.kind === 'active' &&
        record.provenance.merge &&
        record.provenance.deployment
      ) {
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

export function buildWorkerPrompt(record: AdminIssueRecord) {
  const pendingInputs = record.inputs.filter((input) => input.revision > record.processedRevision)
  const issueContext = pendingInputs
    .map(
      (input) =>
        `### Input ${input.revision} (${input.source}, ${input.createdAt})\n${input.body}`,
    )
    .join('\n\n')
  return `/tandem-research ${record.title}

You are working on GitHub issue #${record.issueNumber} in ${record.issueUrl}.

Use the tandem-research workflow to investigate the issue before implementation. The operator's issue text and follow-up comments below are canonical. Make repository changes only through the admin_issue_workspace tool. Use the configured Home Assistant MCP server directly whenever current HA state, history, traces, configuration, services, or validation are relevant. It is a trusted local execution surface with operator-equivalent Home Assistant access. Follow the server's skill-guide and safety contracts, prefer read-only diagnosis before mutation, perform only issue-scoped HA actions, verify their results, and never expose credentials or secret-bearing configuration. Do not use host filesystem, host shell, GitHub, general network, commit, push, merge, deployment, or issue-mutation tools. The trusted host controller owns those operations.

Gather available Home Assistant evidence yourself before asking the operator for diagnostics or authorization. Do not offer an input option that merely authorizes a capability already available to you. If a consequential product or design decision remains after repository and Home Assistant investigation, stop and return needs_input with concise options and your recommendation. Otherwise implement the complete fix in the assigned worktree, update the directly owned tests, run the relevant tests through admin_issue_workspace, iterate until they pass, and perform a meaningful code review. Treat iOS/WebKit-specific behavior as requiring explicit manual follow-up.

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
  assertWorkerChangesSafe(record.worktreePath, files)
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
  if (pullRequest.head.sha !== candidateHeadSha) {
    throw new AdminIssueProvenanceError(
      `Pull request #${pullRequest.number} head ${pullRequest.head.sha} does not match authorized candidate ${candidateHeadSha}`,
    )
  }
  const expectedUrl = `https://github.com/${repository}/pull/${pullRequest.number}`.toLowerCase()
  if (pullRequest.html_url.toLowerCase() !== expectedUrl) {
    throw new AdminIssueProvenanceError(
      `Pull request #${pullRequest.number} URL does not belong to ${repository}`,
    )
  }
}

async function getPullRequest(
  config: AdminIssueControllerConfig,
  record: AdminIssueRecord,
  expectedHeadSha?: string,
) {
  if (!record.pr) throw new AdminIssueProvenanceError('Pull request is missing')
  const pullRequest = await ghApi<GitHubPullRequest>(
    config,
    'GET',
    `repos/${config.repository}/pulls/${record.pr.number}`,
  )
  if (!record.branch) throw new AdminIssueProvenanceError('Worker branch is missing')
  const candidateHeadSha = expectedHeadSha ?? assertCandidateAuthorized(record).candidate.headSha
  assertPullRequestBinding(config.repository, record.branch, pullRequest, candidateHeadSha)
  if (
    pullRequest.number !== record.pr.number ||
    pullRequest.html_url.toLowerCase() !== record.pr.url.toLowerCase()
  ) {
    throw new AdminIssueProvenanceError('Live pull request identity does not match controller state')
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

async function prepareCommittedCandidate(
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
    await getPullRequest(config, record, previousCandidate.headSha)
  }
  const files = await changedFiles(record.worktreePath)
  if (files.length === 0) {
    if (
      previousCandidate &&
      provenance.revision === record.processedRevision &&
      snapshot.treeSha === previousCandidate.treeSha &&
      snapshot.status === ''
    ) {
      return previousCandidate
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
    provenance.candidate = {
      diff: transition.provisionalDiff,
      ...(transition.expectedRemoteHeadSha
        ? { expectedRemoteHeadSha: transition.expectedRemoteHeadSha }
        : {}),
      headSha: transition.toHeadSha,
      targetBaseSha: transition.targetBaseSha,
      treeSha: transition.toTreeSha,
      validation: transition.provisionalValidation,
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
  assertPullRequestBinding(config.repository, record.branch, pullRequest, candidate.headSha)
  record.pr = {
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
  const { candidate, provenance } = assertCandidateAuthorized(record)
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
  return { mergeSha: merged.merge_commit_sha }
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
  assertFinalizationAuthorized(record)
  await verifyMergedPullRequest(config, record)
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
  try {
    const candidate = await prepareCommittedCandidate(config, state, record, outcome)
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
    await pushCandidate(config, state, record)
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
      if (record.provenance.kind === 'active' && record.provenance.transition) {
        try {
          await synchronizeCandidateBase(config, state, record)
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
            return
          }
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
          const deployment = await waitForDeploymentReceipt(
            config,
            mergeSha,
            () => refreshInputs('deploying'),
          )
          if (!deployment) return
          record.provenance.deployment = {
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
          writeState(config, state)
          await finalizeIssue(config, client, state, record, deployment)
          return
        } catch (error) {
          if (error instanceof AdminIssueProvenanceError) {
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
