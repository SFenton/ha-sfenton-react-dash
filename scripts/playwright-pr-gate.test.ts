import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const read = (path: string) => readFileSync(resolve(path), 'utf8')
const readJson = <T>(path: string) => JSON.parse(read(path)) as T

type ReleaseMachine = {
  version: number
  enabled: boolean
  operatorAuthorizationRequired: boolean
  steps: Array<{
    id: string
    tool: string
    rollbackVerificationTool?: string
  }>
}

type AgentToolRegistry = {
  tools: Array<{
    id: string
    kind: string
    sideEffect: string
  }>
}

describe('Playwright pull-request gate', () => {
  it('exposes one aggregate check that fails when any shard does not pass', () => {
    const workflow = read('.github/workflows/playwright.yml')

    expect(workflow).toContain('pull_request:')
    expect(workflow).toContain('name: Playwright gate')
    expect(workflow).toContain('TEST_RESULT: ${{ needs.test.result }}')
    expect(workflow).toContain('if [[ "$TEST_RESULT" != "success" ]]')
  })

  it('treats release-dashboard as disabled-machine scope review only', () => {
    const releaseSkill = read('.github/skills/release-dashboard/SKILL.md')
    const machine = readJson<ReleaseMachine>('.github/release-machine.json')
    const toolRegistry = readJson<AgentToolRegistry>('.github/agent-tools.json')
    const tools = new Map(toolRegistry.tools.map((tool) => [tool.id, tool]))
    const referencedToolIds = Array.from(
      new Set(
        machine.steps.flatMap((step) =>
          step.rollbackVerificationTool
            ? [step.tool, step.rollbackVerificationTool]
            : [step.tool],
        ),
      ),
    )

    const activeReleaseMachineTools = {
      'release-validate-scope': 'workspace',
      'release-validate-change': 'workspace',
      'release-verify-layout': 'workspace',
      'release-affected-playwright': 'workspace',
      'release-build-merged': 'workspace',
      'release-verify-git-rollback': 'workspace',
    } as const
    const disabledReleaseMachineTools = {
      'release-git-driver': 'github',
      'release-rollback-git': 'github',
      'capture-production-disabled': 'production',
      'deploy-dashboard-disabled': 'production',
      'verify-production-disabled': 'production',
      'rollback-dashboard-disabled': 'production',
      'verify-production-rollback-disabled': 'production',
      'release-dashboard-cleanup-disabled': 'production',
    } as const
    const disabledProductionCandidates = {
      'capture-production-candidate': 'production',
      'deploy-dashboard-candidate': 'production',
      'verify-production-candidate': 'production',
      'rollback-dashboard-candidate': 'production',
      'verify-production-rollback-candidate': 'production',
      'release-dashboard-cleanup-candidate': 'production',
    } as const

    const disabledRepositoryAndProductionSteps = {
      'create-merge-pr': 'release-git-driver',
      'rollback-git': 'release-rollback-git',
      'capture-production': 'capture-production-disabled',
      'deploy-both-hosts': 'deploy-dashboard-disabled',
      'verify-production': 'verify-production-disabled',
      'rollback-production': 'rollback-dashboard-disabled',
      'cleanup-release': 'release-dashboard-cleanup-disabled',
    } as const

    expect(releaseSkill).toContain('requests release scope review')
    expect(releaseSkill).toContain(
      'Registered deterministic local validation and build',
    )
    expect(releaseSkill).toContain('GitHub mutation and rollback drivers stay disabled')
    expect(releaseSkill).toContain('GitHub mutation steps stay unavailable')
    expect(releaseSkill).toContain('must still resolve to disabled tooling')
    expect(releaseSkill).toContain('Return `blocked: release-machine-disabled`')
    expect(releaseSkill).toContain('Do not fall back to the former manual Git/PR/deploy procedure')
    expect(releaseSkill).toContain('`gpt-5.4` medium/default')
    expect(releaseSkill).toContain('`ha-release-rollback-or-host-conflict`')

    expect(machine.version).toBe(3)
    expect(machine.enabled).toBe(false)
    expect(machine.operatorAuthorizationRequired).toBe(true)
    expect(referencedToolIds).not.toHaveLength(0)
    expect(referencedToolIds.filter((toolId) => !tools.has(toolId))).toEqual([])

    for (const [toolId, sideEffect] of Object.entries(activeReleaseMachineTools)) {
      expect(tools.get(toolId)).toMatchObject({
        id: toolId,
        kind: 'command',
        sideEffect,
      })
    }

    for (const [toolId, sideEffect] of Object.entries(disabledReleaseMachineTools)) {
      expect(tools.get(toolId)).toMatchObject({
        id: toolId,
        kind: 'disabled',
        sideEffect,
      })
    }

    for (const [toolId, sideEffect] of Object.entries(disabledProductionCandidates)) {
      expect(tools.get(toolId)).toMatchObject({
        id: toolId,
        kind: 'disabled',
        sideEffect,
      })
    }

    for (const [stepId, toolId] of Object.entries(disabledRepositoryAndProductionSteps)) {
      const step = machine.steps.find((candidate) => candidate.id === stepId)
      expect(step?.tool).toBe(toolId)
      expect(tools.get(toolId)).toMatchObject({
        id: toolId,
        kind: 'disabled',
        sideEffect:
          toolId === 'release-git-driver' || toolId === 'release-rollback-git'
            ? 'github'
            : 'production',
      })
    }

    expect(
      machine.steps.find((step) => step.id === 'rollback-production')
        ?.rollbackVerificationTool,
    ).toBe('verify-production-rollback-disabled')
    expect(tools.get('verify-production-rollback-disabled')).toMatchObject({
      id: 'verify-production-rollback-disabled',
      kind: 'disabled',
      sideEffect: 'production',
    })

    expect(
      toolRegistry.tools.filter(
        (tool) =>
          tool.kind === 'command' &&
          tool.sideEffect === 'production' &&
          tool.id !== 'release-shadow-plan',
      ),
    ).toEqual([])
  })

  it('retries isolated CI flakes once without changing local runs', () => {
    const config = read('playwright.config.ts')

    expect(config).toContain('retries: process.env.CI ? 1 : 0')
  })
})
