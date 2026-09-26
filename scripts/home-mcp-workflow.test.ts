// @covers .github/workflows/home-mcp.yml
// @covers home-mcp/docker-compose.yml
// @covers home-mcp/docker-compose.production.yml
// @covers .env.example
// @covers package.json
import { readFileSync } from 'node:fs'

it('keeps authenticated Home MCP gates but never starts the retired chat feedback worker', () => {
  const scripts = (JSON.parse(readFileSync('package.json', 'utf8')) as { scripts: Record<string, string> }).scripts
  expect(scripts).toHaveProperty('home-mcp:check')
  expect(scripts).toHaveProperty('home-mcp:publish')
  for (const command of [
    'home-mcp:corpus:lights', 'home-mcp:corpus:lights:validate', 'home-mcp:regressions:validate',
    'home-mcp:improvements:worker', 'home-mcp:improvements:install', 'home-mcp:improvements:backfill',
  ]) expect(scripts).not.toHaveProperty(command)

  const workflow = readFileSync('.github/workflows/home-mcp.yml', 'utf8')
  expect(workflow).toContain('npm run home-mcp:check')
  expect(workflow).toContain('npm run test:run -- home-mcp')
  expect(workflow).not.toContain('home-mcp:regressions:validate')
  expect(workflow).not.toContain('home-mcp:corpus:lights:validate')

  for (const path of ['home-mcp/docker-compose.yml', 'home-mcp/docker-compose.production.yml', '.env.example']) {
    const config = readFileSync(path, 'utf8')
    expect(config).not.toMatch(/HOME_MCP_(?:AGENT_ID|CHAT_MODEL|IMPROVEMENT_|AUTO_PUBLISH)/)
  }
  const production = readFileSync('home-mcp/docker-compose.production.yml', 'utf8')
  expect(production).not.toContain('./data:/data')
  expect(production).toContain('./tls:/tls:ro')
})
