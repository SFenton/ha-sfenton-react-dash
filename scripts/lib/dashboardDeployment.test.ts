import { legacyDashboardUrl, updateLegacyDashboardConfig, validatePanelRegistration } from './dashboardDeployment'

describe('dashboard deployment', () => {
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
