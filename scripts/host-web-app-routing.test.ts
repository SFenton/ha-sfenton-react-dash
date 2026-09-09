import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const read = (path: string) => readFileSync(resolve(path), 'utf8')

const skill = read('.github/skills/host-web-app/SKILL.md')
const hostInstructions = read('.github/instructions/host-web-app.instructions.md')
const rootInstructions = read('.github/copilot-instructions.md')
const dashboardContract = read('.github/reference/dashboard-contract.md')
const hassPortingAgent = read('.github/agents/hass-porting.agent.md')

describe('host-web-app routing contract', () => {
  it('advertises ordinary server and manual-validation prompts as skill triggers', () => {
    const description = skill.match(/^description:\s*(.+)$/m)?.[1] ?? ''

    for (const phrase of ['start', 'serve', 'preview', 'manual', 'phone', 'tablet']) {
      expect(description.toLowerCase()).toContain(phrase)
    }
    expect(skill).toContain('LAN-specific wording is not required.')
    expect(skill).toContain('Explicit `/host-web-app` invocation always wins.')
  })

  it('keeps the trigger in always-loaded and detailed repository contracts', () => {
    for (const contract of [rootInstructions, dashboardContract]) {
      expect(contract).toContain('start, run, serve, host, open, or preview')
      expect(contract).toContain('unless the operator opts out')
    }
    expect(rootInstructions).toContain('as a `/host-web-app` trigger')
    expect(dashboardContract).toContain('Do not substitute a')
    expect(dashboardContract).toContain('loopback-only listener')
  })

  it('requires HASS Porting to invoke the skill or follow its safe fallback', () => {
    expect(hassPortingAgent).toContain('Invoke `/host-web-app` whenever the operator asks')
    expect(hassPortingAgent).toContain('`0.0.0.0`, strict first-free port from `5176`')
    expect(hassPortingAgent).toContain('Do not start an ad hoc')
    expect(hassPortingAgent).toContain('loopback-only dev server')
  })

  it('preserves the shared runtime safety requirements', () => {
    for (const contract of [skill, hostInstructions]) {
      expect(contract).toContain('current requested worktree')
      expect(contract).toContain('VITE_HA_TOKEN')
      expect(contract).toContain('0.0.0.0')
      expect(contract).toContain('5176')
      expect(contract).toContain('strict')
      expect(contract).toContain('real app backend')
    }
  })
})
