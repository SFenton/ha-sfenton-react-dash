import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const playwrightCli = require.resolve('@playwright/test/cli')

function optionValue(name: string) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

function normalizedUrl(value: string | undefined, label: string) {
  if (!value) throw new Error(`Missing ${label}. Pass ${label === 'baseline URL' ? '--baseline' : '--candidate'} or set the matching RESPONSIVE_*_URL environment variable.`)
  const url = new URL(value)
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error(`${label} must use http or https`)
  return url.href.replace(/\/$/, '')
}

async function assertReachable(baseUrl: string, label: string) {
  const response = await fetch(`${baseUrl}/index.html?path=overview`, {
    redirect: 'follow',
    signal: AbortSignal.timeout(5_000),
  })
  if (!response.ok) throw new Error(`${label} returned HTTP ${response.status}`)
}

async function run() {
  const baselineUrl = normalizedUrl(optionValue('--baseline') ?? process.env.RESPONSIVE_BASELINE_URL, 'baseline URL')
  const candidateUrl = normalizedUrl(optionValue('--candidate') ?? process.env.RESPONSIVE_CANDIDATE_URL, 'candidate URL')
  await Promise.all([
    assertReachable(baselineUrl, 'Baseline URL'),
    assertReachable(candidateUrl, 'Candidate URL'),
  ])

  const child = spawn(process.execPath, [
    playwrightCli,
    'test',
    'e2e/mobile-parity-all-routes.spec.ts',
    '--project=mobile',
    '--workers=1',
    ...process.argv.slice(2).filter((argument, index, args) =>
      !['--baseline', '--candidate'].includes(argument)
      && !(['--baseline', '--candidate'].includes(args[index - 1] ?? '')),
    ),
  ], {
    env: {
      ...process.env,
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

void run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
