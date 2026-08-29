import { Buffer } from 'node:buffer'
import {
  assertDashboardResourceAvailable,
  legacyCardResourceUrl,
  legacyDashboardUrl,
  updateLegacyCardResource,
  updateLegacyDashboardConfig,
  validatePanelRegistration,
} from './dashboardDeployment'

describe('dashboard deployment', () => {
  it('preflights a deployed dashboard resource and falls back when HEAD is unsupported', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 405 }))
      .mockResolvedValueOnce(new Response(null, { status: 206 }))

    await expect(assertDashboardResourceAvailable(
      'https://ha.example',
      '/local/dashboard.js?v=123',
      'test-token',
      fetchImpl,
    )).resolves.toBeUndefined()
    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      new URL('https://ha.example/local/dashboard.js?v=123'),
      expect.objectContaining({ method: 'HEAD' }),
    )
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      new URL('https://ha.example/local/dashboard.js?v=123'),
      expect.objectContaining({
        headers: expect.objectContaining({ Range: 'bytes=0-0' }),
        method: 'GET',
      }),
    )
  })

  it('fails resource preflight without exposing the access token', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(null, { status: 404 }),
    )

    await expect(assertDashboardResourceAvailable(
      'https://ha.example',
      '/local/missing.js',
      'secret-token',
      fetchImpl,
    )).rejects.toThrow(
      'Dashboard resource /local/missing.js is unavailable (HTTP 404).',
    )
  })

  it('rejects a Home Assistant HTML fallback for a missing JavaScript resource', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('<html></html>', {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
        status: 200,
      }),
    )

    await expect(assertDashboardResourceAvailable(
      'https://ha.example',
      '/local/dashboard.js',
      'test-token',
      fetchImpl,
    )).rejects.toThrow(
      'Dashboard resource /local/dashboard.js returned HTML instead of JavaScript.',
    )
  })

  it('updates only the legacy wrapper URL', () => {
    const source = {
      views: [{
        cards: [{
          type: 'custom:sfenton-react-app-card',
          url: '/local/ha-sfenton-react-dash/index.html?v=old',
        }],
        title: 'Home',
      }],
    }

    const result = updateLegacyDashboardConfig(source, 'abc123-dirty')

    expect(result).toMatchObject({
      changed: true,
      url: '/local/ha-sfenton-react-dash/index.html?v=abc123-dirty',
    })
    expect(result.config.views[0]).toMatchObject({ title: 'Home' })
    expect(source.views[0].cards[0].url).toContain('v=old')
  })

  it('does not save an already-current wrapper config', () => {
    const url = legacyDashboardUrl('abc123')
    const config = {
      views: [{
        cards: [{
          type: 'custom:sfenton-react-app-card',
          url,
        }],
      }],
    }

    expect(updateLegacyDashboardConfig(config, 'abc123')).toEqual({
      changed: false,
      config,
      url,
    })
  })

  it('fails closed when the existing dashboard shape is unexpected', () => {
    expect(() => updateLegacyDashboardConfig({ views: [{ cards: [{ type: 'markdown' }] }] }, 'abc123')).toThrow(
      'does not use the expected wrapper card',
    )
  })

  it('migrates the inline legacy card resource to the deployed module', () => {
    const inlineSource = "customElements.define('sfenton-react-app-card', class extends HTMLElement {})"
    const resources = [{
      id: 'resource-id',
      type: 'module',
      url: `https://resources.example/${Buffer.from(inlineSource).toString('base64')}?type=module`,
    }]

    expect(updateLegacyCardResource(resources, 'abc123-dirty')).toEqual({
      changed: true,
      previousUrl: resources[0].url,
      resourceId: 'resource-id',
      url: '/local/ha-sfenton-react-dash/sfenton-react-app-card.js?v=abc123-dirty',
    })
  })

  it('does not update an already-current legacy card module', () => {
    const url = legacyCardResourceUrl('abc123')
    expect(updateLegacyCardResource([{
      id: 'resource-id',
      type: 'module',
      url,
    }], 'abc123')).toEqual({
      changed: false,
      previousUrl: url,
      resourceId: 'resource-id',
      url,
    })
  })

  it('fails closed when the legacy card resource cannot be identified uniquely', () => {
    expect(() => updateLegacyCardResource([{
      id: 'invalid-resource',
      type: 'module',
      url: 'https://[',
    }], 'abc123')).toThrow(
      'Expected one sfenton-react-app-card resource, found 0',
    )
  })

  it('accepts only the expected embedded custom panel registration', () => {
    expect(validatePanelRegistration({
      'sfenton-react-panel': {
        component_name: 'custom',
        config: {
          _panel_custom: {
            embed_iframe: true,
            name: 'sfenton-react-panel',
          },
        },
      },
    })).toMatchObject({ component_name: 'custom' })

    expect(() => validatePanelRegistration({})).toThrow('is not registered')
  })
})
