import { buildCopilotChildEnvironment } from './copilotEnvironment'

describe('Copilot child environment', () => {
  it('passes only required runtime values and excludes unrelated credentials', () => {
    const environment = buildCopilotChildEnvironment({
      DAY_TRADER_BROKER_API_KEY: 'must-not-pass',
      DAY_TRADER_EMAIL_SMTP_PASSWORD: 'must-not-pass',
      HOME: '/home/test',
      LC_TIME: 'en_US.UTF-8',
      PATH: '/usr/bin',
      VITE_HA_TOKEN: 'ha-secret',
      VITE_HA_URL: 'http://ha.local:8123',
    })

    expect(environment).toEqual({
      HOME: '/home/test',
      LC_TIME: 'en_US.UTF-8',
      PATH: '/usr/bin',
      VITE_HA_TOKEN: 'ha-secret',
      VITE_HA_URL: 'http://ha.local:8123',
    })
  })
})
