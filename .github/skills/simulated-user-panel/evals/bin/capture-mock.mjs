import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import process from 'node:process'
import { chromium } from '@playwright/test'

function parseArgs(argv) {
  const result = {}
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]
    if (!value.startsWith('--')) continue
    const key = value.slice(2)
    const next = argv[index + 1]
    result[key] = next && !next.startsWith('--') ? argv[++index] : true
  }
  return result
}

function run(command, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    })
    let stdout = ''
    let stderr = ''
    child.stdout?.on('data', (chunk) => { stdout += chunk })
    child.stderr?.on('data', (chunk) => { stderr += chunk })
    child.on('error', reject)
    child.on('exit', (code, signal) => {
      if (code === 0) resolvePromise({ code, signal, stdout, stderr })
      else reject(new Error(`${command} exited with ${code ?? signal}\n${stderr}`))
    })
  })
}

async function waitForServer(url, timeoutMs = 30000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url)
      if (response.ok) return
    } catch {
      // Keep waiting for the loopback server.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 200))
  }
  throw new Error(`Timed out waiting for ${url}`)
}

const args = parseArgs(process.argv.slice(2))
const root = process.cwd()
const routePath = String(args.route ?? '/index.html?path=settings')
const expectedHeading = String(args.heading ?? 'Settings')
const outputDir = resolve(root, String(args.out ?? 'artifacts/simulated-user-panel-evals/capture'))
const port = Number(args.port ?? 5198)
const origin = `http://127.0.0.1:${port}`
const viteBin = resolve(root, 'node_modules/vite/bin/vite.js')
const previewConfig = resolve(root, '.github/skills/simulated-user-panel/evals/preview.no-proxy.config.mjs')

await mkdir(outputDir, { recursive: true })
await run(process.execPath, [
  viteBin,
  'build',
  '--mode',
  'test',
  '--outDir',
  '.playwright-dist',
], { cwd: root })

const preview = spawn(process.execPath, [
  viteBin,
  'preview',
  '--config',
  previewConfig,
  '--host',
  '127.0.0.1',
  '--port',
  String(port),
  '--strictPort',
], {
  cwd: root,
  env: process.env,
  stdio: ['ignore', 'pipe', 'pipe'],
})

let previewOutput = ''
preview.stdout.on('data', (chunk) => { previewOutput += chunk })
preview.stderr.on('data', (chunk) => { previewOutput += chunk })

let browser
try {
  await waitForServer(origin)
  browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 393, height: 852 } })
  const blocked = []
  const requests = []
  const blockedPrefixes = ['/api', '/local', '/webrtc', '/hacsfiles', '/__evershelf', '/assets/valetudo']

  await context.route('**/*', async (route) => {
    const requestUrl = new URL(route.request().url())
    const sameOrigin = requestUrl.origin === origin
    const riskyPath = blockedPrefixes.some((prefix) => requestUrl.pathname.startsWith(prefix))
    if (!sameOrigin || riskyPath) {
      blocked.push({ method: route.request().method(), url: requestUrl.toString() })
      await route.abort()
      return
    }
    await route.continue()
  })

  const page = await context.newPage()
  page.on('request', (request) => {
    requests.push({
      method: request.method(),
      resourceType: request.resourceType(),
      url: request.url(),
    })
  })

  await page.goto(`${origin}${routePath}`, { waitUntil: 'networkidle' })
  await page.getByRole('heading', { level: 1, name: expectedHeading }).waitFor({
    state: 'visible',
    timeout: 30000,
  })
  const preflight = await page.evaluate(() => ({
    callsArray: Array.isArray(window.__mockHass?.calls),
    hasMock: Boolean(window.__mockHass),
    hasReset: typeof window.__mockHass?.reset === 'function',
  }))
  if (!preflight.hasMock || !preflight.callsArray || !preflight.hasReset) {
    throw new Error(`Mock preflight failed: ${JSON.stringify(preflight)}`)
  }

  const controls = await page.locator('button, a, [role="button"]').evaluateAll((elements) => elements
    .filter((element) => {
      const style = window.getComputedStyle(element)
      const box = element.getBoundingClientRect()
      return style.visibility !== 'hidden' && style.display !== 'none' && box.width > 0 && box.height > 0
    })
    .map((element) => {
      const box = element.getBoundingClientRect()
      return {
        ariaLabel: element.getAttribute('aria-label'),
        box: [box.x, box.y, box.width, box.height],
        role: element.getAttribute('role') || element.tagName.toLowerCase(),
        text: element.textContent?.replace(/\s+/g, ' ').trim() ?? '',
      }
    }))

  const visibleText = await page.locator('body').innerText()
  const screenshotPath = resolve(outputDir, 'page.png')
  await page.screenshot({ path: screenshotPath, fullPage: true })

  const probePaths = ['/webrtc/webrtc-camera.js', '/local/images/apps/eval-probe.png', '/api/eval-probe']
  const proxyProbes = []
  for (const path of probePaths) {
    const response = await fetch(`${origin}${path}`, { redirect: 'manual' })
    const contentType = response.headers.get('content-type') ?? ''
    const body = await response.text()
    proxyProbes.push({
      contentType,
      isSpaFallback: contentType.includes('text/html') && /<!doctype html>/i.test(body),
      path,
      status: response.status,
    })
  }

  const externalRequests = requests.filter((request) => new URL(request.url).origin !== origin)
  const capture = {
    blocked,
    controls,
    externalRequests,
    origin,
    preflight,
    previewOutput,
    proxyProbes,
    requests,
    routePath,
    screenshot: screenshotPath,
    visibleText,
  }
  await writeFile(resolve(outputDir, 'capture.json'), `${JSON.stringify(capture, null, 2)}\n`)

  if (externalRequests.length > 0) throw new Error('External browser requests were observed.')
  if (proxyProbes.some((probe) => probe.status !== 404 && !probe.isSpaFallback)) {
    throw new Error(`No-proxy probes failed: ${JSON.stringify(proxyProbes)}`)
  }
  console.log(JSON.stringify({
    blockedRequests: blocked.length,
    controls: controls.length,
    externalRequests: externalRequests.length,
    outputDir,
    preflight,
    proxyProbes,
  }, null, 2))
} finally {
  await browser?.close()
  if (!preview.killed) preview.kill('SIGTERM')
}
