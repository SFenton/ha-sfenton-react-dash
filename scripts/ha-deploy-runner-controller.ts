import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const DEFAULT_REPOSITORY = 'SFenton/ha-sfenton-react-dash'
const PRODUCTION_JOB = 'Deploy dashboard'
const SMOKE_JOB = 'Controller smoke'
const BUILD_JOB = 'Build dashboard artifact'

type ControllerMode = 'smoke-only' | 'production'
type CandidateKind = 'smoke' | 'production'

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

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function sha256(value: string | Buffer) {
  return createHash('sha256').update(value).digest('hex')
}

function safeIdentifier(value: string) {
  return value.replace(/[^a-zA-Z0-9_.-]/g, '-').slice(0, 100)
}

export function expectedRunnerLabel(
  kind: CandidateKind,
  runId: number,
  runAttempt: number,
) {
  return `ha-deploy-${kind}-${runId}-${runAttempt}`
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
  const candidates = []
  for (const run of runs) {
    for (const kind of kinds) {
      if (
        run.path !== options.workflowPath ||
        run.event !== expectedEvent(kind) ||
        run.head_branch !== 'master' ||
        (kind === 'smoke' && run.head_sha !== options.masterSha) ||
        !['queued', 'in_progress'].includes(run.status) ||
        run.conclusion
      ) {
        continue
      }
      const jobs = jobsByRun.get(run.id) ?? []
      if (
        kind === 'production' &&
        !jobs.some(
          (job) =>
            job.name === BUILD_JOB &&
            job.status === 'completed' &&
            job.conclusion === 'success',
        )
      ) {
        continue
      }
      const label = expectedRunnerLabel(kind, run.id, run.run_attempt)
      const job = jobs.find(
        (candidate) =>
          candidate.name === expectedJob(kind) &&
          candidate.status === 'queued' &&
          candidate.conclusion === null &&
          isUnassignedJob(candidate) &&
          candidate.labels.length === 1 &&
          candidate.labels[0] === label,
      )
      if (job) candidates.push({ kind, run, job, label })
    }
  }
  return candidates.sort((left, right) =>
    Date.parse(left.run.created_at) - Date.parse(right.run.created_at),
  )[0]
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
    return { stdout: result.stdout.trim(), stderr: result.stderr.trim() }
  } catch (error) {
    if (options.allowFailure) {
      const failure = error as {
        stdout?: string
        stderr?: string
      }
      return {
        stdout: failure.stdout?.trim() ?? '',
        stderr: failure.stderr?.trim() ?? '',
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
  const result = await ghApi<{ workflow_runs: WorkflowRun[] }>(
    `repos/${repository}/actions/workflows/${encodeURIComponent(workflowFile)}/runs?branch=master&per_page=100`,
  )
  return result.workflow_runs
}

async function workflowJobs(repository: string, runId: number) {
  const result = await ghApi<{ jobs: WorkflowJob[] }>(
    `repos/${repository}/actions/runs/${runId}/jobs?filter=latest&per_page=100`,
  )
  return result.jobs
}

async function workflowJob(repository: string, jobId: number) {
  return ghApi<WorkflowJob>(
    `repos/${repository}/actions/jobs/${jobId}`,
  )
}

async function generateJitConfiguration(
  repository: string,
  runnerGroupId: number,
  candidate: ControllerCandidate,
) {
  const runnerName = safeIdentifier(
    `${candidate.label}-${Date.now().toString(36)}`,
  )
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
    !result.stderr || result.stderr.includes('HTTP 404'),
    `Could not remove JIT runner registration ${runnerId}: ${result.stderr}`,
  )
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
      run.head_sha === masterSha &&
      ['push', 'workflow_dispatch'].includes(run.event) &&
      ['queued', 'in_progress'].includes(run.status)
    ) {
      jobsByRun.set(run.id, await workflowJobs(config.repository, run.id))
    }
  }
  return selectControllerCandidate(runs, jobsByRun, {
    masterSha,
    mode: config.mode,
    workflowPath: config.workflowPath,
  })
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
      config.runnerImage,
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
        config.runnerImage,
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
      config.runnerImage,
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
      config.runnerImage,
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
        config.runnerImage,
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
  const temporary = await mkdtemp(`${tmpdir()}/ha-runner-auth-`)
  const path = `${temporary}/authorization.json`
  await writeFile(
    path,
    `${JSON.stringify({
      mode: candidate.kind,
      runId: String(candidate.run.id),
      runAttempt: candidate.run.run_attempt,
      runnerId: runner.id,
      runnerName: runner.name,
    })}\n`,
    { mode: 0o644 },
  )
  try {
    await docker([
      'cp',
      path,
      `${runnerContainer}:/run/ha-dashboard/authorization.json`,
    ])
  } finally {
    await rm(temporary, { recursive: true, force: true })
  }
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
  await validateControlPlane(config, candidate)
  const jit = await generateJitConfiguration(
    config.repository,
    config.runnerGroupId,
    candidate,
  )
  const prefix = safeIdentifier(
    `ha-jit-${candidate.run.id}-${candidate.run.run_attempt}`,
  )
  const network = `${prefix}-network`
  const containers: string[] = []
  let networkCreated = false
  let operationFailure: unknown
  await mkdir(config.stateDirectory, { recursive: true, mode: 0o700 })
  try {
    await docker(['network', 'create', '--internal', network])
    networkCreated = true
    containers.push(await startGithubProxy(config, prefix, network))
    const runnerContainer = await startRunner(
      config,
      candidate,
      jit,
      prefix,
      network,
    )
    containers.push(runnerContainer)
    await waitForAssignment(config, candidate, jit.runner)
    if (candidate.kind === 'production') {
      containers.push(
        await startHomeAssistantProxy(config, prefix, network, 'ssh'),
      )
      containers.push(
        await startHomeAssistantProxy(config, prefix, network, 'api'),
      )
    }
    await authorizeRunner(runnerContainer, candidate, jit.runner)
    const completed = await waitForJobCompletion(config, candidate)
    assert(
      completed.conclusion === 'success',
      `${candidate.job.name} concluded ${String(completed.conclusion)}`,
    )
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
        completedAt: new Date().toISOString(),
      }, null, 2)}\n`,
      { mode: 0o600 },
    )
  } catch (error) {
    operationFailure = error
  }

  const failures: unknown[] = operationFailure ? [operationFailure] : []
  if (networkCreated) {
    await cleanup(
      config,
      containers,
      network,
      `${candidate.run.id}-${candidate.run.run_attempt}`,
    ).catch((error) => failures.push(error))
  }
  await removeRunnerRegistration(
    config.repository,
    jit.runner.id,
  ).catch((error) => failures.push(error))
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
  await validateRepositoryIdentity(config)
  const candidate = await findCandidate(config)
  if (!candidate) return false
  await runCandidate(config, candidate)
  return true
}

async function runController(configPath: string) {
  const config = await loadConfig(configPath)
  await validateRepositoryIdentity(config)
  for (;;) {
    try {
      const candidate = await findCandidate(config)
      if (candidate) await runCandidate(config, candidate)
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error))
    }
    await new Promise((resolveDelay) =>
      setTimeout(resolveDelay, config.pollSeconds * 1_000),
    )
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
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
