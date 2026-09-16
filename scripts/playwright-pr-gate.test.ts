// @covers .github/workflows/playwright.yml
// @covers .github/skills/release-dashboard/SKILL.md
// @covers vitest.config.ts
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

type PackageJson = {
  scripts: Record<string, string>
}

describe('protected dashboard pull-request gate', () => {
  it('aggregates quality, automated layout, and full Playwright in the protected check', () => {
    const workflow = read('.github/workflows/playwright.yml')
    const packageJson = readJson<PackageJson>('package.json')
    const vitestConfig = read('vitest.config.ts')

    expect(workflow).toContain('pull_request:')
    expect(workflow).toContain('name: Quality checks')
    expect(workflow).toContain('run: npm run check:ci')
    expect(workflow).toContain('name: Automated layout')
    expect(workflow).toContain('layout:verify -- --run artifacts/layout/ci --automated-only')
    expect(workflow).toContain("plan.mode === 'tooling' ? 'chromium' : 'chromium webkit'")
    expect(workflow).toContain('name: layout-automation')
    expect(workflow.match(/Require changed tests for implementation changes/g)).toHaveLength(1)
    expect(workflow).toContain('name: Playwright gate')
    expect(workflow).toContain('needs: [quality, layout, test]')
    expect(workflow).toContain('QUALITY_RESULT: ${{ needs.quality.result }}')
    expect(workflow).toContain('LAYOUT_RESULT: ${{ needs.layout.result }}')
    expect(workflow).toContain('TEST_RESULT: ${{ needs.test.result }}')
    expect(workflow).toContain('Dashboard CI did not pass')

    expect(packageJson.scripts.check).toBe(
      'npm run test:change-policy && npm run check:ci',
    )
    expect(packageJson.scripts['check:ci']).toContain('npm run lint')
    expect(packageJson.scripts['check:ci']).toContain('npm run test:run')
    expect(packageJson.scripts['check:ci']).toContain('npm run build')
    expect(vitestConfig).toContain("process.env.TZ = 'America/Los_Angeles'")
  })

  it('keeps release machine v3 shadow-only without blocking the manual release', () => {
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

    expect(releaseSkill).toContain('authorizes those release operations')
    expect(releaseSkill).toContain('does not replace or block')
    expect(releaseSkill).toContain('Do not make `npm run check`')
    expect(releaseSkill).toContain('layout-automation')
    expect(releaseSkill).toContain('zero-item manual worklist')
    expect(releaseSkill).toContain('gh pr checks --watch --fail-fast')
    expect(releaseSkill).toContain('/sfenton-react-dash/home')
    expect(releaseSkill).toContain('/sfenton-react-panel')
    expect(releaseSkill).toContain('model: gpt-5.6-luna')
    expect(releaseSkill).not.toContain('blocked: release-machine-disabled')
    expect(releaseSkill).not.toContain('Do not fall back to the former manual')

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
