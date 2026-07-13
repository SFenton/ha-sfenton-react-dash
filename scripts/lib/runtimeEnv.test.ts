import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadRuntimeEnvironment } from './runtimeEnv'

describe('runtime environment loading', () => {
  afterEach(() => {
    delete process.env.DAY_TRADER_EMAIL_SMTP_PASSWORD
    delete process.env.UNRELATED_SOURCE_SECRET
  })

  it('imports only email variables from the shared source env file', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'hass-admin-env-'))
    const envPath = join(directory, '.env')
    await writeFile(envPath, [
      'DAY_TRADER_EMAIL_SMTP_PASSWORD=email-secret',
      'UNRELATED_SOURCE_SECRET=must-not-load',
    ].join('\n'))

    try {
      loadRuntimeEnvironment({ emailEnvPath: envPath })
      expect(process.env.DAY_TRADER_EMAIL_SMTP_PASSWORD).toBe('email-secret')
      expect(process.env.UNRELATED_SOURCE_SECRET).toBeUndefined()
    } finally {
      await rm(directory, { force: true, recursive: true })
    }
  })
})
