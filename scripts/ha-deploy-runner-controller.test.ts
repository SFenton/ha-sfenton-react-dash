import {
  assertExpectedJobBinding,
  assertJitRunnerLabels,
  expectedRunnerLabel,
  isUnassignedJob,
  jitConfigurationRequest,
  selectControllerCandidate,
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
})
