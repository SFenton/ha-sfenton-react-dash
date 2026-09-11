import { expect, type Frame, type Locator, type Page, type TestInfo } from '@playwright/test'
import { mkdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { layoutProfile, RESPONSIVE_ROUTE_TITLES } from '../responsive-acceptance-data'
import type { ContextId } from './contracts'
import type { Capabilities, Checkpoint, LayoutPlan, Obligation, RunIdentity } from './types'
import { artifactPath, hash, readJson, relativeArtifact, writeJson } from '../../scripts/layout/shared'

export type AuditedDocument = Page | Frame

const DETAIL_READINESS = {
  'recipe-planner': { control: 'input[type="date"]', backLabel: 'Back to recipe', nativePicker: true },
  'recipe-product-picker': { control: 'input[aria-label="Search inventory products"]', backLabel: 'Back and mark ingredient available', nativePicker: false },
} as const

export type ModalReadiness = 'tabs' | 'vacuum-tabs' | keyof typeof DETAIL_READINESS

export function assertDeclaredTabs(observed: string[], declared: readonly string[]) {
  if (observed.length !== declared.length
    || declared.some((pattern) => observed.filter((name) => new RegExp(pattern).test(name)).length !== 1)
    || observed.some((name) => declared.filter((pattern) => new RegExp(pattern).test(name)).length !== 1)) {
    throw new Error(`Rendered tab inventory changed: ${observed.join(', ')}. Declare and exercise the new/changed state instead of silently omitting it.`)
  }
}

export async function waitForRoute(page: AuditedDocument, route: string, background = false) {
  const root = page.locator(`[data-route-path="${route}"]`)
  await expect(root).toHaveAttribute('data-route-transition-state', 'idle')
  await expect(root.locator('[data-page-scroller="true"]:visible')).toBeVisible()
  await expect.poll(() => page.evaluate(() => Boolean(window.__mockHass?.calls && window.__mockHass?.setEntityState))).toBe(true)
  const title = RESPONSIVE_ROUTE_TITLES.get(route)
  if (!title) throw new Error(`Unknown source route: ${route}`)
  await expect(root.getByRole('heading', { level: 1, name: title, exact: true, includeHidden: background })).toBeVisible()
}

export async function waitForModalReady(dialog: Locator, timeout = 5_000, readiness: ModalReadiness = 'tabs') {
  if (readiness !== 'tabs' && readiness !== 'vacuum-tabs' && !Object.hasOwn(DETAIL_READINESS, readiness)) throw new Error(`Unknown modal readiness state: ${readiness}`)
  const detail = Object.hasOwn(DETAIL_READINESS, readiness) ? DETAIL_READINESS[readiness as keyof typeof DETAIL_READINESS] : null
  await expect(dialog).toBeVisible({ timeout })
  await expect(dialog).toHaveAttribute('data-state', 'open', { timeout })
  await expect.poll(() => dialog.evaluate((element, { readiness, detail }) => {
    const style = getComputedStyle(element)
    const selected = Array.from(element.querySelectorAll('[role="tab"][aria-selected="true"]'))
    const tabCount = element.querySelectorAll('[role="tab"]').length
    const detailControls = detail ? [...element.querySelectorAll(detail.control)] : []
    const detailBack = detail ? [...element.querySelectorAll('button')].filter((button) => button.getAttribute('aria-label') === detail.backLabel) : []
    const detailReady = detailControls.length === 1 && detailBack.length === 1 && [...detailControls, ...detailBack].every((control) => {
      const rect = control.getBoundingClientRect()
      const nativePicker = detail?.nativePicker && control.matches('input[type="date"]')
      const surface = nativePicker ? control.closest('[data-empty]') : control
      const surfaceRect = surface?.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0 && getComputedStyle(control).visibility === 'visible'
        && surface && surfaceRect && surfaceRect.width > 0 && surfaceRect.height > 0
        && getComputedStyle(surface).visibility === 'visible' && Number(getComputedStyle(surface).opacity) > 0
        && (!nativePicker || Boolean(surface.textContent?.trim())) && !control.closest('[inert], [aria-hidden="true"]')
    })
    return {
      opacity: Number(style.opacity),
      starting: element.hasAttribute('data-starting-style') || element.getAttribute('data-initial-starting-style') === 'true',
      running: element.getAnimations({ subtree: true }).filter((animation) =>
        animation.playState === 'running' && animation.effect?.getComputedTiming().iterations !== Infinity)
        .map((animation) => ({
          name: (animation as CSSAnimation).animationName ?? (animation as CSSTransition).transitionProperty ?? 'web-animation',
          time: animation.currentTime,
          timing: animation.effect?.getComputedTiming(),
          target: (animation.effect as KeyframeEffect).target?.nodeName,
        })),
      tabsValid: readiness === 'tabs' ? tabCount === 0 || selected.length === 1 : selected.length === 1,
      incoming: Array.from(element.querySelectorAll('[data-modal-tab-transition-state]'))
        .every((panel) => panel.getAttribute('data-modal-tab-transition-state') === 'idle'),
      panelsMatch: detail ? detailReady : selected.every((tab) => {
        const id = tab.getAttribute('aria-controls')
        const panel = id ? element.ownerDocument.getElementById(id) : null
        if (!panel || !element.contains(panel)) return false
        const labels = panel.getAttribute('aria-labelledby')?.split(/\s+/) ?? []
        const rect = panel.getBoundingClientRect()
        // Unavailable vacuum controls can contain only an empty layout wrapper.
        const emptyVacuum = readiness === 'vacuum-tabs'
          && Boolean(panel.closest('[data-scroll-region="vacuum-panel"]'))
          && !panel.textContent?.trim()
          && !panel.querySelector('button, input, select, textarea, a, img, svg, canvas, video, [role="button"], [role="slider"], [role="checkbox"], [role="radio"], [role="switch"]')
          && [...panel.querySelectorAll('*')].every((child) => child.getBoundingClientRect().height === 0)
          && [...element.querySelectorAll('[data-tone="unavailable"]')].some((indicator) => {
            const box = indicator.getBoundingClientRect()
            return /^Status(?:Unavailable|Unknown)$/.test(indicator.textContent?.replace(/\s+/g, '') ?? '')
              && box.width > 0 && box.height > 0 && getComputedStyle(indicator).visibility === 'visible'
              && Number(getComputedStyle(indicator).opacity) > 0 && !indicator.closest('[inert], [aria-hidden="true"]')
          })
        return Boolean(tab.id && labels.includes(tab.id) && rect.width > 0 && (rect.height > 0 || emptyVacuum))
      }),
    }
  }, { readiness, detail }), { timeout, message: 'Wait for actual incoming content, not merely selected-tab chrome' }).toEqual({
    opacity: 1, starting: false, running: [], tabsValid: true, incoming: true, panelsMatch: true,
  })
  await dialog.evaluate(() => document.fonts.ready)
  await dialog.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))))
}

export async function applyProfile(page: Page, name: string, target: AuditedDocument = page) {
  const { viewport, insets } = layoutProfile(name)
  await page.setViewportSize(viewport)
  await target.evaluate((safe) => {
    for (const [edge, value] of Object.entries(safe)) document.documentElement.style.setProperty(`--safe-area-inset-${edge}`, `${value}px`)
    document.documentElement.dataset.safeAreaProfile = 'synthetic'
    const viewport = window.visualViewport
    if (viewport && 'layoutSynthetic' in viewport) {
      Object.assign(viewport, { width: innerWidth, height: innerHeight })
      viewport.dispatchEvent(new Event('resize'))
    }
  }, insets)
  await target.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))))
  if (await target.locator('[data-app-shell]').count()) await waitForNavigation(target, false)
}

export async function waitForNavigation(target: AuditedDocument, requireVisible = true) {
  const viewport = await target.evaluate(() => ({ width: innerWidth, height: innerHeight }))
  const expected = viewport.width >= 1120
    ? viewport.height >= 820 ? 'rail' : 'drawer-only'
    : viewport.width > viewport.height && viewport.height <= 500 ? 'drawer-only' : 'bottom'
  await expect(target.locator('[data-app-shell]')).toHaveAttribute('data-navigation-layout', expected)
  if (requireVisible && expected !== 'drawer-only') await expect(target.locator(`[data-adaptive-navigation="${expected}"]`)).toBeVisible()
}

export async function actualCapabilities(page: AuditedDocument, browser: string, version: string, isMobile: boolean, hasTouch: boolean): Promise<Capabilities> {
  return {
    browser, version, isMobile, hasTouch,
    ...await page.evaluate(() => ({
      fine: matchMedia('(pointer: fine)').matches,
      coarse: matchMedia('(pointer: coarse)').matches,
      hover: matchMedia('(hover: hover)').matches,
      touchPoints: navigator.maxTouchPoints,
    })),
  }
}

export async function modalFacts(dialog: Locator, expectedScrollMode: 'body' | 'panes' = 'body', terminal: 'controls' | 'chat-content' | string = 'controls') {
  const terminalKind = terminal === 'controls' || terminal === 'chat-content' ? terminal : 'read-only-content'
  const readOnlyTerminal = terminalKind === 'read-only-content' ? terminal : undefined
  await waitForModalReady(dialog)
  await expect(dialog).toHaveAttribute('data-scroll-mode', expectedScrollMode)
  const body = dialog.locator('[data-modal-sheet-body]')
  const originalScroll = await body.evaluate((element) => element.scrollTop)
  await body.evaluate((element) => element.scrollTo({ top: element.scrollHeight, behavior: 'instant' }))
  await expect.poll(() => body.evaluate((element) => {
    element.scrollTo({ top: element.scrollHeight, behavior: 'instant' })
    return Math.abs(element.scrollTop - Math.max(0, element.scrollHeight - element.clientHeight))
  })).toBeLessThanOrEqual(1)
  await dialog.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))))
  const facts = await dialog.evaluate((element, { terminalKind, readOnlyTerminal }) => {
    const body = element.querySelector<HTMLElement>('[data-modal-sheet-body]')!
    const measure = element.querySelector<HTMLElement>('[data-modal-content-measure]')!
    const rect = element.getBoundingClientRect()
    const root = getComputedStyle(document.documentElement)
    const safe = Object.fromEntries(['top', 'right', 'bottom', 'left'].map((edge) => [edge, Number.parseFloat(root.getPropertyValue(`--safe-area-inset-${edge}`)) || 0])) as Record<'top' | 'right' | 'bottom' | 'left', number>
    const terminalGap = body.getBoundingClientRect().bottom - measure.getBoundingClientRect().bottom
    const terminals = Array.from(body.querySelectorAll<HTMLElement>('button, input, select, textarea, [role="slider"], [role="checkbox"], [role="radio"], [role="switch"]'))
      .filter((item) => {
        const rect = item.getBoundingClientRect()
        return rect.width > 0 && rect.height > 0 && !item.closest('[aria-hidden="true"]')
      })
    const content = terminalKind === 'chat-content'
      ? [...body.querySelectorAll<HTMLElement>('[data-chat-panel="true"], [data-chat-history="true"]')]
      : []
    const readOnlyTargets = readOnlyTerminal ? [...body.querySelectorAll<HTMLElement>(readOnlyTerminal)] : []
    if (terminalKind === 'controls' && !terminals.length) throw new Error('Modal body requires terminal controls')
    if (terminalKind === 'chat-content' && (content.length !== 1 || !content[0].textContent?.trim()
      || content[0].getBoundingClientRect().height <= 0 || content[0].getBoundingClientRect().width <= 0
      || getComputedStyle(content[0]).visibility !== 'visible' || Number(getComputedStyle(content[0]).opacity) <= 0
      || content[0].closest('[aria-hidden="true"], [inert]'))) throw new Error('Chat body requires one real terminal content region')
    if (terminalKind === 'read-only-content') {
      if (terminals.length || readOnlyTargets.length !== 1) throw new Error('Declared read-only body requires one state terminal and no controls')
      const target = readOnlyTargets[0]
      const box = target.getBoundingClientRect()
      if (target.getAttribute('role') !== 'group' || !target.getAttribute('aria-label')?.trim()
        || !target.textContent?.trim() || box.width <= 0 || box.height <= 0
        || getComputedStyle(target).visibility !== 'visible' || Number(getComputedStyle(target).opacity) <= 0
        || target.closest('[aria-hidden="true"], [inert]')
        || target.matches('[tabindex]') || target.querySelector('[tabindex], a, button, input, select, textarea')) {
        throw new Error('Read-only terminal must be visible, named, noninteractive state content')
      }
    }
    const targets = terminalKind === 'controls' ? terminals : terminalKind === 'chat-content' ? content : readOnlyTargets
    const terminalBottom = Math.max(...targets.map((item) => item.getBoundingClientRect().bottom))
    const terminalTargetGap = body.getBoundingClientRect().bottom - terminalBottom
    const terminalControlGap = terminals.length ? body.getBoundingClientRect().bottom - Math.max(...terminals.map((item) => item.getBoundingClientRect().bottom)) : null
    if (![terminalGap, terminalBottom, terminalTargetGap].every(Number.isFinite)) throw new Error('Modal terminal geometry must be finite')
    const scrollOwners = Array.from(body.querySelectorAll<HTMLElement>('*')).filter((child) =>
      child.clientHeight > 0 && child.scrollHeight > child.clientHeight + 1 && ['auto', 'scroll'].includes(getComputedStyle(child).overflowY))
    const eligiblePanes = Array.from(body.querySelectorAll<HTMLElement>('*')).filter((child) =>
      child.clientHeight > 0 && child.clientWidth > 0 && !child.closest('[aria-hidden="true"]')
      && ['auto', 'scroll'].includes(getComputedStyle(child).overflowY))
    const close = element.querySelector<HTMLElement>('button[aria-label="Close"]')!
    const closeRect = close.getBoundingClientRect()
    const hit = document.elementFromPoint(closeRect.x + closeRect.width / 2, closeRect.y + closeRect.height / 2)
    return {
      frame: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      viewport: { width: innerWidth, height: innerHeight }, safe,
      intent: element.getAttribute('data-modal-geometry-intent'),
      presentation: element.getAttribute('data-modal-presentation'),
      tier: element.getAttribute('data-modal-body-tier'),
      blockPolicy: element.getAttribute('data-modal-block-policy'),
      scrollMode: element.getAttribute('data-scroll-mode'),
      bodyOverflow: getComputedStyle(body).overflowY,
      bodyScrolls: body.scrollHeight > body.clientHeight + 1,
      bodyPadding: Number.parseFloat(getComputedStyle(body).paddingBottom),
      bodyContentHeight: body.clientHeight - Number.parseFloat(getComputedStyle(body).paddingTop) - Number.parseFloat(getComputedStyle(body).paddingBottom),
      measureHeight: measure.getBoundingClientRect().height,
      measureOverflow: measure.scrollHeight - measure.clientHeight,
      terminalGap, terminalKind, terminalTargetGap, terminalControlGap, terminalControlCount: terminals.length,
      terminalContentGap: terminalTargetGap,
      terminalContentCount: targets.length,
      nestedScrollOwners: scrollOwners.length,
      eligiblePanes: eligiblePanes.map((pane) => ({ name: pane.dataset.scrollRegion ?? pane.className, height: pane.clientHeight })),
      closeHit: hit === close || close.contains(hit),
      contentWidth: measure.getBoundingClientRect().width,
    }
  }, { terminalKind, readOnlyTerminal })
  await body.evaluate((element, top) => element.scrollTo({ top, behavior: 'instant' }), originalScroll)
  expect(facts.intent).toBeTruthy()
  expect(facts.closeHit).toBe(true)
  const expected = facts.presentation === 'landscape-dialog'
    ? { x: facts.safe.left + 12, y: facts.safe.top + 8, width: facts.viewport.width - facts.safe.left - facts.safe.right - 24, height: facts.viewport.height - facts.safe.top - facts.safe.bottom - 16 }
    : facts.presentation === 'dialog'
      ? (() => {
          const left = Math.max(32, facts.safe.left), right = Math.max(32, facts.safe.right)
          const top = Math.max(32, facts.safe.top), bottom = Math.max(32, facts.safe.bottom)
          const width = Math.min(1100, facts.viewport.width - left - right)
          const height = Math.min(760, facts.viewport.height - top - bottom)
          return { width, height, x: left + (facts.viewport.width - left - right - width) / 2, y: top + (facts.viewport.height - top - bottom - height) / 2 }
        })()
      : null
  if (expected) for (const key of ['x', 'y', 'width', 'height'] as const) expect(Math.abs(facts.frame[key] - expected[key]), `Independent frame oracle: ${key}`).toBeLessThanOrEqual(1)
  const bodyOwned = ['auto', 'scroll'].includes(facts.bodyOverflow)
  const paneOwned = facts.presentation !== 'sheet' && ['hidden', 'clip'].includes(facts.bodyOverflow) && facts.eligiblePanes.length > 0
  expect(bodyOwned || paneOwned, 'Effective ownership requires a scrolling body or a locked body with a real inner pane').toBe(true)
  const effectiveScrollOwner = bodyOwned ? 'body' : 'panes'
  if (paneOwned) {
    expect(expectedScrollMode, 'A bounded inner pane must be declared').toBe('panes')
    expect(facts.bodyScrolls, 'A pane-owned body must not acquire its own scroll range').toBe(false)
    expect(Math.abs(facts.measureHeight - facts.bodyContentHeight), 'Pane-owned measure remains bounded').toBeLessThanOrEqual(1)
    for (const pane of facts.eligiblePanes) expect(pane.height, 'Inner pane remains inside the bounded body').toBeLessThanOrEqual(facts.bodyContentHeight + 1)
  } else {
    expect(facts.nestedScrollOwners, 'Body-owned content must not introduce a nested vertical scroller').toBe(0)
    expect(Math.abs(facts.terminalGap - facts.bodyPadding), 'Intrinsic body measure must retain actual end padding').toBeLessThanOrEqual(1)
    expect(facts.measureOverflow, 'Intrinsic body measure contains its descendants').toBeLessThanOrEqual(1)
    expect(facts.terminalTargetGap, 'The declared actual terminal target retains the body end clearance').toBeGreaterThanOrEqual(facts.bodyPadding - 1)
  }
  return { ...facts, effectiveScrollOwner }
}

export async function closeMounted(dialog: Locator) {
  const node = await dialog.elementHandle()
  if (!node) throw new Error('Missing mounted modal')
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  expect(await node.getAttribute('data-state')).toBe('closed')
  await expect(dialog).toHaveCount(0, { timeout: 2_000 })
  await node.dispose()
}

export function runEnvironment() {
  const directory = process.env.LAYOUT_RUN_DIR
  if (!directory) return null
  const run = readJson<RunIdentity>(resolve(directory, 'run.json'))
  const plan = readJson<LayoutPlan>(resolve(directory, 'plan.json'))
  return { run, plan }
}

export async function checkpoint(
  page: Page,
  target: AuditedDocument,
  testInfo: TestInfo,
  obligation: Obligation,
  capabilities: Capabilities,
  facts: Record<string, unknown>,
  status: 'passed' | 'failed' = 'passed',
) {
  const environment = runEnvironment()
  if (!environment) return
  const { run, plan } = environment
  const filename = `${obligation.id.replaceAll('/', '--')}.png`
  const screenshot = artifactPath(run.root, resolve(run.artifactRoot, 'screenshots', filename))
  mkdirSync(resolve(run.artifactRoot, 'screenshots'), { recursive: true })
  await page.screenshot({ path: screenshot, scale: 'css', animations: 'allow' })
  const actual = await target.evaluate(() => ({
    viewport: { width: innerWidth, height: innerHeight },
    insets: Object.fromEntries(['top', 'right', 'bottom', 'left'].map((edge) => [
      edge, Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue(`--safe-area-inset-${edge}`)) || 0,
    ])) as Checkpoint['insets'],
  }))
  const record: Checkpoint = {
    version: 1, ...obligation, runId: run.runId, planId: plan.id,
    sourceDigest: plan.source.digest, buildDigest: run.candidate.digest, fixtureDigest: run.fixtureDigest,
    testId: testInfo.testId,
    capabilities: await actualCapabilities(target, capabilities.browser, capabilities.version, capabilities.isMobile, capabilities.hasTouch),
    ...actual,
    facts: {
      ...facts,
      mediaFixture: 'HA/external images and camera resource are locally substituted; owned build assets are real, live-media fidelity is not certified',
      componentFixture: 'Existing HAKit mocks simplify toggle/dial internals; this is not real-HAKit appearance certification',
      capabilityBoundary: 'WPE coarse emulation may report zero maxTouchPoints; synthetic keyboard hints are not physical touch proof',
    },
    screenshot: relativeArtifact(run.root, screenshot), screenshotHash: hash(readFileSync(screenshot)), status,
  }
  writeJson(resolve(run.artifactRoot, 'checkpoints', `${obligation.id.replaceAll('/', '--')}.json`), record)
  await testInfo.attach('layout-checkpoint', { body: JSON.stringify(record), contentType: 'application/json' })
}

export function contextForProject(project: string): ContextId {
  if (project === 'mobile') return 'touch-chromium'
  if (project === 'desktop') return 'fine-chromium'
  if (project === 'webkit') return 'touch-webkit'
  throw new Error(`No certified layout context for project ${project}`)
}
