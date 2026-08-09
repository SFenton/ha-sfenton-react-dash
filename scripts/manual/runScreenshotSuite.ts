import { spawnSync } from 'node:child_process'
import { createServer } from 'node:net'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { MANUAL_SCREENSHOTS } from '../../src/manual/screenshots'

export const MANUAL_SCREENSHOT_SHARD_COUNT = MANUAL_SCREENSHOTS.length
export const MANUAL_SCREENSHOT_PROJECTS = ['manual-mobile', 'manual-desktop'] as const

export function manualScreenshotShardRuns(shardCount = MANUAL_SCREENSHOT_SHARD_COUNT) {
  return MANUAL_SCREENSHOT_PROJECTS.flatMap((project) => (
    Array.from({ length: shardCount }, (_, index) => ({
      project,
      shard: `${index + 1}/${shardCount}`,
    }))
  ))
}

function availableLoopbackPort() {
  return new Promise<number>((resolvePort, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        server.close()
        reject(new Error('Could not allocate a loopback port for the screenshot server.'))
        return
      }
      server.close((error) => {
        if (error) reject(error)
        else resolvePort(address.port)
      })
    })
  })
}

function runNodeScript(scriptPath: string, args: string[], env = process.env, quiet = false) {
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: process.cwd(),
    env,
    encoding: quiet ? 'utf8' : undefined,
    stdio: quiet ? 'pipe' : 'inherit',
  })
  if (result.error) throw result.error
  if (result.status !== 0) {
    if (quiet) {
      if (result.stdout) process.stdout.write(result.stdout)
      if (result.stderr) process.stderr.write(result.stderr)
    }
    process.exit(result.status ?? 1)
  }
}

async function runPlaywrightShard(playwrightCli: string, args: string[]) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const port = await availableLoopbackPort()
    const result = spawnSync(process.execPath, [playwrightCli, ...args], {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: {
        ...process.env,
        PLAYWRIGHT_PORT: String(port),
        PLAYWRIGHT_PREBUILT_MOCK: '1',
      },
      stdio: 'pipe',
    })
    if (result.error) throw result.error
    if (result.status === 0) return
    if (attempt < 3) {
      console.warn(`Screenshot shard failed on attempt ${attempt}; retrying with a fresh browser and server.`)
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 1_000))
      continue
    }
    if (result.stdout) process.stdout.write(result.stdout)
    if (result.stderr) process.stderr.write(result.stderr)
    process.exit(result.status ?? 1)
  }
}

export async function runManualScreenshotSuite(updateSnapshots = false) {
  runNodeScript(resolve('node_modules/vite/bin/vite.js'), [
    'build',
    '--mode',
    'test',
    '--outDir',
    '.playwright-dist',
  ])

  const playwrightCli = resolve('node_modules/@playwright/test/cli.js')
  const runs = manualScreenshotShardRuns()
  for (const [index, run] of runs.entries()) {
    const args = [
      'test',
      'e2e/manual-screenshots.spec.ts',
      `--project=${run.project}`,
      '--fully-parallel',
      '--workers=1',
      `--shard=${run.shard}`,
    ]
    if (updateSnapshots) args.push('--update-snapshots')
    await runPlaywrightShard(playwrightCli, args)
    if ((index + 1) % 10 === 0 || index + 1 === runs.length) {
      console.log(`Verified ${index + 1}/${runs.length} screenshot shards.`)
    }
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : ''
if (import.meta.url === invokedPath) {
  await runManualScreenshotSuite(process.argv.includes('--update-snapshots'))
}
