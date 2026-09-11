import { readFileSync } from 'node:fs'
import { X509Certificate } from 'node:crypto'

const proxy = readFileSync('home-assistant/custom_components/sfenton_home_mcp_proxy/__init__.py', 'utf8')
const packageYaml = readFileSync('home-assistant/packages/sfenton_home_mcp_proxy.yaml', 'utf8')

// @covers home-assistant/custom_components/sfenton_home_mcp_proxy/__init__.py
// @covers home-assistant/custom_components/sfenton_home_mcp_proxy/manifest.json
// @covers home-assistant/packages/sfenton_home_mcp_proxy.yaml
describe('Home MCP Home Assistant proxy', () => {
  it('requires an authenticated HA user and pins the TLS certificate', () => {
    expect(proxy).toContain('KEY_HASS_USER')
    expect(proxy).toContain('hass.async_add_executor_job')
    expect(proxy).toContain('partial(ssl.create_default_context, cafile=PINNED_CERTIFICATE)')
    expect(proxy).toContain('ssl=self._ssl_context')
    expect(proxy).not.toContain('DEFAULT_URL = "http://')
    expect(packageYaml).toContain('url: https://192.168.1.155:8787/mcp')
    const certificate = new X509Certificate(readFileSync('home-assistant/custom_components/sfenton_home_mcp_proxy/home-mcp-server.crt'))
    expect(certificate.checkIP('192.168.1.155')).toBe('192.168.1.155')
  })
})
