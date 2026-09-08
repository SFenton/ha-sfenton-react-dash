import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { artifactPath, assertOptions, isEntry, option, readJson, snapshot } from './layout/shared'
import type { RunIdentity } from '../e2e/layout/types'
import { verifyServedBuild } from './layout/run'

const require = createRequire(import.meta.url)
const playwrightCli = require.resolve('@playwright/test/cli')

export const APPROVED_WEATHER_RENDER_MIGRATION_BASE = 'ab84f9a8789381b982d79b53eeecdc5d191a3d48'

export function restoreSourceDeclaredBackdropFilters(css: string) {
  const repairs: Array<{ selector: string; value: string }> = []
  const restored = css.replace(/([^{}]+)\{([^{}]*)\}/g, (whole, selector: string, declarations: string) => {
    const prefixed = declarations.match(/(?:^|;)\s*-webkit-backdrop-filter\s*:\s*([^;]+)/)
    if (!prefixed || /(?:^|;)\s*backdrop-filter\s*:/.test(declarations)) return whole
    repairs.push({ selector, value: prefixed[1] })
    return `${selector}{${declarations.replace(/;?$/, ';')}backdrop-filter:${prefixed[1]}}`
  })
  return { css: restored, repairs }
}

export function normalizedUrl(value: string | undefined, label: string) {
  if (!value) throw new Error(`Missing ${label}. Pass ${label === 'baseline URL' ? '--baseline' : '--candidate'} or set the matching RESPONSIVE_*_URL environment variable.`)
  const url = new URL(value)
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error(`${label} must use http or https`)
  if (!['127.0.0.1', '[::1]'].includes(url.hostname) || url.username || url.password || url.search || url.hash) throw new Error(`${label} must be an owned loopback URL without credentials or query parameters`)
  return url.href.replace(/\/$/, '')
}

export function selectedParityRoutes(raw: string | undefined, known: readonly string[]) {
  const requested = raw === undefined ? [...known] : raw.split(',').map((route) => route.trim())
  if (!requested.length || requested.some((route) => !route)) throw new Error('Required parity route selection is empty')
  if (new Set(requested).size !== requested.length) throw new Error('Duplicate parity routes')
  const unknown = requested.filter((route) => !known.includes(route))
  if (unknown.length) throw new Error(`Unknown parity routes: ${unknown.join(', ')}`)
  return requested
}

async function run() {
  const args = process.argv.slice(2)
  assertOptions(args, ['--baseline', '--candidate', '--run'])
  const runPath = option(args, '--run') ?? process.env.LAYOUT_RUN_DIR
  if (!runPath) throw new Error('Source-attested required parity needs --run artifacts/layout/<run-id> with active owned servers. Prefer layout:run, which supplies and verifies these automatically.')
  const directory = artifactPath(process.cwd(), runPath, true)
  const identity = readJson<RunIdentity>(resolve(directory, 'run.json'))
  const baselineUrl = normalizedUrl(option(args, '--baseline') ?? identity.baseline.origin, 'baseline URL')
  const candidateUrl = normalizedUrl(option(args, '--candidate') ?? identity.candidate.origin, 'candidate URL')
  if (baselineUrl === candidateUrl) throw new Error('Baseline and candidate must use distinct owned endpoints')
  if (baselineUrl !== identity.baseline.origin || candidateUrl !== identity.candidate.origin) throw new Error('Parity endpoints do not match the owned run provenance')
  if (snapshot(process.cwd(), identity.source.base).digest !== identity.source.digest) throw new Error('Parity source is stale')
  await Promise.all([
    verifyServedBuild(identity.baseline), verifyServedBuild(identity.candidate),
  ])

  const child = spawn(process.execPath, [
    playwrightCli,
    'test',
    'e2e/mobile-parity-all-routes.spec.ts',
    '--project=mobile',
    '--workers=1',
    '--forbid-only',
  ], {
    env: {
      ...process.env,
      LAYOUT_RUN_DIR: directory,
      RESPONSIVE_BASELINE_URL: baselineUrl,
      RESPONSIVE_CANDIDATE_URL: candidateUrl,
      RESPONSIVE_PARITY_REQUIRED: '1',
    },
    stdio: 'inherit',
  })

  const exitCode = await new Promise<number>((resolve, reject) => {
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (signal) reject(new Error(`Mobile parity was terminated by ${signal}`))
      else resolve(code ?? 1)
    })
  })
  process.exitCode = exitCode
}

if (isEntry(import.meta.url)) {
  void run().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
