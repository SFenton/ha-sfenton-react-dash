import { test, expect } from '@playwright/test'
import { assertGuardedContext, guardContext, test as guardedTest } from './layout/fixture'
import { modalFacts, waitForModalReady } from './layout/evidence'
import { inspectRouteAddition, normalizeInspectedAddition } from './layout/routeAdditions'
import { createServer } from 'node:http'

guardedTest('built-in Playwright page and context receive the isolation fixture', async ({ page, context }) => {
  expect(page.context()).toBe(context)
  expect(() => assertGuardedContext(context)).not.toThrow()
  await page.goto('about:blank')
  expect(await page.evaluate(() => '__layoutWorkerAttempt' in window)).toBe(true)
})

guardedTest('declared route additions cannot conceal changed inherited cards or extra sections', async ({ context }) => {
  const baseline = await context.newPage()
  const candidate = await context.newPage()
  const inherited = ['sleepypod', 'media', 'climate'].map(name => `<section id="section-${name}" style="height:80px">
    <h2 style="margin:0;line-height:20px;font-size:16px">${name}</h2>
    <button data-variant="card" style="width:361px;height:60px;box-sizing:border-box">Existing ${name}</button>
  </section>`).join('')
  const addition = `<div data-responsive-section-item="true"><section id="section-sleep-&-wake" style="height:184px">
    <h2 style="margin:0;line-height:64px;font-size:16px">Sleep & Wake</h2>
    <button data-variant="card" data-action-kind="modal" style="width:361px;height:120px;border-radius:32px;box-sizing:border-box">Wake</button>
  </section></div>`
  const document = (content: string) => `<main style="display:grid;gap:18px;width:361px">${content}</main>`
  await baseline.setContent(document(inherited))
  await candidate.setContent(document(addition + inherited))
  const inspected = await inspectRouteAddition(baseline, candidate, 'master-bedroom', 'phone-portrait')
  expect(inspected).not.toBeNull()
  const restore = await normalizeInspectedAddition(candidate, inspected!)
  await expect(candidate.locator('[id="section-sleep-&-wake"]')).not.toBeVisible()
  await restore()
  await expect(candidate.locator('[id="section-sleep-&-wake"]')).toBeVisible()
  await candidate.locator('#section-climate button').evaluate(button => { button.style.width = '320px' })
  await expect(inspectRouteAddition(baseline, candidate, 'master-bedroom', 'phone-portrait')).rejects.toThrow()
  await candidate.setContent(document(addition + inherited + '<section id="unclassified">Extra</section>'))
  await expect(inspectRouteAddition(baseline, candidate, 'master-bedroom', 'phone-portrait')).rejects.toThrow()
  await candidate.setContent(document(addition.replace('height:120px', 'height:119px') + inherited))
  await expect(inspectRouteAddition(baseline, candidate, 'master-bedroom', 'phone-portrait')).rejects.toThrow()
  await baseline.close()
  await candidate.close()
})

test('readiness rejects missing and outgoing selected panels, then accepts the actual incoming panel', async ({ page }) => {
  await page.setContent('<div role="dialog" data-state="open"><button id="selected" role="tab" aria-selected="true" aria-controls="panel">Current</button></div>')
  const dialog = page.getByRole('dialog')
  await expect(waitForModalReady(dialog, 150)).rejects.toThrow()
  await dialog.evaluate((element) => {
    element.insertAdjacentHTML('beforeend', '<div id="panel" role="tabpanel" aria-labelledby="selected" data-modal-tab-transition-state="exiting">Outgoing</div>')
  })
  await expect(waitForModalReady(dialog, 150)).rejects.toThrow()
  await page.locator('#panel').evaluate((panel) => {
    panel.textContent = 'Incoming'
    panel.setAttribute('data-modal-tab-transition-state', 'idle')
  })
  await waitForModalReady(dialog)
  await expect(page.getByRole('tabpanel')).toHaveText('Incoming')
})

test('isolation blocks HTTP, WebSockets, workers and service workers before upstream I/O', async ({ browser }) => {
  const violations: string[] = []
  let serviceWorkerRequests = 0
  const server = createServer((request, response) => {
    if (request.url === '/sw.js') serviceWorkerRequests += 1
    response.setHeader('Content-Type', 'text/html')
    response.end('<!doctype html><title>Owned service-worker guard fixture</title>')
  })
  await new Promise<void>((ready) => server.listen(0, '127.0.0.1', ready))
  const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`
  // Prove the init guard independently of Playwright's additional serviceWorkers:block defense.
  const context = await browser.newContext({ serviceWorkers: 'allow' })
  expect(() => assertGuardedContext(context)).toThrow('Layout isolation was not installed')
  await guardContext(context, ['http://127.0.0.1:9', origin], violations)
  expect(() => assertGuardedContext(context)).not.toThrow()
  try {
    const page = await context.newPage()
    await expect(page.goto('http://127.0.0.1:9/api/states')).rejects.toThrow()
    expect(violations).toContain('HTTP blocked: GET http://127.0.0.1:9/api/states')
    await page.close()
    const workerPage = await context.newPage()
    await workerPage.evaluate(() => {
      new WebSocket('ws://127.0.0.1:9/socket')
      try { new Worker('data:text/javascript,postMessage(1)') } catch { /* Deliberately exercise the guard. */ }
    })
    await expect.poll(() => violations.includes('Worker/SharedWorker construction blocked')).toBe(true)
    await expect.poll(() => violations.some((entry) => entry.startsWith('WebSocket blocked:'))).toBe(true)
    await workerPage.goto(origin)
    const error = await workerPage.evaluate(() => navigator.serviceWorker.register('/sw.js').catch((caught: unknown) => String(caught)))
    expect(String(error)).toContain('Service workers are disabled')
    await expect.poll(() => violations.includes('ServiceWorker registration blocked')).toBe(true)
    expect(serviceWorkerRequests).toBe(0)
  } finally {
    await context.close()
    server.closeAllConnections()
    await new Promise<void>((done) => server.close(() => done()))
  }
})

test('equal character and word counts do not imply equal proportional-font width', async ({ page }) => {
  await page.setContent('<span style="font:32px Arial" id="narrow">iiii</span><span style="font:32px Arial" id="wide">WWWW</span>')
  const [narrow, wide] = await Promise.all([page.locator('#narrow').boundingBox(), page.locator('#wide').boundingBox()])
  expect('iiii'.length).toBe('WWWW'.length)
  expect(wide!.width).toBeGreaterThan(narrow!.width * 2)
})

test('intrinsic-end audit rejects consumed padding despite a correct computed padding value', async ({ page }) => {
  await page.setContent(`<div role="dialog" data-state="open" data-modal-presentation="sheet"
    data-modal-geometry-intent="guard-fixture" data-scroll-mode="body">
    <button aria-label="Close">Close</button>
    <div data-modal-sheet-body style="height:150px;padding-bottom:10px;overflow-y:auto">
      <div data-modal-content-measure style="height:100%;overflow:visible">
        <div style="height:300px"><button>Terminal fixture control</button></div>
      </div>
    </div>
  </div>`)
  const dialog = page.getByRole('dialog')
  await expect(dialog.locator('[data-modal-sheet-body]')).toHaveCSS('padding-bottom', '10px')
  await expect(modalFacts(dialog)).rejects.toThrow(/Intrinsic body measure/)
  await dialog.locator('[data-modal-content-measure]').evaluate((element) => { (element as HTMLElement).style.height = 'auto' })
  const facts = await modalFacts(dialog)
  expect(Math.abs(facts.terminalGap - 10)).toBeLessThanOrEqual(1)
})

test('reading-only Chat terminals require an explicit real content region and retain the strict end-inset audit', async ({ page }) => {
  await page.setContent(`<div role="dialog" data-state="open" data-modal-presentation="sheet"
    data-modal-geometry-intent="reading-guard" data-scroll-mode="body">
    <button aria-label="Close">Close</button>
    <div data-modal-sheet-body style="height:150px;padding-bottom:10px;overflow-y:auto">
      <div data-modal-content-measure style="height:100%;overflow:visible">
        <div data-chat-panel="true" style="height:300px">Actual transcript content</div>
      </div>
    </div>
  </div>`)
  const dialog = page.getByRole('dialog')
  await expect(modalFacts(dialog)).rejects.toThrow('Modal body requires terminal controls')
  await expect(modalFacts(dialog, 'body', 'chat-content')).rejects.toThrow(/Intrinsic body measure/)
  await dialog.locator('[data-modal-content-measure]').evaluate((element) => { (element as HTMLElement).style.height = 'auto' })
  const facts = await modalFacts(dialog, 'body', 'chat-content')
  expect(facts.terminalControlCount).toBe(0)
  expect(facts.terminalControlGap).toBeNull()
  expect(facts.terminalContentCount).toBe(1)
  expect(Math.abs(facts.terminalTargetGap - 10)).toBeLessThanOrEqual(1)
  await dialog.locator('[data-chat-panel]').evaluate((element) => { (element as HTMLElement).style.opacity = '0' })
  await expect(modalFacts(dialog, 'body', 'chat-content')).rejects.toThrow('Chat body requires one real terminal content region')
  await dialog.locator('[data-chat-panel]').evaluate((element) => { (element as HTMLElement).style.opacity = '1'; element.setAttribute('aria-hidden', 'true') })
  await expect(modalFacts(dialog, 'body', 'chat-content')).rejects.toThrow('Chat body requires one real terminal content region')
  await dialog.locator('[data-chat-panel]').evaluate((element) => { element.removeAttribute('aria-hidden') })
  await dialog.locator('[data-chat-panel]').evaluate((element) => { element.textContent = '' })
  await expect(modalFacts(dialog, 'body', 'chat-content')).rejects.toThrow('Chat body requires one real terminal content region')
  await dialog.locator('[data-chat-panel]').evaluate((element) => { element.removeAttribute('data-chat-panel') })
  await expect(modalFacts(dialog, 'body', 'chat-content')).rejects.toThrow('Chat body requires one real terminal content region')
})

for (const presentation of ['sheet', 'landscape-dialog'] as const) {
  guardedTest(`preferred pane mode still requires actual ${presentation} body end clearance`, async ({ page }) => {
    await page.setViewportSize(presentation === 'sheet' ? { width: 393, height: 852 } : { width: 852, height: 393 })
    await page.setContent(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">
      <div role="dialog" data-state="open" data-modal-presentation="${presentation}"
        data-modal-geometry-intent="pane-preference-guard" data-scroll-mode="panes"
        style="position:fixed;inset:8px 12px">
        <button aria-label="Close">Close</button>
        <div data-modal-sheet-body style="height:150px;padding-bottom:10px;overflow-y:auto">
          <div data-modal-content-measure style="height:100%;overflow:visible">
            <div style="height:300px"><button>Terminal control</button></div>
          </div>
        </div>
      </div>`)
    const dialog = page.getByRole('dialog')
    await expect(modalFacts(dialog, 'panes')).rejects.toThrow(/Intrinsic body measure/)
    await dialog.locator('[data-modal-content-measure]').evaluate((element) => {
      Object.assign((element as HTMLElement).style, { display: 'flow-root', height: 'auto', minHeight: '100%' })
    })
    const facts = await modalFacts(dialog, 'panes')
    expect(facts.scrollMode).toBe('panes')
    expect(facts.effectiveScrollOwner).toBe('body')
    expect(Math.abs(facts.terminalGap - 10)).toBeLessThanOrEqual(1)
  })
}

for (const overflow of ['auto', 'scroll'] as const) {
  guardedTest(`preferred panes cannot bypass ${overflow} body padding when content fits`, async ({ page }) => {
    await page.setContent(`<div role="dialog" data-state="open" data-modal-presentation="sheet"
      data-modal-geometry-intent="fitting-body-guard" data-scroll-mode="panes" style="width:240px">
      <button aria-label="Close">Close</button>
      <div data-modal-sheet-body style="position:relative;height:160px;box-sizing:border-box;padding-bottom:10px;overflow-y:${overflow}">
        <div data-modal-content-measure style="position:relative;height:100%;display:flow-root">
          <button style="position:absolute;bottom:0">Terminal control</button>
        </div>
      </div>
    </div>`)
    const dialog = page.getByRole('dialog')
    const valid = await modalFacts(dialog, 'panes')
    expect(valid.bodyScrolls).toBe(false)
    expect(valid.effectiveScrollOwner).toBe('body')
    await dialog.locator('[data-modal-content-measure]').evaluate((measure) => {
      Object.assign((measure as HTMLElement).style, { position: 'absolute', inset: '0', height: 'auto' })
    })
    expect(await dialog.locator('[data-modal-sheet-body]').evaluate((body) => body.scrollHeight - body.clientHeight)).toBeLessThanOrEqual(1)
    await expect(modalFacts(dialog, 'panes')).rejects.toThrow(/actual end padding/)
    await dialog.locator('[data-modal-content-measure]').evaluate((measure) => {
      Object.assign((measure as HTMLElement).style, { position: 'relative', inset: '', height: '100%' })
      measure.replaceChildren()
    })
    await expect(modalFacts(dialog, 'panes')).rejects.toThrow('requires terminal controls')
    await dialog.locator('[data-modal-content-measure]').evaluate((measure) => { measure.innerHTML = '<button>Terminal</button>' })
    await dialog.locator('[data-modal-sheet-body] button').evaluate((button) => {
      button.getBoundingClientRect = () => new DOMRect(0, 0, 20, Infinity)
    })
    await expect(modalFacts(dialog, 'panes')).rejects.toThrow('terminal geometry must be finite')
  })
}

guardedTest('declared read-only body requires one real noninteractive state terminal', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.setContent(`<div role="dialog" data-state="open" data-modal-presentation="dialog"
    data-modal-geometry-intent="readonly-guard" data-scroll-mode="body"
    style="position:fixed;left:170px;top:70px;width:1100px;height:760px">
    <button aria-label="Close">Close</button>
    <div data-modal-sheet-body style="height:160px;box-sizing:border-box;padding-bottom:10px;overflow:auto">
      <div data-modal-content-measure style="position:relative;height:100%;display:flow-root">
        <div id="state-terminal" role="group" aria-label="Read-only state" style="position:absolute;bottom:0">Observed state</div>
      </div>
    </div>
  </div>`)
  const dialog = page.getByRole('dialog')
  await expect(modalFacts(dialog, 'body')).rejects.toThrow('requires terminal controls')
  const facts = await modalFacts(dialog, 'body', '#state-terminal')
  expect(facts.terminalKind).toBe('read-only-content')
  expect(facts.terminalControlCount).toBe(0)
  expect(facts.terminalControlGap).toBeNull()
  expect(facts.terminalContentCount).toBe(1)
  expect(facts.terminalContentGap).toBe(10)
  await expect(modalFacts(dialog, 'body', '#missing')).rejects.toThrow('one state terminal')
  await page.locator('#state-terminal').evaluate(node => { node.style.opacity = '0' })
  await expect(modalFacts(dialog, 'body', '#state-terminal')).rejects.toThrow('visible, named, noninteractive')
  await page.locator('#state-terminal').evaluate(node => { node.style.opacity = '1'; node.setAttribute('tabindex', '0') })
  await expect(modalFacts(dialog, 'body', '#state-terminal')).rejects.toThrow('visible, named, noninteractive')
  await page.locator('#state-terminal').evaluate(node => { node.removeAttribute('tabindex'); node.innerHTML = '<button>Unclassified action</button>' })
  await expect(modalFacts(dialog, 'body', '#state-terminal')).rejects.toThrow('one state terminal and no controls')
})

for (const overflow of ['hidden', 'clip'] as const) {
  guardedTest(`bounded ${overflow} body requires a real eligible inner pane even when it fits`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.setContent(`<div role="dialog" data-state="open" data-modal-presentation="dialog"
      data-modal-geometry-intent="bounded-pane-guard" data-scroll-mode="panes"
      style="position:fixed;left:170px;top:70px;width:1100px;height:760px">
      <button aria-label="Close">Close</button>
      <div data-modal-sheet-body style="height:160px;box-sizing:border-box;padding-bottom:10px;overflow:${overflow}">
        <div data-modal-content-measure style="height:100%">
          <div data-scroll-region="inner" style="height:100%;overflow-y:auto"><button>Terminal</button></div>
        </div>
      </div>
    </div>`)
    const dialog = page.getByRole('dialog')
    const valid = await modalFacts(dialog, 'panes')
    expect(valid.effectiveScrollOwner).toBe('panes')
    expect(valid.nestedScrollOwners).toBe(0)
    expect(valid.eligiblePanes).toHaveLength(1)
    await dialog.locator('[data-scroll-region="inner"]').evaluate((pane) => { (pane as HTMLElement).style.overflowY = 'visible' })
    await expect(modalFacts(dialog, 'panes')).rejects.toThrow(/Effective ownership/)
    await dialog.locator('[data-scroll-region="inner"]').evaluate((pane) => { (pane as HTMLElement).style.overflowY = 'auto' })
    await dialog.locator('[data-modal-sheet-body]').evaluate((body) => { (body as HTMLElement).style.overflow = 'auto' })
    const bodyOwned = await modalFacts(dialog, 'panes')
    expect(bodyOwned.effectiveScrollOwner).toBe('body')
    expect(bodyOwned.bodyScrolls).toBe(false)
    expect(Math.abs(bodyOwned.terminalGap - bodyOwned.bodyPadding)).toBeLessThanOrEqual(1)
  })
}

guardedTest('declared vacuum readiness permits only an actually empty unavailable panel', async ({ page }) => {
  await page.setContent(`<div role="dialog" data-state="open">
    <button id="selected" role="tab" aria-selected="true" aria-controls="panel">Controls</button>
    <div id="region" data-scroll-region="vacuum-panel" data-modal-tab-transition-state="idle">
      <div id="panel" role="tabpanel" aria-labelledby="selected"><div></div></div>
    </div>
  </div>`)
  const dialog = page.getByRole('dialog')
  await expect(waitForModalReady(dialog, 150, 'vacuum-tabs')).rejects.toThrow()
  await dialog.evaluate((element) => element.insertAdjacentHTML('beforeend', '<div id="state" data-tone="unavailable"><span>Status</span><strong>Unavailable</strong></div>'))
  await expect(waitForModalReady(dialog, 150)).rejects.toThrow()
  await waitForModalReady(dialog, 500, 'vacuum-tabs')
  await page.locator('#panel').evaluate((panel) => { panel.innerHTML = '<button hidden aria-label="Hidden action"></button>' })
  await expect(waitForModalReady(dialog, 150, 'vacuum-tabs')).rejects.toThrow()
  await page.locator('#panel').evaluate((panel) => { panel.innerHTML = '<div></div>'; panel.setAttribute('aria-labelledby', 'wrong-tab') })
  await expect(waitForModalReady(dialog, 150, 'vacuum-tabs')).rejects.toThrow()
  await page.locator('#panel').evaluate((panel) => panel.setAttribute('aria-labelledby', 'selected'))
  await page.locator('#region').evaluate((region) => region.setAttribute('data-modal-tab-transition-state', 'exiting'))
  await expect(waitForModalReady(dialog, 150, 'vacuum-tabs')).rejects.toThrow()
  await page.locator('#region').evaluate((region) => region.setAttribute('data-modal-tab-transition-state', 'idle'))
  await page.locator('#state').evaluate((state) => document.body.append(state))
  await expect(waitForModalReady(dialog, 150, 'vacuum-tabs')).rejects.toThrow()
  await dialog.evaluate((element) => element.append(document.querySelector('#state')!))
  await page.locator('#region').evaluate((region) => region.removeAttribute('data-scroll-region'))
  await expect(waitForModalReady(dialog, 150, 'vacuum-tabs')).rejects.toThrow()
  await page.locator('#region').evaluate((region) => region.setAttribute('data-scroll-region', 'vacuum-panel'))
  await waitForModalReady(dialog, 500, 'vacuum-tabs')
  await page.locator('#panel').evaluate((panel) => panel.remove())
  await expect(waitForModalReady(dialog, 150, 'vacuum-tabs')).rejects.toThrow()
  await expect(waitForModalReady(dialog, 150, 'unknown-state' as never)).rejects.toThrow('Unknown modal readiness state')
})

for (const readiness of ['recipe-planner', 'recipe-product-picker'] as const) {
  guardedTest(`declared ${readiness} readiness requires its unique modal-owned detail controls`, async ({ page }) => {
    const back = readiness === 'recipe-planner' ? 'Back to recipe' : 'Back and mark ingredient available'
    const input = readiness === 'recipe-planner'
      ? '<span id="control-owner" data-empty="false" style="display:inline-block;position:relative">Aug 12, 2026<input type="date" value="2026-08-12" style="opacity:0;position:absolute;inset:0;width:100%;height:100%"></span>'
      : '<span id="control-owner"><input type="search" aria-label="Search inventory products"></span>'
    await page.setContent(`<div role="dialog" data-state="open">
      <button id="selected" role="tab" aria-selected="true" aria-controls="absent-root-panel">General</button>
      <button id="back" aria-label="${back}">Back</button>
      <div id="detail" data-modal-tab-transition-state="idle">${input}</div>
    </div>`)
    const dialog = page.getByRole('dialog')
    await expect(waitForModalReady(dialog, 150)).rejects.toThrow()
    await waitForModalReady(dialog, 500, readiness)
    await page.locator('#detail').evaluate((detail) => detail.setAttribute('data-modal-tab-transition-state', 'exiting'))
    await expect(waitForModalReady(dialog, 150, readiness)).rejects.toThrow()
    await page.locator('#detail').evaluate((detail) => detail.setAttribute('data-modal-tab-transition-state', 'idle'))
    await page.locator('input').evaluate((input) => { input.style.display = 'none' })
    await expect(waitForModalReady(dialog, 150, readiness)).rejects.toThrow()
    await page.locator('input').evaluate((input) => { input.style.display = ''; document.body.append(input) })
    await expect(waitForModalReady(dialog, 150, readiness)).rejects.toThrow()
    await page.locator('#control-owner').evaluate((owner) => owner.append(document.querySelector('input')!))
    await page.locator('input').evaluate((input) => input.after(input.cloneNode(true)))
    await expect(waitForModalReady(dialog, 150, readiness)).rejects.toThrow()
    await page.locator('input').last().evaluate((input) => input.remove())
    await page.locator('#back').evaluate((back) => { back.style.display = 'none' })
    await expect(waitForModalReady(dialog, 150, readiness)).rejects.toThrow()
    await page.locator('#back').evaluate((back) => { back.style.display = '' })
    await waitForModalReady(dialog, 500, readiness)
    if (readiness === 'recipe-planner') {
      await page.locator('#control-owner').evaluate((owner) => { owner.style.opacity = '0' })
      await expect(waitForModalReady(dialog, 150, readiness)).rejects.toThrow()
      await page.locator('#control-owner').evaluate((owner) => { owner.style.opacity = '' })
      await waitForModalReady(dialog, 500, readiness)
    }
    await expect(waitForModalReady(dialog, 150)).rejects.toThrow()
  })
}
