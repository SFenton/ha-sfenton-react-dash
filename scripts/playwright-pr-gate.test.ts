import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const read = (path: string) => readFileSync(resolve(path), 'utf8')

describe('Playwright pull-request gate', () => {
  it('exposes one aggregate check that fails when any shard does not pass', () => {
    const workflow = read('.github/workflows/playwright.yml')

    expect(workflow).toContain('pull_request:')
    expect(workflow).toContain('name: Playwright gate')
    expect(workflow).toContain('TEST_RESULT: ${{ needs.test.result }}')
    expect(workflow).toContain('if [[ "$TEST_RESULT" != "success" ]]')
  })

  it('runs changed and added tests locally while keeping the full suite in CI', () => {
    const releaseSkill = read('.github/skills/release-dashboard/SKILL.md')

    expect(releaseSkill).toContain('run every test file changed or added by the release scope')
    expect(releaseSkill).toContain('npm run test:run -- <paths>')
    expect(releaseSkill).toContain('npm run test:e2e -- <paths>')
    expect(releaseSkill).toMatch(/Do not run the\s+unchanged full Playwright suite locally as a release or merge gate/)
    expect(releaseSkill).toContain('gh pr checks --watch --fail-fast')
    expect(releaseSkill).toContain('`Playwright gate` check is')
  })

  it('retries isolated CI flakes once without changing local runs', () => {
    const config = read('playwright.config.ts')

    expect(config).toContain('retries: process.env.CI ? 1 : 0')
  })
})
