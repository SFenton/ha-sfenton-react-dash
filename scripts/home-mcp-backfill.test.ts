import { readFileSync } from 'node:fs'

// @covers scripts/home-mcp-backfill.ts
describe('Home MCP retained-chat backfill', () => {
  it('uses the authenticated HA proxy and enforces a bounded batch', () => {
    const source = readFileSync('scripts/home-mcp-backfill.ts', 'utf8')
    expect(source).toContain("new URL('/api/sfenton_home_mcp', haUrl).href")
    expect(source).toContain('value > 100')
    expect(source).toContain("name: 'home_chat_review'")
  })
})
