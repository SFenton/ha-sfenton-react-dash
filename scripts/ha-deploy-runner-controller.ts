import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  open,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const DEFAULT_REPOSITORY = 'SFenton/ha-sfenton-react-dash'
const PRODUCTION_JOB = 'Deploy dashboard'
const SMOKE_JOB = 'Controller smoke'
const BUILD_JOB = 'Build dashboard artifact'

type ControllerMode = 'smoke-only' | 'production'
type CandidateKind = 'smoke' | 'production'
type AdmissionDecision = 'allow' | 'full-rerun-required'
type AuthorizationDecision = 'allow' | 'reject'

type ControllerConfig = {
  version: 1
  repository: string
  repositoryId: number
  runnerGroupId: number
  workflowPath: string
  workflowSha256: string
  runnerImage: string
  runnerImageId: string
  mode: ControllerMode
  stateDirectory: string
  pollSeconds?: number
  assignmentTimeoutSeconds?: number
  jobTimeoutSeconds?: number
  haHost: string
  haSshPort?: number
  haApiPort?: number
}

export type WorkflowRun = {
  id: number
  path: string
  event: string
  head_branch: string
  head_sha: string
  run_attempt: number
  status: string
  conclusion: string | null
  created_at: string
}

export type WorkflowJob = {
  id: number
  name: string
  status: string
  conclusion: string | null
  runner_id: number | null
  runner_name: string | null
  labels: string[]
}

export type ControllerCandidate = {
  kind: CandidateKind
  run: WorkflowRun
  job: WorkflowJob
  label: string
  admission: {
    decision: AdmissionDecision
    reason?: string
  }
}

type JitRunner = {
  id: number
  name: string
  labels: Array<{ name: string }>
}

type JitConfiguration = {
  runner: JitRunner
  encoded_jit_config: string
}

type ActiveOperationJournal = {
  version: 1
  phase:
    | 'planned'
    | 'assigned'
    | 'ha-enabled'
    | 'authorized'
    | 'completed'
    | 'cleanup'
  candidate: {
    kind: CandidateKind
    runId: number
    runAttempt: number
    jobId: number
    label: string
    headSha: string
  }
  authorization: {
    decision: AuthorizationDecision
    disposition?: Exclude<AdmissionDecision, 'allow'>
    reason?: string
  }
  resources: {
    network: string
    githubProxy: string
    runnerContainer: string
    sshProxy?: string
    apiProxy?: string
    runnerName: string
    jitRunnerId?: number
  }
  updatedAt: string
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function errorMessage(error: unknown): string {
  if (error instanceof AggregateError) {
    return [
      error.message,
      ...error.errors.map((nested) => errorMessage(nested)),
    ].join('\n')
  }
  return error instanceof Error ? error.message : String(error)
}

function sha256(value: string | Buffer) {
  return createHash('sha256').update(value).digest('hex')
}

function safeIdentifier(value: string) {
  return value.replace(/[^a-zA-Z0-9_.-]/g, '-').slice(0, 100)
}

function activeOperationPath(
  config: Awaited<ReturnType<typeof loadConfig>>,
) {
  return resolve(config.stateDirectory, 'active-operation.json')
}

function activeOperationTempPath(path: string) {
  return resolve(
    dirname(path),
    `.${basename(path)}.${process.pid}.${Date.now().toString(36)}.tmp`,
  )
}

export async function writeActiveOperationFile(
  path: string,
  journal: ActiveOperationJournal,
) {
  const temporaryPath = activeOperationTempPath(path)
  try {
    await writeFile(
      temporaryPath,
      `${JSON.stringify({ ...journal, updatedAt: new Date().toISOString() }, null, 2)}\n`,
      { mode: 0o600 },
    )
    await rename(temporaryPath, path)
  } finally {
    await rm(temporaryPath, { force: true })
  }
}

async function writeActiveOperation(
  config: Awaited<ReturnType<typeof loadConfig>>,
  journal: ActiveOperationJournal,
) {
  await mkdir(config.stateDirectory, { recursive: true, mode: 0o700 })
  await writeActiveOperationFile(activeOperationPath(config), journal)
}

async function clearActiveOperation(
  config: Awaited<ReturnType<typeof loadConfig>>,
) {
  await rm(activeOperationPath(config), { force: true })
}

async function readActiveOperation(
  config: Awaited<ReturnType<typeof loadConfig>>,
) {
  try {
    return JSON.parse(
      await readFile(activeOperationPath(config), 'utf8'),
    ) as ActiveOperationJournal
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return undefined
    }
    throw error
  }
}

export function expectedRunnerLabel(
  kind: CandidateKind,
  runId: number,
  runAttempt: number,
) {
  return `ha-deploy-${kind}-${runId}-${runAttempt}`
}

export function expectedRunnerName(candidate: {
  kind: CandidateKind
  run: Pick<WorkflowRun, 'id' | 'run_attempt'>
  job: Pick<WorkflowJob, 'id'>
}) {
  return safeIdentifier(
    `ha-jit-${candidate.kind}-${candidate.run.id}-${candidate.run.run_attempt}-${candidate.job.id}`,
  )
}

function expectedJob(kind: CandidateKind) {
  return kind === 'production' ? PRODUCTION_JOB : SMOKE_JOB
}

function expectedEvent(kind: CandidateKind) {
  return kind === 'production' ? 'push' : 'workflow_dispatch'
}

export function isUnassignedJob(job: WorkflowJob) {
  return (job.runner_id === null || job.runner_id === 0) &&
    (job.runner_name === null || job.runner_name === '')
}

export function admissionForAttempt(
  kind: CandidateKind,
  jobs: readonly WorkflowJob[],
) {
  if (kind === 'smoke') return { decision: 'allow' as const }
  const successfulBuilds = jobs.filter(
    (job) =>
      job.name === BUILD_JOB &&
      job.status === 'completed' &&
      job.conclusion === 'success',
  )
  assert(
    successfulBuilds.length <= 1,
    'Workflow attempt has multiple successful build jobs; production admission is ambiguous',
  )
  if (successfulBuilds.length === 1) return { decision: 'allow' as const }
  return {
    decision: 'full-rerun-required' as const,
    reason:
      'full-rerun-required: this deploy attempt does not have a successful same-attempt build; re-run all jobs for this workflow run',
  }
}

export function authorizationForCandidate(
  candidate: Pick<ControllerCandidate, 'kind' | 'admission'>,
) {
  if (candidate.kind === 'smoke' || candidate.admission.decision === 'allow') {
    return { decision: 'allow' as const }
  }
  return {
    decision: 'reject' as const,
    disposition: candidate.admission.decision,
    reason: candidate.admission.reason,
  }
}

export function candidateCompareStatusAllowsMasterLine(status: string) {
  return status === 'ahead' || status === 'identical'
}

export function recoveryDispositionForPhase(
  phase: ActiveOperationJournal['phase'],
) {
  if (phase === 'planned') return 'cleanup-pre-ha' as const
  if (phase === 'authorized') return 'resume-authorized' as const
  if (phase === 'completed' || phase === 'cleanup') {
    return 'cleanup-terminal' as const
  }
  return 'operator-recovery' as const
}

function exactJobLabelMatch(job: WorkflowJob, label: string) {
  return job.labels.length === 1 && job.labels[0] === label
}

function resourceContainerNames(
  resources: ActiveOperationJournal['resources'],
) {
  return [
    resources.apiProxy,
    resources.sshProxy,
    resources.runnerContainer,
    resources.githubProxy,
  ].filter((value): value is string => Boolean(value))
}

export function selectControllerCandidate(
  runs: readonly WorkflowRun[],
  jobsByRun: ReadonlyMap<number, readonly WorkflowJob[]>,
  options: {
    masterSha: string
    mode: ControllerMode
    workflowPath: string
  },
): ControllerCandidate | undefined {
  const kinds: CandidateKind[] =
    options.mode === 'production' ? ['production', 'smoke'] : ['smoke']
  const candidates: ControllerCandidate[] = []
  const allowedRunStatuses = new Set(['queued', 'in_progress'])
  const ignoredQueuedStatuses = new Set(['pending', 'waiting', 'requested'])
  for (const run of runs) {
    if (run.conclusion !== null || !allowedRunStatuses.has(run.status)) continue
    for (const kind of kinds) {
      if (
        run.path !== options.workflowPath ||
        run.event !== expectedEvent(kind) ||
        run.head_branch !== 'master' ||
        (kind === 'smoke' && run.head_sha !== options.masterSha)
      ) {
        continue
      }
      const jobs = jobsByRun.get(run.id) ?? []
      const label = expectedRunnerLabel(kind, run.id, run.run_attempt)
      const runnableJobs: WorkflowJob[] = []
      for (const matching of jobs) {
        if (
          matching.name !== expectedJob(kind) ||
          !exactJobLabelMatch(matching, label) ||
          matching.conclusion !== null ||
          !isUnassignedJob(matching)
        ) {
          continue
        }
        if (matching.status === 'queued') {
          runnableJobs.push(matching)
          continue
        }
        if (ignoredQueuedStatuses.has(matching.status)) continue
        throw new Error(
          `Run ${run.id} has unsupported ${matching.name} status ${matching.status}`,
        )
      }
      if (runnableJobs.length > 1) {
        throw new Error(
          `Run ${run.id} has multiple runnable ${expectedJob(kind)} jobs for label ${label}`,
        )
      }
      const job = runnableJobs[0]
      if (!job) continue
      candidates.push({
        kind,
        run,
        job,
        label,
        admission: admissionForAttempt(kind, jobs),
      })
    }
  }
  if (candidates.length > 1) {
    throw new Error(
      `Multiple runnable deployment jobs detected (${candidates.map((candidate) => `${candidate.kind}:${candidate.run.id}`).join(', ')}); refusing to choose by timestamp`,
    )
  }
  return candidates[0]
}

export function assertJitRunnerLabels(
  runner: JitRunner,
  expectedLabel: string,
) {
  const labels = runner.labels.map((label) => label.name).sort()
  assert(
    labels.length === 1 && labels[0] === expectedLabel,
    `JIT runner labels are not exclusive to ${expectedLabel}: ${labels.join(', ')}`,
  )
}

export function assertExpectedJobBinding(
  job: WorkflowJob,
  runner: JitRunner,
) {
  assert(
    job.runner_id === runner.id && job.runner_name === runner.name,
    `Workflow job is not bound to JIT runner ${runner.name}`,
  )
}

export function assertExpectedRunnerRegistration(
  runner: JitRunner,
  expected: {
    label: string
    runnerName: string
    jitRunnerId?: number
  },
) {
  assertJitRunnerLabels(runner, expected.label)
  assert(
    runner.name === expected.runnerName &&
      (!expected.jitRunnerId || runner.id === expected.jitRunnerId),
    `JIT runner ${expected.runnerName} changed identity; operator recovery is required`,
  )
}

export function jitConfigurationRequest(
  name: string,
  label: string,
  runnerGroupId: number,
) {
  assert(runnerGroupId > 0, 'JIT runner group ID is invalid')
  return {
    name,
    runner_group_id: runnerGroupId,
    labels: [label],
    work_folder: '_work',
  }
}

async function command(
  executable: string,
  args: string[],
  options: { allowFailure?: boolean; maxBuffer?: number } = {},
) {
  try {
    const result = await execFileAsync(executable, args, {
      encoding: 'utf8',
      maxBuffer: options.maxBuffer ?? 10 * 1024 * 1024,
    })
    return {
      stdout: result.stdout.trim(),
      stderr: result.stderr.trim(),
      failed: false,
    }
  } catch (error) {
    if (options.allowFailure) {
      const failure = error as {
        stdout?: string
        stderr?: string
      }
      return {
        stdout: failure.stdout?.trim() ?? '',
        stderr: failure.stderr?.trim() ?? '',
        failed: true,
      }
    }
    throw error
  }
}

async function ghApi<T>(
  path: string,
  options: { body?: unknown; method?: string } = {},
) {
  const temporary = options.body === undefined
    ? undefined
    : await mkdtemp(`${tmpdir()}/ha-runner-gh-`)
  try {
    const args = ['api']
    if (options.method) args.push('--method', options.method)
    args.push(path)
    if (temporary) {
      const input = `${temporary}/input.json`
      await writeFile(input, JSON.stringify(options.body))
      args.push('--input', input)
    }
    const { stdout } = await command('gh', args)
    return stdout ? JSON.parse(stdout) as T : undefined as T
  } finally {
    if (temporary) await rm(temporary, { recursive: true, force: true })
  }
}

async function docker(args: string[], allowFailure = false) {
  return command('docker', args, { allowFailure })
}

export function dockerInspectIsMissing(stdout: string) {
  return stdout === '' || stdout === '[]'
}

async function retryProbe(description: string, probe: () => Promise<void>) {
  let lastError: unknown
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      await probe()
      return
    } catch (error) {
      lastError = error
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 500))
    }
  }
  throw new Error(`${description} did not become ready`, { cause: lastError })
}

async function removeContainer(name: string) {
  await docker(['rm', '--force', '--volumes', name], true)
  const remaining = await docker(['container', 'inspect', name], true)
  assert(
    dockerInspectIsMissing(remaining.stdout),
    `Runner container cleanup failed for ${name}`,
  )
}

async function workflowSource(
  repository: string,
  workflowPath: string,
  sha: string,
) {
  const result = await ghApi<{ content: string; encoding: string }>(
    `repos/${repository}/contents/${workflowPath}?ref=${sha}`,
  )
  assert(result.encoding === 'base64', 'Workflow content encoding is invalid')
  return Buffer.from(result.content.replace(/\s+/g, ''), 'base64')
}

async function repositoryMasterSha(repository: string) {
  const result = await ghApi<{ object: { sha: string } }>(
    `repos/${repository}/git/ref/heads/master`,
  )
  return result.object.sha
}

async function repositoryIdentity(repository: string) {
  return ghApi<{ id: number; full_name: string; private: boolean }>(
    `repos/${repository}`,
  )
}

async function workflowRuns(repository: string, workflowPath: string) {
  const workflowFile = workflowPath.split('/').at(-1)
  assert(workflowFile, 'Workflow file name is invalid')
  const statuses = ['queued', 'in_progress'] as const
  const runs = new Map<number, WorkflowRun>()
  for (const status of statuses) {
    for (let page = 1; ; page += 1) {
      const result = await ghApi<{ workflow_runs: WorkflowRun[] }>(
        `repos/${repository}/actions/workflows/${encodeURIComponent(workflowFile)}/runs?branch=master&status=${status}&per_page=100&page=${page}`,
      )
      for (const run of result.workflow_runs) {
        runs.set(run.id, run)
      }
      if (result.workflow_runs.length < 100) break
    }
  }
  return [...runs.values()]
}

async function repositoryRunners(repository: string) {
  const runners: JitRunner[] = []
  for (let page = 1; ; page += 1) {
    const result = await ghApi<{ runners: JitRunner[] }>(
      `repos/${repository}/actions/runners?per_page=100&page=${page}`,
    )
    runners.push(...result.runners)
    if (result.runners.length < 100) break
  }
  return runners
}

async function workflowJobs(
  repository: string,
  runId: number,
  runAttempt: number,
) {
  const jobs = new Map<number, WorkflowJob>()
  for (let page = 1; ; page += 1) {
    const result = await ghApi<{ jobs: WorkflowJob[] }>(
      `repos/${repository}/actions/runs/${runId}/attempts/${runAttempt}/jobs?per_page=100&page=${page}`,
    )
    for (const job of result.jobs) jobs.set(job.id, job)
    if (result.jobs.length < 100) break
  }
  return [...jobs.values()]
}

async function workflowJob(repository: string, jobId: number) {
  return ghApi<WorkflowJob>(
    `repos/${repository}/actions/jobs/${jobId}`,
  )
}

async function workflowRun(repository: string, runId: number) {
  return ghApi<WorkflowRun>(
    `repos/${repository}/actions/runs/${runId}`,
  )
}

async function assertCandidateOnMasterLine(
  repository: string,
  candidateSha: string,
  masterSha: string,
) {
  const compare = await ghApi<{ status: string }>(
    `repos/${repository}/compare/${candidateSha}...${masterSha}`,
  )
  assert(
    candidateCompareStatusAllowsMasterLine(compare.status),
    `Candidate SHA ${candidateSha} is not an ancestor of current master ${masterSha} (compare status ${compare.status})`,
  )
}

async function generateJitConfiguration(
  repository: string,
  runnerGroupId: number,
  candidate: ControllerCandidate,
  runnerName: string,
) {
  const configuration = await ghApi<JitConfiguration>(
    `repos/${repository}/actions/runners/generate-jitconfig`,
    {
      method: 'POST',
      body: jitConfigurationRequest(
        runnerName,
        candidate.label,
        runnerGroupId,
      ),
    },
  )
  assertJitRunnerLabels(configuration.runner, candidate.label)
  return configuration
}

async function removeRunnerRegistration(
  repository: string,
  runnerId: number,
) {
  const result = await command('gh', [
    'api',
    '--method',
    'DELETE',
    `repos/${repository}/actions/runners/${runnerId}`,
  ], { allowFailure: true })
  assert(
    !result.failed || result.stderr.includes('HTTP 404'),
    `Could not remove JIT runner registration ${runnerId}: ${result.stderr}`,
  )
  await retryProbe('JIT runner registration cleanup', async () => {
    const remaining = (await repositoryRunners(repository))
      .some((runner) => runner.id === runnerId)
    assert(!remaining, `JIT runner registration ${runnerId} still exists`)
  })
}

async function findRunnerRegistration(
  repository: string,
  expectedName: string,
  expectedLabel: string,
) {
  const matches = (await repositoryRunners(repository)).filter(
    (runner) => runner.name === expectedName,
  )
  assert(
    matches.length <= 1,
    `Multiple JIT runner registrations exist for ${expectedName}`,
  )
  const match = matches[0]
  if (!match) return undefined
  assertJitRunnerLabels(match, expectedLabel)
  return match
}

async function removeRunnerRegistrationForJournal(
  config: Awaited<ReturnType<typeof loadConfig>>,
  journal: ActiveOperationJournal,
) {
  if (journal.resources.jitRunnerId) {
    const runner = (await repositoryRunners(config.repository))
      .find((candidate) => candidate.id === journal.resources.jitRunnerId)
    if (!runner) return
    assertExpectedRunnerRegistration(runner, {
      label: journal.candidate.label,
      runnerName: journal.resources.runnerName,
      jitRunnerId: journal.resources.jitRunnerId,
    })
    await removeRunnerRegistration(config.repository, journal.resources.jitRunnerId)
    return
  }
  const runner = await findRunnerRegistration(
    config.repository,
    journal.resources.runnerName,
    journal.candidate.label,
  )
  if (!runner) return
  await removeRunnerRegistration(config.repository, runner.id)
}

async function loadConfig(path: string) {
  const config = JSON.parse(await readFile(resolve(path), 'utf8')) as ControllerConfig
  assert(config.version === 1, 'Controller config version is invalid')
  assert(config.repositoryId > 0, 'Controller repository ID is invalid')
  assert(config.runnerGroupId > 0, 'Controller runner group ID is invalid')
  assert(/^[a-f0-9]{64}$/.test(config.workflowSha256), 'Workflow SHA-256 is invalid')
  assert(config.runnerImage.length > 0, 'Runner image is required')
  assert(/^sha256:[a-f0-9]{64}$/.test(config.runnerImageId), 'Runner image ID is invalid')
  assert(config.mode === 'smoke-only' || config.mode === 'production', 'Controller mode is invalid')
  assert(config.haHost.length > 0, 'Home Assistant host is required')
  return {
    ...config,
    repository: config.repository || DEFAULT_REPOSITORY,
    pollSeconds: config.pollSeconds ?? 10,
    assignmentTimeoutSeconds: config.assignmentTimeoutSeconds ?? 90,
    jobTimeoutSeconds: config.jobTimeoutSeconds ?? 1_800,
    haSshPort: config.haSshPort ?? 22,
    haApiPort: config.haApiPort ?? 8123,
  }
}

async function validateRepositoryIdentity(
  config: Awaited<ReturnType<typeof loadConfig>>,
) {
  const identity = await repositoryIdentity(config.repository)
  assert(
    identity.id === config.repositoryId &&
      identity.full_name === config.repository &&
      identity.private === false,
    'Controller repository identity does not match the public dashboard repository',
  )
}

export async function acquireControllerLockFile(path: string) {
  const create = () => open(path, 'wx', 0o600)
  let file
  try {
    file = await create()
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !('code' in error) ||
      error.code !== 'EEXIST'
    ) {
      throw error
    }
    const owner = await readFile(path, 'utf8').catch(() => '')
    let parsed: { pid?: unknown }
    try {
      parsed = JSON.parse(owner) as { pid?: unknown }
    } catch (parseError) {
      throw new Error(
        `Controller lock is malformed; operator recovery is required (${owner || 'unknown owner'})`,
        { cause: parseError },
      )
    }
    if (!Number.isInteger(parsed.pid) || Number(parsed.pid) <= 0) {
      throw new Error(
        `Controller lock is malformed; operator recovery is required (${owner || 'unknown owner'})`,
        { cause: error },
      )
    }
    const pid = Number(parsed.pid)
    let stale = false
    try {
      process.kill(pid, 0)
    } catch (signalError) {
      if (
        signalError instanceof Error &&
        'code' in signalError &&
        signalError.code === 'ESRCH'
      ) {
        stale = true
      } else {
        throw new Error(
          `Controller lock is already held; recovery is required (${owner || 'unknown owner'})`,
          { cause: signalError },
        )
      }
    }
    if (!stale) {
      throw new Error(
        `Controller lock is already held; recovery is required (${owner || 'unknown owner'})`,
        { cause: error },
      )
    }
    await rm(path, { force: true })
    file = await create()
  }
  await file.writeFile(
    `${JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() })}\n`,
  )
  return async () => {
    try {
      await file.close()
    } finally {
      await rm(path, { force: true })
    }
  }
}

async function acquireControllerLock(
  config: Awaited<ReturnType<typeof loadConfig>>,
) {
  await mkdir(config.stateDirectory, { recursive: true, mode: 0o700 })
  return acquireControllerLockFile(
    resolve(config.stateDirectory, 'controller.lock'),
  )
}

async function reconcileActiveOperation(
  config: Awaited<ReturnType<typeof loadConfig>>,
) {
  const journal = await readActiveOperation(config)
  if (!journal) return
  const { resources, candidate } = journal
  const disposition = recoveryDispositionForPhase(journal.phase)
  const suffix = `${candidate.runId}-${candidate.runAttempt}`

  if (disposition === 'cleanup-pre-ha') {
    const job = await workflowJob(config.repository, candidate.jobId)
    if (!isUnassignedJob(job)) {
      throw new Error(
        `Active operation ${candidate.runId}/${candidate.runAttempt} is no longer unassigned; operator recovery is required`,
      )
    }
    await cleanup(
      config,
      resourceContainerNames(resources),
      resources.network,
      `${suffix}-reconcile`,
    )
    await removeRunnerRegistrationForJournal(config, journal)
    await clearActiveOperation(config)
    return
  }

  if (disposition === 'cleanup-terminal') {
    await cleanup(
      config,
      resourceContainerNames(resources),
      resources.network,
      `${suffix}-terminal`,
    )
    await removeRunnerRegistrationForJournal(config, journal)
    await clearActiveOperation(config)
    return
  }

  if (disposition === 'resume-authorized') {
    const [run, job, runner] = await Promise.all([
      workflowRun(config.repository, candidate.runId),
      workflowJob(config.repository, candidate.jobId),
      findRunnerRegistration(
        config.repository,
        resources.runnerName,
        candidate.label,
      ),
    ])
    assert(
      run.id === candidate.runId &&
        run.run_attempt === candidate.runAttempt &&
        run.head_sha === candidate.headSha,
      `Authorized operation ${candidate.runId}/${candidate.runAttempt} changed after restart; operator recovery is required`,
    )
    assertAuthorizedRecoveryBinding(
      job,
      {
        kind: candidate.kind,
        label: candidate.label,
        runnerName: resources.runnerName,
        jitRunnerId: resources.jitRunnerId,
      },
      runner,
    )
    const recoveryCandidate: ControllerCandidate = {
      kind: candidate.kind,
      run,
      job,
      label: candidate.label,
      admission: {
        decision:
          journal.authorization.decision === 'allow'
            ? 'allow'
            : journal.authorization.disposition ?? 'full-rerun-required',
        reason: journal.authorization.reason,
      },
    }
    if (job.status !== 'completed') {
      assert(
        runner,
        `Authorized JIT runner ${resources.runnerName} is missing; operator recovery is required`,
      )
      await authorizeRunner(resources.runnerContainer, recoveryCandidate, runner)
    }
    const completed =
      job.status === 'completed'
        ? job
        : await waitForJobCompletion(config, recoveryCandidate)
    const failures: unknown[] = []
    const expectedConclusion =
      expectedConclusionForAuthorization(journal.authorization)
    if (completed.conclusion !== expectedConclusion) {
      failures.push(new Error(
        `${completed.name} concluded ${String(completed.conclusion)} during recovery; expected ${expectedConclusion}`,
      ))
    }
    await writeActiveOperation(config, { ...journal, phase: 'completed' })
    let cleanupIncomplete = false
    await cleanup(
      config,
      resourceContainerNames(resources),
      resources.network,
      `${suffix}-resume`,
    ).catch((error) => {
      cleanupIncomplete = true
      failures.push(error)
    })
    await removeRunnerRegistrationForJournal(config, journal).catch((error) => {
      cleanupIncomplete = true
      failures.push(error)
    })
    if (!cleanupIncomplete) {
      await clearActiveOperation(config).catch((error) => {
        cleanupIncomplete = true
        failures.push(error)
      })
    }
    if (failures.length === 1) throw failures[0]
    if (failures.length > 1) {
      throw new AggregateError(
        failures,
        'Authorized operation recovery or cleanup was incomplete',
      )
    }
    return
  }

  throw new Error(
    `Active operation ${candidate.runId}/${candidate.runAttempt} is ${journal.phase}; startup recovery is blocked until operator intervention`,
  )
}

async function findCandidate(config: Awaited<ReturnType<typeof loadConfig>>) {
  const [masterSha, runs] = await Promise.all([
    repositoryMasterSha(config.repository),
    workflowRuns(config.repository, config.workflowPath),
  ])
  const jobsByRun = new Map<number, WorkflowJob[]>()
  for (const run of runs) {
    if (
      run.path === config.workflowPath &&
      run.head_branch === 'master' &&
      ['push', 'workflow_dispatch'].includes(run.event) &&
      ['queued', 'in_progress'].includes(run.status)
    ) {
      jobsByRun.set(
        run.id,
        await workflowJobs(config.repository, run.id, run.run_attempt),
      )
    }
  }
  const candidate = selectControllerCandidate(runs, jobsByRun, {
    masterSha,
    mode: config.mode,
    workflowPath: config.workflowPath,
  })
  if (!candidate) return undefined
  if (candidate.kind === 'production') {
    await assertCandidateOnMasterLine(
      config.repository,
      candidate.run.head_sha,
      masterSha,
    )
  }
  return candidate
}

async function validateControlPlane(
  config: Awaited<ReturnType<typeof loadConfig>>,
  candidate: ControllerCandidate,
) {
  const source = await workflowSource(
    config.repository,
    config.workflowPath,
    candidate.run.head_sha,
  )
  assert(
    sha256(source) === config.workflowSha256,
    'Queued workflow does not match the installed controller digest',
  )
  const image = await docker([
    'image',
    'inspect',
    '--format',
    '{{.Id}}',
    config.runnerImage,
  ])
  assert(
    image.stdout === config.runnerImageId,
    'Runner image does not match the installed controller digest',
  )
}

async function revalidateCandidate(
  config: Awaited<ReturnType<typeof loadConfig>>,
  candidate: ControllerCandidate,
) {
  const [masterSha, run, jobs] = await Promise.all([
    repositoryMasterSha(config.repository),
    workflowRun(config.repository, candidate.run.id),
    workflowJobs(
      config.repository,
      candidate.run.id,
      candidate.run.run_attempt,
    ),
  ])
  const selected = selectControllerCandidate(
    [run],
    new Map([[run.id, jobs]]),
    {
      masterSha,
      mode: candidate.kind === 'production' ? 'production' : 'smoke-only',
      workflowPath: config.workflowPath,
    },
  )
  assert(
    selected &&
      selected.run.id === candidate.run.id &&
      selected.job.id === candidate.job.id &&
      selected.kind === candidate.kind &&
      selected.admission.decision === candidate.admission.decision,
    `Candidate ${candidate.run.id}/${candidate.job.id} is no longer runnable`,
  )
  if (candidate.kind === 'production') {
    await assertCandidateOnMasterLine(
      config.repository,
      candidate.run.head_sha,
      masterSha,
    )
  }
}

async function revalidateBeforeHomeAssistantAccess(
  config: Awaited<ReturnType<typeof loadConfig>>,
  candidate: ControllerCandidate,
  runner: JitRunner,
) {
  const [masterSha, run, jobs, job] = await Promise.all([
    repositoryMasterSha(config.repository),
    workflowRun(config.repository, candidate.run.id),
    workflowJobs(
      config.repository,
      candidate.run.id,
      candidate.run.run_attempt,
    ),
    workflowJob(config.repository, candidate.job.id),
  ])
  assert(
    run.id === candidate.run.id &&
      run.run_attempt === candidate.run.run_attempt &&
      run.head_sha === candidate.run.head_sha &&
      run.status === 'in_progress',
    `Run ${candidate.run.id} changed before Home Assistant access`,
  )
  if (candidate.kind === 'production') {
    assert(
      candidate.admission.decision === 'allow',
      candidate.admission.reason ??
        `Run ${candidate.run.id} is not admitted for Home Assistant access`,
    )
    const admission = admissionForAttempt(candidate.kind, jobs)
    assert(
      admission.decision === 'allow',
      admission.reason ??
        `Run ${candidate.run.id} no longer has a successful same-attempt build`,
    )
    assert(
      job.status !== 'completed',
      `Run ${candidate.run.id} finished before Home Assistant access`,
    )
    await assertCandidateOnMasterLine(
      config.repository,
      candidate.run.head_sha,
      masterSha,
    )
  }
  assertExpectedJobBinding(job, runner)
}

async function startGithubProxy(
  config: Awaited<ReturnType<typeof loadConfig>>,
  prefix: string,
  network: string,
) {
  const name = `${prefix}-github-proxy`
  try {
    await docker([
      'run',
      '--detach',
      '--name',
      name,
      '--network',
      network,
      '--network-alias',
      'github-egress',
      '--read-only',
      '--cap-drop',
      'ALL',
      '--security-opt',
      'no-new-privileges',
      '--tmpfs',
      '/tmp:rw,noexec,nosuid,nodev',
      '--tmpfs',
      '/var/log/squid:rw,noexec,nosuid,nodev',
      '--tmpfs',
      '/var/spool/squid:rw,noexec,nosuid,nodev',
      '--entrypoint',
      '/opt/ha-dashboard/bin/start-github-proxy',
      config.runnerImageId,
    ])
    await docker(['network', 'connect', 'bridge', name])
    await retryProbe('GitHub egress proxy', async () => {
      await docker([
        'run',
        '--rm',
        '--network',
        network,
        '--read-only',
        '--cap-drop',
        'ALL',
        '--security-opt',
        'no-new-privileges',
        '--env',
        'HTTPS_PROXY=http://github-egress:3128',
        '--entrypoint',
        'curl',
        config.runnerImageId,
        '--fail',
        '--silent',
        '--show-error',
        '--max-time',
        '10',
        '--output',
        '/dev/null',
        'https://api.github.com/meta',
      ])
    })
    return name
  } catch (error) {
    await removeContainer(name)
    throw error
  }
}

async function startRunner(
  config: Awaited<ReturnType<typeof loadConfig>>,
  candidate: ControllerCandidate,
  jit: JitConfiguration,
  prefix: string,
  network: string,
) {
  const name = `${prefix}-runner`
  const temporary = await mkdtemp(`${tmpdir()}/ha-runner-jit-`)
  const environmentPath = `${temporary}/runner.env`
  await writeFile(
    environmentPath,
    `ACTIONS_RUNNER_JIT_CONFIG=${jit.encoded_jit_config}\n`,
    { mode: 0o600 },
  )
  try {
    await docker([
      'run',
      '--detach',
      '--name',
      name,
      '--hostname',
      jit.runner.name,
      '--network',
      network,
      '--read-only',
      '--cap-drop',
      'ALL',
      '--security-opt',
      'no-new-privileges',
      '--pids-limit',
      '512',
      '--memory',
      '2g',
      '--cpus',
      '2',
      '--mount',
      'type=volume,destination=/home/runner/actions-runner',
      '--tmpfs',
      '/tmp:rw,noexec,nosuid,nodev',
      '--tmpfs',
      '/run/ha-dashboard:rw,noexec,nosuid,nodev,uid=1001,gid=1001',
      '--tmpfs',
      '/home/runner/actions-runner/_diag:rw,noexec,nosuid,nodev,uid=1001,gid=1001',
      '--tmpfs',
      '/home/runner/actions-runner/_work:rw,nosuid,nodev,uid=1001,gid=1001',
      '--env-file',
      environmentPath,
      '--env',
      'HTTP_PROXY=http://github-egress:3128',
      '--env',
      'HTTPS_PROXY=http://github-egress:3128',
      '--env',
      'http_proxy=http://github-egress:3128',
      '--env',
      'https_proxy=http://github-egress:3128',
      '--env',
      'NO_PROXY=localhost,127.0.0.1,ha-ssh-proxy,ha-api-proxy',
      '--env',
      'no_proxy=localhost,127.0.0.1,ha-ssh-proxy,ha-api-proxy',
      '--label',
      `ha-dashboard-run=${candidate.run.id}`,
      '--entrypoint',
      '/opt/ha-dashboard/bin/runner-entrypoint',
      config.runnerImageId,
    ])
  } finally {
    await rm(temporary, { recursive: true, force: true })
  }
  return name
}

async function startHomeAssistantProxy(
  config: Awaited<ReturnType<typeof loadConfig>>,
  prefix: string,
  network: string,
  kind: 'api' | 'ssh',
) {
  const name = `${prefix}-ha-${kind}`
  const listenPort = kind === 'ssh' ? 2222 : 8123
  const targetPort = kind === 'ssh' ? config.haSshPort : config.haApiPort
  try {
    await docker([
      'run',
      '--detach',
      '--name',
      name,
      '--network',
      network,
      '--network-alias',
      `ha-${kind}-proxy`,
      '--read-only',
      '--cap-drop',
      'ALL',
      '--security-opt',
      'no-new-privileges',
      '--tmpfs',
      '/tmp:rw,noexec,nosuid,nodev',
      '--entrypoint',
      'socat',
      config.runnerImageId,
      `TCP-LISTEN:${listenPort},fork,reuseaddr`,
      `TCP:${config.haHost}:${targetPort}`,
    ])
    await docker(['network', 'connect', 'bridge', name])
    await retryProbe(`Home Assistant ${kind} proxy`, async () => {
      await docker([
        'run',
        '--rm',
        '--network',
        network,
        '--read-only',
        '--cap-drop',
        'ALL',
        '--security-opt',
        'no-new-privileges',
        '--entrypoint',
        'node',
        config.runnerImageId,
        '-e',
        "const net=require('node:net');const socket=net.createConnection({host:process.argv[1],port:Number(process.argv[2])},()=>{socket.destroy();process.exit(0)});socket.setTimeout(1000,()=>{socket.destroy();process.exit(1)});socket.on('error',()=>process.exit(1))",
        `ha-${kind}-proxy`,
        String(listenPort),
      ])
    })
    return name
  } catch (error) {
    await removeContainer(name)
    throw error
  }
}

async function authorizeRunner(
  runnerContainer: string,
  candidate: ControllerCandidate,
  runner: JitRunner,
) {
  const authorizationPayload = authorizationForCandidate(candidate)
  const authorization = `${JSON.stringify({
      mode: candidate.kind,
      runId: String(candidate.run.id),
      runAttempt: candidate.run.run_attempt,
      runnerId: runner.id,
      runnerName: runner.name,
      decision: authorizationPayload.decision,
      disposition: authorizationPayload.disposition,
      reason: authorizationPayload.reason,
    })}\n`
  await docker([
    'exec',
    runnerContainer,
    'node',
    '-e',
    "const fs=require('node:fs');const path='/run/ha-dashboard/authorization.json';const temporary=`${path}.${process.pid}.tmp`;fs.writeFileSync(temporary,process.argv[1],{mode:0o400});fs.renameSync(temporary,path)",
    authorization,
  ])
}

async function waitForAssignment(
  config: Awaited<ReturnType<typeof loadConfig>>,
  candidate: ControllerCandidate,
  runner: JitRunner,
) {
  const deadline =
    Date.now() + config.assignmentTimeoutSeconds * 1_000
  while (Date.now() < deadline) {
    const job = await workflowJob(config.repository, candidate.job.id)
    if (!isUnassignedJob(job)) {
      assertExpectedJobBinding(job, runner)
      return job
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 1_000))
  }
  throw new Error('Timed out waiting for the expected workflow job assignment')
}

async function waitForJobCompletion(
  config: Awaited<ReturnType<typeof loadConfig>>,
  candidate: ControllerCandidate,
) {
  const deadline = Date.now() + config.jobTimeoutSeconds * 1_000
  while (Date.now() < deadline) {
    const job = await workflowJob(config.repository, candidate.job.id)
    if (job.status === 'completed') return job
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 2_000))
  }
  throw new Error('Timed out waiting for the deployment workflow job')
}

export function expectedConclusionForAuthorization(
  authorization: { decision: AuthorizationDecision },
) {
  return authorization.decision === 'allow' ? 'success' as const : 'failure' as const
}

export function assertAuthorizedRecoveryBinding(
  job: WorkflowJob,
  expected: {
    kind: CandidateKind
    label: string
    runnerName: string
    jitRunnerId?: number
  },
  runner?: JitRunner,
) {
  assert(
    job.name === expectedJob(expected.kind) &&
      exactJobLabelMatch(job, expected.label),
    `Authorized recovery job ${job.id} no longer matches ${expected.label}`,
  )
  if (runner) {
    assertExpectedRunnerRegistration(runner, expected)
  }
  if (job.status === 'completed') {
    if (!isUnassignedJob(job)) {
      assert(
        job.runner_name === expected.runnerName &&
          (!expected.jitRunnerId || job.runner_id === expected.jitRunnerId),
        `Completed recovery job ${job.id} was bound to an unexpected runner`,
      )
    }
    return
  }
  assert(
    runner,
    `Authorized JIT runner ${expected.runnerName} is missing; operator recovery is required`,
  )
  assertExpectedJobBinding(job, runner)
}

async function captureContainerLogs(
  config: Awaited<ReturnType<typeof loadConfig>>,
  name: string,
  suffix: string,
) {
  const logs = await docker(['logs', name], true)
  const path = resolve(
    config.stateDirectory,
    'logs',
    `${safeIdentifier(suffix)}.log`,
  )
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${logs.stdout}\n${logs.stderr}\n`, { mode: 0o600 })
}

async function cleanup(
  config: Awaited<ReturnType<typeof loadConfig>>,
  containers: readonly string[],
  network: string,
  suffix: string,
) {
  for (const name of containers) {
    await captureContainerLogs(config, name, `${suffix}-${name}`)
      .catch(() => undefined)
  }
  for (const name of [...containers].reverse()) {
    await removeContainer(name)
  }
  await docker(['network', 'rm', network], true)
  const remaining = await docker(['network', 'inspect', network], true)
  assert(
    dockerInspectIsMissing(remaining.stdout),
    `Runner network cleanup failed for ${network}`,
  )
}

async function runCandidate(
  config: Awaited<ReturnType<typeof loadConfig>>,
  candidate: ControllerCandidate,
) {
  await revalidateCandidate(config, candidate)
  await validateControlPlane(config, candidate)
  const authorization = authorizationForCandidate(candidate)
  const prefix = safeIdentifier(
    `ha-jit-${candidate.run.id}-${candidate.run.run_attempt}`,
  )
  const network = `${prefix}-network`
  const runnerName = expectedRunnerName(candidate)
  const baseJournal: ActiveOperationJournal = {
    version: 1,
    phase: 'planned',
    candidate: {
      kind: candidate.kind,
      runId: candidate.run.id,
      runAttempt: candidate.run.run_attempt,
      jobId: candidate.job.id,
      label: candidate.label,
      headSha: candidate.run.head_sha,
    },
    authorization,
    resources: {
      network,
      githubProxy: `${prefix}-github-proxy`,
      runnerContainer: `${prefix}-runner`,
      runnerName,
    },
    updatedAt: new Date().toISOString(),
  }
  let journal = baseJournal
  let networkCreated = false
  let operationFailure: unknown
  await mkdir(config.stateDirectory, { recursive: true, mode: 0o700 })
  try {
    await writeActiveOperation(config, journal)
    const jit = await generateJitConfiguration(
      config.repository,
      config.runnerGroupId,
      candidate,
      runnerName,
    )
    journal = {
      ...journal,
      resources: {
        ...journal.resources,
        jitRunnerId: jit.runner.id,
      },
    }
    await writeActiveOperation(config, journal)
    await docker(['network', 'create', '--internal', network])
    networkCreated = true
    await startGithubProxy(config, prefix, network)
    const runnerContainer = await startRunner(
      config,
      candidate,
      jit,
      prefix,
      network,
    )
    await waitForAssignment(config, candidate, jit.runner)
    journal = {
      ...journal,
      phase: 'assigned',
      resources: {
        ...journal.resources,
      },
    }
    await writeActiveOperation(config, journal)
    if (candidate.kind === 'production' && authorization.decision === 'allow') {
      await revalidateBeforeHomeAssistantAccess(config, candidate, jit.runner)
      await startHomeAssistantProxy(config, prefix, network, 'ssh')
      await startHomeAssistantProxy(config, prefix, network, 'api')
      journal = {
        ...journal,
        phase: 'ha-enabled',
        resources: {
          ...journal.resources,
          sshProxy: `${prefix}-ha-ssh`,
          apiProxy: `${prefix}-ha-api`,
        },
      }
      await writeActiveOperation(config, journal)
    }
    journal = {
      ...journal,
      phase: 'authorized',
      resources: {
        ...journal.resources,
        ...(candidate.kind === 'production' &&
            authorization.decision === 'allow'
          ? { sshProxy: `${prefix}-ha-ssh`, apiProxy: `${prefix}-ha-api` }
          : {}),
      },
    }
    await writeActiveOperation(config, journal)
    await authorizeRunner(runnerContainer, candidate, jit.runner)
    const completed = await waitForJobCompletion(config, candidate)
    const expectedConclusion =
      expectedConclusionForAuthorization(authorization)
    assert(
      completed.conclusion === expectedConclusion,
      `${candidate.job.name} concluded ${String(completed.conclusion)}; expected ${expectedConclusion}`,
    )
    journal = {
      ...journal,
      phase: 'completed',
      resources: {
        ...journal.resources,
        ...(candidate.kind === 'production' &&
            authorization.decision === 'allow'
          ? { sshProxy: `${prefix}-ha-ssh`, apiProxy: `${prefix}-ha-api` }
          : {}),
      },
    }
    await writeActiveOperation(config, journal)
    await writeFile(
      resolve(
        config.stateDirectory,
        `run-${candidate.run.id}-${candidate.run.run_attempt}.json`,
      ),
      `${JSON.stringify({
        version: 1,
        kind: candidate.kind,
        runId: candidate.run.id,
        runAttempt: candidate.run.run_attempt,
        headSha: candidate.run.head_sha,
        jobId: candidate.job.id,
        runnerId: jit.runner.id,
        runnerName: jit.runner.name,
        authorization,
        completedAt: new Date().toISOString(),
      }, null, 2)}\n`,
      { mode: 0o600 },
    )
  } catch (error) {
    operationFailure = error
  }

  const failures: unknown[] = operationFailure ? [operationFailure] : []
  let cleanupIncomplete = false
  if (networkCreated) {
    journal = {
      ...journal,
      phase: 'cleanup',
      resources: {
        ...journal.resources,
        ...(candidate.kind === 'production' &&
            authorization.decision === 'allow'
          ? { sshProxy: `${prefix}-ha-ssh`, apiProxy: `${prefix}-ha-api` }
          : {}),
      },
    }
    await writeActiveOperation(config, journal).catch((error) => failures.push(error))
    await cleanup(
      config,
      resourceContainerNames(journal.resources),
      network,
      `${candidate.run.id}-${candidate.run.run_attempt}`,
    ).catch((error) => {
      cleanupIncomplete = true
      failures.push(error)
    })
  }
  await removeRunnerRegistrationForJournal(
    config,
    journal,
  ).catch((error) => {
    cleanupIncomplete = true
    failures.push(error)
  })
  if (!cleanupIncomplete) {
    await clearActiveOperation(config).catch((error) => {
      cleanupIncomplete = true
      failures.push(error)
    })
  }
  if (failures.length === 1) throw failures[0]
  if (failures.length > 1) {
    throw new AggregateError(
      failures,
      'JIT runner operation or cleanup was incomplete',
    )
  }
}

export async function runControllerOnce(configPath: string) {
  const config = await loadConfig(configPath)
  const releaseLock = await acquireControllerLock(config)
  try {
    await reconcileActiveOperation(config)
    await validateRepositoryIdentity(config)
    const candidate = await findCandidate(config)
    if (!candidate) return false
    await runCandidate(config, candidate)
    return true
  } finally {
    await releaseLock()
  }
}

async function runController(configPath: string) {
  const config = await loadConfig(configPath)
  const releaseLock = await acquireControllerLock(config)
  try {
    await reconcileActiveOperation(config)
    await validateRepositoryIdentity(config)
    for (;;) {
      try {
        const candidate = await findCandidate(config)
        if (candidate) await runCandidate(config, candidate)
      } catch (error) {
        console.error(errorMessage(error))
      }
      await new Promise((resolveDelay) =>
        setTimeout(resolveDelay, config.pollSeconds * 1_000),
      )
    }
  } finally {
    await releaseLock()
  }
}

async function main() {
  const configIndex = process.argv.indexOf('--config')
  const configPath =
    configIndex >= 0 ? process.argv[configIndex + 1] : undefined
  assert(configPath, '--config is required')
  if (process.argv[2] === 'once') {
    await runControllerOnce(configPath)
    return
  }
  if (process.argv[2] === 'run') {
    await runController(configPath)
    return
  }
  throw new Error('Controller command must be run or once')
}

const entryPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : undefined
if (entryPath === import.meta.url) {
  main().catch((error: unknown) => {
    console.error(errorMessage(error))
    process.exitCode = 1
  })
}
