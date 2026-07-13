import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { config, parse } from 'dotenv'

export interface RuntimeEnvironmentOptions {
  emailEnvPath?: string
}

export function loadRuntimeEnvironment(options: RuntimeEnvironmentOptions = {}) {
  loadIfPresent(resolve(process.cwd(), '.env.development'))
  loadIfPresent(resolve(process.cwd(), '.env'))

  const emailEnvPath = options.emailEnvPath
    ? resolve(process.cwd(), options.emailEnvPath)
    : resolve(process.cwd(), '../day-trader-agent/.env')
  loadEmailIfPresent(emailEnvPath)
}

function loadIfPresent(path: string) {
  if (existsSync(path)) config({ path, quiet: true })
}

function loadEmailIfPresent(path: string) {
  if (!existsSync(path)) return
  const values = parse(readFileSync(path))
  for (const [key, value] of Object.entries(values)) {
    if (!key.startsWith('HASS_AUTONOMY_EMAIL_') && !key.startsWith('DAY_TRADER_EMAIL_')) continue
    process.env[key] ??= value
  }
}
