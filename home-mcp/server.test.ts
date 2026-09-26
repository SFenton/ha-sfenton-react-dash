import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadRuntimeEnvironment } from '../scripts/lib/runtimeEnv'
import { createHomeMcpServer } from './app'

vi.mock('../scripts/lib/runtimeEnv', () => ({ loadRuntimeEnvironment: vi.fn() }))
vi.mock('./app', () => ({ createHomeMcpServer: vi.fn(() => ({ listen: vi.fn() })) }))

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  vi.resetModules()
})

describe('Home MCP runtime', () => {
  it('ignores legacy chat and improvement flags without scheduling an analysis sweep', async () => {
    vi.stubEnv('HOME_MCP_IMPROVEMENT_ENABLED', 'true')
    vi.stubEnv('HOME_MCP_AUTO_PUBLISH', 'true')
    vi.stubEnv('HOME_MCP_IMPROVEMENT_DATA_DIR', '/unused-improvement-data')
    vi.stubEnv('HOME_MCP_IMPROVEMENT_QUIET_MS', '1')
    vi.stubEnv('HOME_MCP_TLS_CERT', '')
    vi.stubEnv('HOME_MCP_TLS_KEY', '')
    vi.stubEnv('HOME_MCP_HA_URL', 'https://ha.test')
    vi.stubEnv('HOME_MCP_AGENT_ID', 'conversation.legacy')
    vi.stubEnv('HOME_MCP_HOST', '127.0.0.1')
    vi.stubEnv('HOME_MCP_PORT', '8787')
    vi.stubEnv('HOME_MCP_ALLOWED_ORIGINS', '')

    const interval = vi.spyOn(globalThis, 'setInterval')
    await import('./server')

    expect(loadRuntimeEnvironment).toHaveBeenCalledOnce()
    const createServer = vi.mocked(createHomeMcpServer)
    expect(createServer).toHaveBeenCalledWith({
      hassUrl: 'https://ha.test',
      allowedOrigins: [],
      tls: undefined,
    })
    expect(createServer.mock.results[0]?.value.listen).toHaveBeenCalledWith(8787, '127.0.0.1', expect.any(Function))
    expect(interval).not.toHaveBeenCalled()
  })

  // @covers home-mcp/improvement/validate-regressions.ts
  it('removes completed-conversation workers but keeps the manual publisher', () => {
    for (const entry of ['worker.ts', 'install.ts', 'validate-regressions.ts']) {
      expect(existsSync(resolve('home-mcp/improvement', entry))).toBe(false)
    }
    expect(existsSync(resolve('home-mcp/improvement/publish.ts'))).toBe(true)
  })
})
