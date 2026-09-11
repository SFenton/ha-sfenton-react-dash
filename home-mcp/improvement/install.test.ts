import { improvementSystemdUnits } from './install'

describe('Home MCP improvement worker installation', () => {
  it('creates a serial path-triggered worker with automatic publish enabled', () => {
    const units = improvementSystemdUnits({
      dataDir: '/srv/home-mcp/data',
      deployRoot: '/srv/home-mcp',
      repoRoot: '/srv/home-mcp/improver-repo',
      npmPath: '/usr/bin/npm',
      copilotPath: '/usr/bin/copilot',
      autoPublish: true,
    })

    expect(units.service).toContain('Type=oneshot')
    expect(units.service).toContain('HOME_MCP_AUTO_PUBLISH=true')
    expect(units.service).toContain('HOME_MCP_IMPROVEMENT_MODEL=gpt-5.6-sol')
    expect(units.service).toContain('ExecStartPre=/usr/bin/git -C /srv/home-mcp/improver-repo fetch origin master')
    expect(units.service).toContain('ExecStartPre=/usr/bin/git -C /srv/home-mcp/improver-repo reset --hard origin/master')
    expect(units.path).toContain('PathChanged=/srv/home-mcp/data/inbox')
    expect(units.timer).toContain('OnUnitActiveSec=5m')
  })

  it('defaults unattended publishing off', () => {
    const units = improvementSystemdUnits({
      dataDir: '/srv/home-mcp/data',
      deployRoot: '/srv/home-mcp',
      repoRoot: '/srv/home-mcp/improver-repo',
      npmPath: '/usr/bin/npm',
      copilotPath: '/usr/bin/copilot',
    })
    expect(units.service).toContain('HOME_MCP_AUTO_PUBLISH=false')
  })
})
