import { mkdtemp, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  admissionForAttempt,
  acquireControllerLockFile,
  assertAuthorizedRecoveryBinding,
  authorizationForCandidate,
  assertExpectedJobBinding,
  assertExpectedRunnerRegistration,
  assertJitRunnerLabels,
  candidateCompareStatusAllowsMasterLine,
  dockerInspectIsMissing,
  expectedRunnerLabel,
  expectedRunnerName,
  expectedConclusionForAuthorization,
  isUnassignedJob,
  jitConfigurationRequest,
  recoveryDispositionForPhase,
  selectControllerCandidate,
  writeActiveOperationFile,
  type WorkflowJob,
  type WorkflowRun,
} from './ha-deploy-runner-controller'

function run(
  overrides: Partial<WorkflowRun> = {},
): WorkflowRun {
  return {
    id: 123,
    path: '.github/workflows/deploy-dashboard.yml',
    event: 'push',
    head_branch: 'master',
    head_sha: 'a'.repeat(40),
    run_attempt: 2,
    status: 'in_progress',
    conclusion: null,
    created_at: '2026-09-19T20:00:00Z',
    ...overrides,
  }
}

function job(
  overrides: Partial<WorkflowJob> = {},
): WorkflowJob {
  return {
    id: 456,
    name: 'Deploy dashboard',
    status: 'queued',
    conclusion: null,
    runner_id: null,
    runner_name: null,
    labels: [expectedRunnerLabel('production', 123, 2)],
    ...overrides,
  }
}

describe('HA deploy runner controller', () => {
  it('selects only the exact queued master deployment with a successful build', () => {
    const selected = selectControllerCandidate(
      [run()],
      new Map([[123, [
        job({
          id: 1,
          name: 'Build dashboard artifact',
          status: 'completed',
          conclusion: 'success',
          labels: ['ubuntu-latest'],
        }),
        job(),
      ]]]),
      {
        masterSha: 'a'.repeat(40),
        mode: 'production',
        workflowPath: '.github/workflows/deploy-dashboard.yml',
      },
    )
    expect(selected).toMatchObject({
      kind: 'production',
      label: 'ha-deploy-production-123-2',
      job: { id: 456 },
    })
  })

  it('keeps queued master pushes deployable while rejecting mismatched jobs', () => {
    const options = {
      masterSha: 'a'.repeat(40),
      mode: 'production' as const,
      workflowPath: '.github/workflows/deploy-dashboard.yml',
    }
    const successfulBuild = job({
      id: 1,
      name: 'Build dashboard artifact',
      status: 'completed',
      conclusion: 'success',
      labels: ['ubuntu-latest'],
    })
    expect(
      selectControllerCandidate(
        [run({ head_sha: 'b'.repeat(40) })],
        new Map([[123, [successfulBuild, job()]]]),
        options,
      ),
    ).toMatchObject({ kind: 'production', run: { head_sha: 'b'.repeat(40) } })
    expect(
      selectControllerCandidate(
        [run()],
        new Map([[123, [
          successfulBuild,
          job({ labels: ['self-hosted', 'ha-deploy-production-123-2'] }),
        ]]]),
        options,
      ),
    ).toBeUndefined()
    expect(
      selectControllerCandidate(
        [run({ event: 'pull_request' })],
        new Map([[123, [successfulBuild, job()]]]),
        options,
      ),
    ).toBeUndefined()
  })

  it('ignores terminal history and non-runnable pending deploy jobs', () => {
    const options = {
      masterSha: 'a'.repeat(40),
      mode: 'production' as const,
      workflowPath: '.github/workflows/deploy-dashboard.yml',
    }
    const successfulBuild = job({
      id: 1,
      name: 'Build dashboard artifact',
      status: 'completed',
      conclusion: 'success',
      labels: ['ubuntu-latest'],
    })
    const selected = selectControllerCandidate(
      [
        run({
          id: 90,
          status: 'completed',
          conclusion: 'success',
        }),
        run({ id: 91 }),
      ],
      new Map([
        [90, [successfulBuild, job({ id: 900 })]],
        [91, [
          successfulBuild,
          job({
            id: 901,
            status: 'pending',
            labels: [expectedRunnerLabel('production', 91, 2)],
          }),
          job({
            id: 902,
            labels: [expectedRunnerLabel('production', 91, 2)],
          }),
        ]],
      ]),
      options,
    )
    expect(selected?.job.id).toBe(902)
  })

  it('fails closed when deployment jobs are ambiguous or undocumented', () => {
    const options = {
      masterSha: 'a'.repeat(40),
      mode: 'production' as const,
      workflowPath: '.github/workflows/deploy-dashboard.yml',
    }
    const successfulBuild = job({
      id: 1,
      name: 'Build dashboard artifact',
      status: 'completed',
      conclusion: 'success',
      labels: ['ubuntu-latest'],
    })
    expect(() =>
      selectControllerCandidate(
        [run({
          id: 100,
          created_at: '2026-09-19T19:00:00Z',
        }), run({
          id: 101,
          created_at: '2026-09-19T20:00:00Z',
        })],
        new Map([
          [100, [successfulBuild, job({ id: 10, labels: [expectedRunnerLabel('production', 100, 2)] })]],
          [101, [successfulBuild, job({ id: 11, labels: [expectedRunnerLabel('production', 101, 2)] })]],
        ]),
        options,
      ),
    ).toThrow('Multiple runnable deployment jobs')

    expect(
      selectControllerCandidate(
        [run({
          id: 102,
          created_at: '2026-09-19T21:00:00Z',
        })],
        new Map([
          [102, [successfulBuild, job({
            id: 12,
            status: 'waiting',
            labels: [expectedRunnerLabel('production', 102, 2)],
          })]],
        ]),
        options,
      ),
    ).toBeUndefined()

    expect(() =>
      selectControllerCandidate(
        [run({
          id: 103,
          created_at: '2026-09-19T21:00:00Z',
        })],
        new Map([
          [103, [successfulBuild, job({
            id: 13,
            status: 'mystery',
            labels: [expectedRunnerLabel('production', 103, 2)],
          })]],
        ]),
        options,
      ),
    ).toThrow('unsupported Deploy dashboard status mystery')
  })

  it('selects a secretless smoke job in smoke-only mode', () => {
    const smokeRun = run({
      event: 'workflow_dispatch',
      status: 'queued',
    })
    const selected = selectControllerCandidate(
      [smokeRun],
      new Map([[123, [job({
        name: 'Controller smoke',
        labels: [expectedRunnerLabel('smoke', 123, 2)],
      })]]]),
      {
        masterSha: 'a'.repeat(40),
        mode: 'smoke-only',
        workflowPath: '.github/workflows/deploy-dashboard.yml',
      },
    )
    expect(selected?.kind).toBe('smoke')
    expect(
      selectControllerCandidate(
        [run({
          event: 'workflow_dispatch',
          head_sha: 'b'.repeat(40),
          status: 'queued',
        })],
        new Map([[123, [job({
          name: 'Controller smoke',
          labels: [expectedRunnerLabel('smoke', 123, 2)],
        })]]]),
        {
          masterSha: 'a'.repeat(40),
          mode: 'smoke-only',
          workflowPath: '.github/workflows/deploy-dashboard.yml',
        },
      ),
    ).toBeUndefined()
  })

  it('accepts both GitHub representations of an unassigned job', () => {
    expect(isUnassignedJob(job())).toBe(true)
    expect(isUnassignedJob(job({
      runner_id: 0,
      runner_name: '',
    }))).toBe(true)
    expect(isUnassignedJob(job({
      runner_id: 42,
      runner_name: 'runner-42',
    }))).toBe(false)
  })

  it('recognizes Docker inspect output for removed resources', () => {
    expect(dockerInspectIsMissing('')).toBe(true)
    expect(dockerInspectIsMissing('[]')).toBe(true)
    expect(dockerInspectIsMissing('[{"Id":"still-present"}]')).toBe(false)
  })

  it('requires a JIT runner to expose only its per-run label', () => {
    const runner = {
      id: 42,
      name: 'runner-42',
      labels: [{ name: 'ha-deploy-production-123-2' }],
    }
    expect(() =>
      assertJitRunnerLabels(runner, 'ha-deploy-production-123-2'),
    ).not.toThrow()
    expect(() =>
      assertJitRunnerLabels({
        ...runner,
        labels: [{ name: 'self-hosted' }, ...runner.labels],
      }, 'ha-deploy-production-123-2'),
    ).toThrow('not exclusive')
    expect(() =>
      assertExpectedRunnerRegistration(runner, {
        label: 'ha-deploy-production-123-2',
        runnerName: 'runner-42',
        jitRunnerId: 42,
      }),
    ).not.toThrow()
    expect(() =>
      assertExpectedRunnerRegistration(runner, {
        label: 'ha-deploy-production-123-2',
        runnerName: 'runner-42',
        jitRunnerId: 43,
      }),
    ).toThrow('changed identity')
  })

  it('binds JIT registration to the configured runner group', () => {
    expect(
      jitConfigurationRequest(
        'runner-42',
        'ha-deploy-production-123-2',
        1,
      ),
    ).toEqual({
      name: 'runner-42',
      runner_group_id: 1,
      labels: ['ha-deploy-production-123-2'],
      work_folder: '_work',
    })
    expect(() =>
      jitConfigurationRequest('runner-42', 'label', 0),
    ).toThrow('runner group ID')
  })

  it('binds authorization to the exact GitHub runner identity', () => {
    expect(() =>
      assertExpectedJobBinding(job({
        runner_id: 42,
        runner_name: 'runner-42',
      }), {
        id: 42,
        name: 'runner-42',
        labels: [{ name: 'ha-deploy-production-123-2' }],
      }),
    ).not.toThrow()
    expect(() =>
      assertExpectedJobBinding(job({
        runner_id: 43,
        runner_name: 'other',
      }), {
        id: 42,
        name: 'runner-42',
        labels: [{ name: 'ha-deploy-production-123-2' }],
      }),
    ).toThrow('not bound')
  })

  it('classifies production admission and rejection authorization', () => {
    const successfulBuild = job({
      id: 1,
      name: 'Build dashboard artifact',
      status: 'completed',
      conclusion: 'success',
      labels: ['ubuntu-latest'],
    })
    expect(admissionForAttempt('production', [successfulBuild])).toEqual({
      decision: 'allow',
    })
    expect(
      authorizationForCandidate({
        kind: 'production',
        admission: {
          decision: 'full-rerun-required',
          reason: 'rerun all jobs',
        },
      }),
    ).toEqual({
      decision: 'reject',
      disposition: 'full-rerun-required',
      reason: 'rerun all jobs',
    })
    expect(
      expectedConclusionForAuthorization({ decision: 'allow' }),
    ).toBe('success')
    expect(
      expectedConclusionForAuthorization({ decision: 'reject' }),
    ).toBe('failure')
  })

  it('resumes only the exact authorized runner and permits terminal cleanup after JIT removal', () => {
    const label = expectedRunnerLabel('production', 123, 2)
    const runner = {
      id: 42,
      name: 'ha-jit-production-123-2-456',
      labels: [{ name: label }],
    }
    expect(() =>
      assertAuthorizedRecoveryBinding(
        job({
          status: 'in_progress',
          runner_id: runner.id,
          runner_name: runner.name,
        }),
        {
          kind: 'production',
          label,
          runnerName: runner.name,
          jitRunnerId: runner.id,
        },
        runner,
      ),
    ).not.toThrow()
    expect(() =>
      assertAuthorizedRecoveryBinding(
        job({
          status: 'completed',
          conclusion: 'success',
          runner_id: runner.id,
          runner_name: runner.name,
        }),
        {
          kind: 'production',
          label,
          runnerName: runner.name,
          jitRunnerId: runner.id,
        },
      ),
    ).not.toThrow()
    expect(() =>
      assertAuthorizedRecoveryBinding(
        job({
          status: 'in_progress',
          runner_id: runner.id,
          runner_name: runner.name,
        }),
        {
          kind: 'production',
          label,
          runnerName: runner.name,
          jitRunnerId: runner.id,
        },
      ),
    ).toThrow('is missing')
  })

  it('accepts only compare statuses that keep master ahead or identical', () => {
    expect(candidateCompareStatusAllowsMasterLine('ahead')).toBe(true)
    expect(candidateCompareStatusAllowsMasterLine('identical')).toBe(true)
    expect(candidateCompareStatusAllowsMasterLine('behind')).toBe(false)
  })

  it('writes the active-operation journal atomically with deterministic recovery helpers', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ha-controller-journal-'))
    const path = join(root, 'active-operation.json')
    try {
      await writeActiveOperationFile(path, {
        version: 1,
        phase: 'planned',
        candidate: {
          kind: 'production',
          runId: 1,
          runAttempt: 2,
          jobId: 3,
          label: expectedRunnerLabel('production', 1, 2),
          headSha: 'a'.repeat(40),
        },
        authorization: {
          decision: 'allow',
        },
        resources: {
          network: 'ha-jit-1-2-network',
          githubProxy: 'ha-jit-1-2-github-proxy',
          runnerContainer: 'ha-jit-1-2-runner',
          runnerName: expectedRunnerName({
            kind: 'production',
            run: { id: 1, run_attempt: 2 },
            job: { id: 3 },
          }),
        },
        updatedAt: '2026-09-19T21:00:00.000Z',
      })
      const entries = await readdir(root)
      expect(entries).toEqual(['active-operation.json'])
      expect((await stat(path)).mode & 0o777).toBe(0o600)
      expect(JSON.parse(await readFile(path, 'utf8'))).toMatchObject({
        resources: {
          runnerName: 'ha-jit-production-1-2-3',
        },
      })
      expect(recoveryDispositionForPhase('planned')).toBe('cleanup-pre-ha')
      expect(recoveryDispositionForPhase('authorized')).toBe('resume-authorized')
      expect(recoveryDispositionForPhase('assigned')).toBe('operator-recovery')
    } finally {
      await import('node:fs/promises').then(({ rm }) =>
        rm(root, { recursive: true, force: true }),
      )
    }
  })

  it('recovers a stale controller lock but rejects a live owner', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ha-controller-lock-'))
    const path = join(root, 'controller.lock')
    try {
      await writeFile(path, JSON.stringify({ pid: 2_147_483_647 }))
      const release = await acquireControllerLockFile(path)
      expect(JSON.parse(await readFile(path, 'utf8'))).toMatchObject({
        pid: process.pid,
      })
      await expect(acquireControllerLockFile(path))
        .rejects.toThrow('already held')
      await release()
      await expect(stat(path)).rejects.toThrow()
    } finally {
      await import('node:fs/promises').then(({ rm }) =>
        rm(root, { recursive: true, force: true }),
      )
    }
  })
})
