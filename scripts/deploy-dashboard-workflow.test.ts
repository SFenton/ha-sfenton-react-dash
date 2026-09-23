// @covers .github/workflows/deploy-dashboard.yml
// @covers ops/ha-deploy-runner/Dockerfile
// @covers ops/ha-deploy-runner/runner-entrypoint.sh
// @covers ops/ha-deploy-runner/start-github-proxy.sh
// @covers ops/ha-deploy-runner/squid.conf
// @covers ops/ha-deploy-runner/controller.json.example
// @covers ops/ha-deploy-runner/ha-dashboard-runner-controller.service
// @covers .github/skills/release-dashboard/SKILL.md
// @covers .dockerignore
// @covers docs/deployment.md
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const read = (path: string) => readFileSync(resolve(path), 'utf8')

describe('dashboard deployment workflow', () => {
  it('runs independently on every master push without waiting for layout', () => {
    const workflow = read('.github/workflows/deploy-dashboard.yml')

    expect(workflow).toContain('name: Deploy dashboard')
    expect(workflow).toContain('push:')
    expect(workflow).toContain('branches: [master]')
    expect(workflow).toContain('workflow_dispatch:')
    expect(workflow).not.toContain('paths:')
    expect(workflow).not.toContain('workflow_run')
    expect(workflow).not.toContain('layout-automation')
    expect(workflow).not.toContain('playwright.yml')
    expect(workflow).toContain('group: ha-dashboard-production')
    expect(workflow).toContain('cancel-in-progress: false')
    expect(workflow).toContain('queue: max')
  })

  it('keeps build credentials separate from the production JIT job', () => {
    const workflow = read('.github/workflows/deploy-dashboard.yml')
    const buildStart = workflow.indexOf('  build:')
    const smokeStart = workflow.indexOf('  controller-smoke:')
    const deployStart = workflow.indexOf('  deploy:')
    const build = workflow.slice(buildStart, smokeStart)
    const smoke = workflow.slice(smokeStart, deployStart)
    const deploy = workflow.slice(deployStart)

    expect(build).toContain('runs-on: ubuntu-latest')
    expect(build).toContain("VITE_HA_TOKEN: ''")
    expect(build).toContain("VITE_HOME_MCP_ENABLED: 'false'")
    expect(build).not.toContain('HA_DEPLOY_TOKEN')
    expect(build).not.toContain('environment: production')

    expect(smoke).toContain("format('ha-deploy-smoke-{0}-{1}'")
    expect(smoke).not.toContain('environment: production')
    expect(smoke).not.toContain('HA_DEPLOY_TOKEN')

    expect(deploy).toContain('environment: production')
    expect(deploy).toContain("format('ha-deploy-production-{0}-{1}'")
    expect(deploy).toContain('deploy-dashboard-ci.mjs admit')
    expect(deploy.indexOf('deploy-dashboard-ci.mjs admit')).toBeLessThan(
      deploy.indexOf('actions/download-artifact'),
    )
    expect(deploy.indexOf('actions/download-artifact')).toBeLessThan(
      deploy.indexOf('HA_DEPLOY_TOKEN: ${{ secrets.HA_DEPLOY_TOKEN }}'),
    )
    expect(deploy).toContain('HA_DEPLOY_TOKEN: ${{ secrets.HA_DEPLOY_TOKEN }}')
    expect(deploy).toContain('HA_DEPLOY_SSH_PRIVATE_KEY: ${{ secrets.HA_DEPLOY_SSH_PRIVATE_KEY }}')
    expect(deploy).toContain('if: always()')
    expect(deploy).not.toContain('actions/checkout')
    expect(deploy).not.toContain('npm ci')
  })

  it('pins all external actions and the runner distribution', () => {
    const workflow = read('.github/workflows/deploy-dashboard.yml')
    const dockerfile = read('ops/ha-deploy-runner/Dockerfile')
    const actionReferences = [...workflow.matchAll(/uses:\s+([^@\s]+)@([a-f0-9]+)/g)]

    expect(actionReferences.length).toBeGreaterThan(0)
    for (const [, , revision] of actionReferences) {
      expect(revision).toMatch(/^[a-f0-9]{40}$/)
    }
    expect(dockerfile).toContain('RUNNER_VERSION=2.337.0')
    expect(dockerfile).toContain(
      '70920811a4f8ad4328818682bca5c6469c1c942fab52448868071d0063816613',
    )
    expect(dockerfile).toContain('USER runner')
    expect(dockerfile).toContain('sha256:48e4b67d85f87bd551df43704e24d252f56cc5f8e9718841aace50f19948f0f9')
  })

  it('keeps the runner quarantined behind an allowlisted proxy', () => {
    const proxy = read('ops/ha-deploy-runner/squid.conf')
    const service = read(
      'ops/ha-deploy-runner/ha-dashboard-runner-controller.service',
    )
    const runner = read('ops/ha-deploy-runner/runner-entrypoint.sh')

    expect(proxy).toContain('http_access allow github')
    expect(proxy).toContain('http_access deny all')
    expect(proxy).not.toContain('192.168.1.22')
    expect(service).toContain('NoNewPrivileges=true')
    expect(service).toContain('Restart=always')
    expect(runner).toContain(
      'exec ./bin/Runner.Listener run --jitconfig "$ACTIONS_RUNNER_JIT_CONFIG"',
    )
  })

  it('documents automatic frontend ownership and the manual HA fallback', () => {
    const deployment = read('docs/deployment.md')

    expect(deployment).toContain('post-merge layout workflow is independent')
    expect(deployment).toContain('never receives `VITE_HA_TOKEN`')
    expect(deployment).toContain('Home Assistant runtime changes')
    expect(deployment).toContain('/sfenton-react-dash/home')
    expect(deployment).toContain('/sfenton-react-panel')
    expect(deployment).toContain('smoke-only')
    expect(deployment).toContain('workflow digest is a deliberate trust boundary')
    expect(read('.github/skills/release-dashboard/SKILL.md')).toContain(
      'Never rotate trust to an unmerged candidate or PR head',
    )
  })
})
