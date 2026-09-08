import { chromium, expect, webkit, type Frame, type Locator } from '@playwright/test'
import { mkdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { CONTEXTS, requireScenarios, SURFACE_CONTRACTS, type ContextId } from '../../e2e/layout/contracts'
import { applyHostProfile, enterState, openHost, openSurface } from '../../e2e/layout/app'
import { applyProfile, actualCapabilities, waitForModalReady, waitForRoute } from '../../e2e/layout/evidence'
import { guardContext } from '../../e2e/layout/fixture'
import { openChatState } from '../../e2e/chat-layout'
import { openQuickLinksTab } from '../../e2e/quick-links'
import { layoutProfile } from '../../e2e/responsive-acceptance-data'
import type { BuildIdentity, LayoutPlan, RunIdentity } from '../../e2e/layout/types'
import { assertCurrentPlan } from './plan'
import { safeEnvironment, verifyServedBuild } from './run'
import { artifactPath, assertOptions, hash, isEntry, option, readJson, relativeArtifact, writeJson } from './shared'

export async function review(args: string[], root: string) {
  assertOptions(args, ['--run', '--scenario', '--state', '--context', '--profiles'], ['--terminal', '--interact'])
  const input = option(args, '--run')
  if (!input) throw new Error('Provide --run artifacts/layout/<run-id>')
  const directory = artifactPath(root, input, true)
  const plan = readJson<LayoutPlan>(resolve(directory, 'plan.json'))
  const run = readJson<RunIdentity>(resolve(directory, 'run.json'))
  assertCurrentPlan(root, plan)
  const server = readJson<BuildIdentity & { runId: string }>(resolve(directory, 'review-server.json'))
  if (server.runId !== run.runId || server.digest !== run.candidate.digest || server.source !== plan.source.digest) throw new Error('Review server is not bound to this run')
  await verifyServedBuild(server)
  const scenario = requireScenarios([option(args, '--scenario') ?? ''])[0]
  const state = option(args, '--state') ?? SURFACE_CONTRACTS[scenario].states[0]
  if (!SURFACE_CONTRACTS[scenario].states.includes(state)) throw new Error(`Unknown state: ${scenario}/${state}`)
  const contextId = (option(args, '--context') ?? 'touch-chromium') as ContextId
  const contextConfig = CONTEXTS[contextId]
  if (!contextConfig || !plan.contexts.includes(contextId)) throw new Error('Context is not in the declared plan')
  const profiles = option(args, '--profiles')?.split(',') ?? ['island-phone-portrait', 'island-phone-landscape-left', 'island-phone-landscape-right', 'island-phone-portrait']
  if (!profiles.length || profiles.length > 24) throw new Error('Provide 1–24 named profiles')
  for (const profile of profiles) layoutProfile(profile)
  const output = artifactPath(root, resolve(directory, 'manual-replays', `${scenario}-${state}-${randomUUID()}`))
  mkdirSync(output, { recursive: true })
  const browser = await (contextConfig.browser === 'webkit' ? webkit : chromium).launch({
    env: Object.fromEntries(Object.entries(safeEnvironment(root, directory)).filter((entry): entry is [string, string] => typeof entry[1] === 'string')),
    ...(contextConfig.browser === 'webkit' && process.env.PLAYWRIGHT_WEBKIT_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_WEBKIT_EXECUTABLE } : {}),
  })
  const browserContext = await browser.newContext({
    baseURL: server.origin, isMobile: contextConfig.touch, hasTouch: contextConfig.touch, deviceScaleFactor: 1,
    viewport: layoutProfile(profiles[0]).viewport, serviceWorkers: 'block', locale: 'en-US', timezoneId: 'America/Los_Angeles',
  })
  const violations: string[] = []
  await guardContext(browserContext, [server.origin], violations)
  const actions: string[] = []
  const captures: Array<Record<string, unknown>> = []
  try {
    const page = await browserContext.newPage()
    if (scenario === 'form' && contextConfig.touch) await page.addInitScript(() => {
      Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 1 })
      Object.defineProperty(window, 'visualViewport', {
        configurable: true,
        value: Object.assign(new EventTarget(), { layoutSynthetic: true, width: innerWidth, height: innerHeight, offsetTop: 0, offsetLeft: 0, scale: 1 }),
      })
    })
    let frame: Frame | undefined
    let dialog: Locator | undefined
    if (scenario === 'host') {
      frame = await openHost(page, state)
      await openQuickLinksTab(frame)
      dialog = frame.getByRole('dialog')
      actions.push(`Mounted actual ${state} product bridge; opened inner Quick Links`)
    } else if (scenario === 'chat') {
      dialog = await openChatState(page, state)
      actions.push(`Opened real Chat components through mocked HA storage in ${state}`)
    } else if (scenario === 'navigation' || scenario === 'preload') {
      const route = state === 'back-page' ? 'living-room' : 'overview'
      await page.goto(`/index.html?path=${route}`)
      if (scenario === 'preload') {
        const cache = page.locator('[data-dashboard-preload-cache]')
        await cache.waitFor({ state: 'attached' })
        captures.push({
          phase: 'initial-inert-hydration',
          facts: await cache.evaluate((element) => ({
            hidden: element.getAttribute('aria-hidden'),
            routes: element.querySelectorAll('[data-preload-route]').length,
            media: element.querySelectorAll('img,video,canvas').length,
          })),
        })
        actions.push('Inspected initial hidden preload DOM before its intentional ready-state removal')
      }
      await waitForRoute(page, route)
      actions.push(`Opened ready source route ${route}`)
    } else {
      dialog = await openSurface(page, scenario)
      await enterState(dialog, scenario, state)
      actions.push(`Opened ${scenario}; selected ${state} before any mounted resize`)
    }
    const target = frame ?? page
    const initialOrigin = await target.evaluate(() => performance.timeOrigin)
    for (const [index, profile] of profiles.entries()) {
      if (frame) await applyHostProfile(page, frame, state, profile)
      else await applyProfile(page, profile)
      if (dialog) await waitForModalReady(dialog)
      actions.push(`Mounted resize to ${profile}`)
      if (args.includes('--interact')) {
        if (scenario === 'weather' && dialog) {
          const selected = state === 'wind' ? 'Wind conditions' : state === 'precipitation' ? 'Precipitation conditions' : 'Conditions conditions'
          const alternative = selected === 'Wind conditions' ? 'Conditions conditions' : 'Wind conditions'
          await dialog.getByRole('button', { name: alternative, exact: true }).click()
          await dialog.getByRole('button', { name: selected, exact: true }).click()
          await expect(dialog.getByRole('button', { name: selected, exact: true })).toHaveAttribute('aria-pressed', 'true')
          await expect.poll(() => dialog!.locator('[data-transition]').evaluateAll((elements) =>
            elements.every((element) => element.getAttribute('data-transition') === 'idle'))).toBe(true)
          actions.push('Changed and restored the Weather mode through its real buttons; inspected the selected backend state')
        }
        if (scenario === 'chat' && dialog) {
          const history = state === 'history' || state === 'history-empty'
          const input = dialog.getByRole('textbox', { name: 'Chat Message', exact: true })
          if (!history && await input.isEnabled() && await input.getAttribute('readonly') === null) {
            const draft = await input.inputValue()
            await input.fill('A manual review draft')
            await input.fill(draft)
            await input.blur()
            actions.push('Edited and restored the chat draft without sending a prompt')
          }
          await dialog.getByRole('tab', { name: 'Quick Links', exact: true }).click()
          await dialog.getByRole('group', { name: 'Quick Links', exact: true }).waitFor({ state: 'visible' })
          await dialog.getByRole('tab', { name: 'Home Assistant', exact: true }).click()
          if (history) await dialog.getByRole('button', { name: 'View History', exact: true }).click()
          actions.push('Visited the real Quick Links tab and returned to the same Chat/history state')
        }
        if (scenario === 'remote' && dialog) {
          const down = dialog.getByRole('button', { name: 'Down', exact: true })
          const box = await down.boundingBox()
          if (!box) throw new Error('Missing remote coordinate target')
          if (contextConfig.touch) await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2)
          else await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
          actions.push('Pressed remote Down at its measured coordinate, without auto-scroll')
        }
        if (scenario === 'filters' && dialog) {
          const radios = dialog.getByRole('radio')
          const selected = await radios.evaluateAll((elements) => elements.findIndex((element) => element.getAttribute('aria-checked') === 'true'))
          const alternative = radios.nth(selected === 0 ? 1 : 0)
          const enable = dialog.getByRole('switch', { name: /Use expiring ingredients only/ })
          const initiallyDisabled = !await alternative.isEnabled()
          if (initiallyDisabled) {
            await enable.click()
            actions.push('Observed disabled expiry choices; enabled their real controlling toggle')
          }
          await alternative.click()
          if (selected >= 0) await radios.nth(selected).click()
          if (initiallyDisabled) await enable.click()
          actions.push('Selected an alternate filter option and restored the initial selection')
        }
        if (scenario === 'form' && dialog) {
          const input = dialog.getByRole('textbox', { name: 'Task' })
          await input.fill('Layout validation draft edited')
          await input.fill('Layout validation draft')
          await input.blur()
          actions.push('Edited and restored the draft through the actual textbox')
          if (contextConfig.touch && profile === 'island-phone-landscape-left') {
            await input.focus()
            await page.evaluate(() => { Object.assign(window.visualViewport!, { height: 263 }); window.visualViewport!.dispatchEvent(new Event('resize')) })
            await page.waitForFunction(() => document.documentElement.style.getPropertyValue('--dashboard-keyboard-overlay-inset') === '130px')
            const keyboardImage = resolve(output, `${index}-synthetic-keyboard.png`)
            await page.screenshot({ path: keyboardImage, scale: 'css' })
            captures.push({ profile, phase: 'synthetic-keyboard', screenshot: relativeArtifact(root, keyboardImage), hash: hash(readFileSync(keyboardImage)) })
            await applyProfile(page, profile)
            await input.blur()
            actions.push('Contracted synthetic visual viewport to 263px, observed keyboard inset, restored it')
          }
        }
        if (scenario === 'navigation' && state === 'home') {
          const menu = page.getByRole('button', { name: 'Open navigation menu', exact: true })
          if (await menu.isVisible()) {
            if (contextConfig.touch) await menu.tap()
            else await menu.click()
            const drawer = page.locator('[data-adaptive-navigation="drawer"]')
            await expect(drawer).toHaveAttribute('data-state', 'open')
            await expect.poll(() => drawer.evaluate((element) => {
              const rect = element.getBoundingClientRect()
              return rect.left >= -1 && rect.right <= innerWidth + 1
                && !element.getAnimations({ subtree: true }).some((animation) => animation.playState === 'running')
            })).toBe(true)
            await expect(drawer.getByRole('menuitem', { name: 'Home' })).toBeInViewport({ ratio: 1 })
            const drawerImage = resolve(output, `${index}-drawer-open.png`)
            await page.screenshot({ path: drawerImage, scale: 'css' })
            captures.push({ profile, phase: 'drawer-open', screenshot: relativeArtifact(root, drawerImage), hash: hash(readFileSync(drawerImage)) })
            await page.keyboard.press('Escape')
            await page.locator('[data-adaptive-navigation="drawer"]').waitFor({ state: 'detached' })
            actions.push('Opened settled navigation, resolved its Home entry in the viewport, dismissed with Escape')
          }
        }
      }
      if (dialog && args.includes('--terminal')) {
        await dialog.locator('[data-modal-sheet-body]').evaluate((element) => element.scrollTo({ top: element.scrollHeight, behavior: 'instant' }))
        actions.push('Scrolled the actual modal body to its terminal content')
      } else if (dialog) {
        await dialog.locator('[data-modal-sheet-body]').evaluate((element) => element.scrollTo({ top: 0, behavior: 'instant' }))
      }
      await target.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))))
      const facts = await target.evaluate(() => {
        const modal = document.querySelector<HTMLElement>('[role="dialog"]')
        const body = modal?.querySelector<HTMLElement>('[data-modal-sheet-body]')
        const measure = body?.querySelector<HTMLElement>('[data-modal-content-measure]')
        const rect = modal?.getBoundingClientRect()
        return {
          viewport: { width: innerWidth, height: innerHeight },
          title: modal?.querySelector('h2')?.textContent ?? document.querySelector('main h1')?.textContent,
          presentation: modal?.dataset.modalPresentation, tier: modal?.dataset.modalBodyTier,
          frame: rect && { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
          terminalGap: body && measure ? body.getBoundingClientRect().bottom - measure.getBoundingClientRect().bottom : null,
          padding: body ? getComputedStyle(body).paddingBottom : null,
          scrollTop: body?.scrollTop,
          selectedTabs: [...document.querySelectorAll('[role="tab"][aria-selected="true"]')].map((element) => element.getAttribute('aria-label') ?? element.textContent),
          calls: window.__mockHass?.calls,
          chat: window.__mockHass?.chat && {
            requests: window.__mockHass.chat.messages.filter((message) => message.type === 'conversation/process').length,
            writes: window.__mockHass.chat.messages.filter((message) => message.type === 'frontend/set_user_data').length,
            subscriptions: window.__mockHass.chat.subscriptions(),
          },
          preloadRoutes: document.querySelectorAll('[data-dashboard-preload-cache] [data-preload-route]').length,
        }
      })
      const screenshot = resolve(output, `${index}-${profile}.png`)
      await page.screenshot({ path: screenshot, scale: 'css' })
      captures.push({
        profile, state, facts, screenshot: relativeArtifact(root, screenshot), hash: hash(readFileSync(screenshot)),
        capabilities: await actualCapabilities(target, contextConfig.browser, browser.version(), contextConfig.touch, contextConfig.touch),
        retainedTimeOrigin: await target.evaluate(() => performance.timeOrigin) === initialOrigin,
      })
    }
    if (violations.length) throw new Error(violations.join('\n'))
    writeJson(resolve(output, 'replay.json'), {
      runId: run.runId, planId: plan.id, sourceDigest: plan.source.digest, buildDigest: run.candidate.digest,
      fixtureDigest: run.fixtureDigest, scenario, state, contextId, actions, captures,
      status: 'captured-not-reviewed', note: 'The agent must actually view these images; this command never writes a manual verdict.',
    })
    console.log(JSON.stringify({ output, actions, screenshots: captures.map((capture) => capture.screenshot), status: 'captured-not-reviewed' }, null, 2))
  } finally { await browserContext.close(); await browser.close() }
}

if (isEntry(import.meta.url)) {
  void review(process.argv.slice(2), process.cwd()).catch((error: unknown) => { console.error(String(error)); process.exitCode = 1 })
}
