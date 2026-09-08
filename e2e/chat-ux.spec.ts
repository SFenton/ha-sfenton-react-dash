import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test, expect, devices, type Locator, type Page } from './layout/fixture'
import { bindChatServer, openChat, sendChat } from './chat-fixture'
import { MockChatServer } from '../src/test/mocks/chatServer'
import { applyProfile, modalFacts, waitForModalReady } from './layout/evidence'
import { CANONICAL_VIEWPORT_NAMES } from './responsive-acceptance-data'
import type { ChatRecord, ChatRequestRecord, ChatResultRecord, ChatThreadRecord } from '../src/components/hass/chat/chatRecords'
import { chatStateFacts, openChatState } from './chat-layout'

test('Home Assistant copy stays quiet in empty chat and history across viewports', async ({ page, context }, testInfo) => {
  test.setTimeout(120_000)
  const server = new MockChatServer()
  server.agents[0].name = 'Google AI Conversation'
  await bindChatServer(context, server, 'copy-account')
  const dialog = await openChat(page, 'copy-account')
  const directory = resolve('artifacts/chat-copy', testInfo.project.name)
  mkdirSync(directory, { recursive: true })
  for (const profile of [...CANONICAL_VIEWPORT_NAMES, 'island-phone-landscape-left', 'island-phone-landscape-right', 'rectangular-phone-landscape', 'small-rectangular-landscape', 'intermediate-landscape', 'phone-portrait']) {
    await applyProfile(page, profile)
    await waitForModalReady(dialog)
    await expect(dialog).toHaveAccessibleName('Home Assistant')
    await expect(dialog.getByRole('tab', { name: 'Home Assistant', exact: true })).toHaveAttribute('aria-selected', 'true')
    await expect(dialog.getByRole('heading', { name: 'Home Assistant Agent', exact: true })).toBeVisible()
    await expect(dialog.getByText('Ask a question or give a command to Home Assistant.', { exact: true })).toBeVisible()
    await expect(dialog.getByText('Google AI Conversation', { exact: true })).toHaveCount(0)
    await expect(dialog.getByRole('combobox')).toHaveCount(0)
    await expect(dialog.getByText(/Chats are shared with other devices/)).toHaveCount(0)
    expect(await dialog.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1)
    await page.screenshot({ path: resolve(directory, `empty-${profile}.png`), scale: 'css' })
    await dialog.getByRole('button', { name: 'View History', exact: true }).click()
    await expect(dialog).toHaveAccessibleName('Chat History')
    await expect(dialog.getByText(/Chats are shared with other devices/)).toHaveCount(0)
    await dialog.getByRole('button', { name: 'Back', exact: true }).click()
  }
  expect(server.calls.filter((call) => ['conversation/process', 'frontend/set_user_data'].includes(String(call.message.type)))).toHaveLength(0)
})

async function installSyntheticKeyboard(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 1 })
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: Object.assign(new EventTarget(), {
        layoutSynthetic: true, width: innerWidth, height: innerHeight,
        offsetTop: 0, offsetLeft: 0, pageTop: 0, pageLeft: 0, scale: 1,
      }),
    })
  })
}

async function expectReachableChatActions(dialog: Locator, history = false) {
  const names = history ? ['Start New Chat'] : ['View History', 'Start New Chat']
  for (const name of names) {
    const action = dialog.getByRole('button', { name, exact: true })
    await expect(action).toBeInViewport({ ratio: 1 })
    const placement = await action.evaluate((element) => {
      const rect = element.getBoundingClientRect()
      const modal = element.closest('[role="dialog"]')!
      const frame = modal.getBoundingClientRect()
      const body = modal.querySelector('[data-modal-sheet-body]')!.getBoundingClientRect()
      const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
      return {
        header: Boolean(element.closest('[data-modal-sheet-header-actions]')),
        inside: rect.left >= frame.left && rect.right <= frame.right && rect.top >= frame.top && rect.bottom <= body.top,
        hit: hit === element || element.contains(hit),
        width: rect.width, height: rect.height,
        closeWidth: modal.querySelector('[data-modal-sheet-close]')?.getBoundingClientRect().width
          ?? [...modal.querySelectorAll('button')].find((button) => button.getAttribute('aria-label') === 'Close')!.getBoundingClientRect().width,
        hitInset: -parseFloat(getComputedStyle(element, '::before').top),
      }
    })
    expect(placement).toMatchObject({ header: true, inside: true, hit: true })
    expect(placement.width).toBe(placement.closeWidth)
    expect(placement.height).toBe(placement.closeWidth)
    expect(placement.width + placement.hitInset * 2).toBeGreaterThanOrEqual(44)
  }
}

test('chat history survives its first browser and remains scoped to one authenticated account', async ({ browser, baseURL }, testInfo) => {
  const server = new MockChatServer()
  const device = testInfo.project.name === 'desktop' ? devices['Desktop Chrome'] : devices['iPhone 13']
  const first = await browser.newContext({ ...device, baseURL })
  await bindChatServer(first, server, 'account-one')
  const firstPage = await first.newPage()
  await openChat(firstPage, 'account-one')
  await sendChat(firstPage, 'A first focused question')
  await first.close()
  const second = await browser.newContext({ ...device, baseURL })
  const otherAccount = await browser.newContext({ ...device, baseURL })
  try {
    await bindChatServer(second, server, 'account-one')
    await bindChatServer(otherAccount, server, 'account-two')
    const page = await second.newPage()
    const dialog = await openChat(page, 'account-one')
    await dialog.getByRole('button', { name: 'View History', exact: true }).click()
    await expect(dialog.getByRole('button', { name: /A first focused question/ })).toBeVisible()
    await dialog.getByRole('button', { name: /A first focused question/ }).click()
    await expect(page.getByRole('dialog', { name: 'Home Assistant', exact: true })).toBeVisible()
    await expect(dialog.getByRole('textbox', { name: 'Chat Message' })).toBeDisabled()
    await expect(dialog.locator('[data-chat-resume-warning]')).toContainText('could be handled without previous messages')
    expect(server.calls.filter((call) => call.message.type === 'conversation/process')).toHaveLength(1)
    await dialog.getByRole('button', { name: 'Continue Anyway', exact: true }).click()
    await sendChat(page, 'A second focused question')
    expect(server.calls.filter((call) => call.message.type === 'conversation/process').map((call) => call.message.text)).toEqual([
      'A first focused question', 'A second focused question',
    ])
    const otherPage = await otherAccount.newPage()
    const otherDialog = await openChat(otherPage, 'account-two')
    await otherDialog.getByRole('button', { name: 'View History', exact: true }).click()
    await expect(otherDialog.getByText('No Stored Chats for This Account', { exact: true })).toBeVisible()
    await expect(otherDialog.getByText('A first focused question', { exact: true })).toHaveCount(0)
  } finally { await second.close(); await otherAccount.close() }
})

test('chat keeps one shared frame, composer and bottom tabs through canonical mounted resize', async ({ page }, testInfo) => {
  test.setTimeout(120_000)
  const dialog = await openChat(page)
  await sendChat(page, 'A short request\nWith a second line')
  await expect(dialog.getByRole('article', { name: 'You', exact: true })).toBeVisible()
  await expect(dialog.getByRole('article', { name: 'Google Gemini', exact: true })).toBeVisible()
  await expect(dialog.getByText('You', { exact: true })).toHaveCount(0)
  await expect(dialog.getByText('Google Gemini', { exact: true })).toHaveCount(0)
  await dialog.getByRole('textbox').fill('A draft ready to send')
  const directory = resolve(process.env.RESPONSIVE_ARTIFACT_DIR ?? 'artifacts/chat-ux/candidate', testInfo.project.name)
  mkdirSync(directory, { recursive: true })
  for (const profile of [...CANONICAL_VIEWPORT_NAMES, 'island-phone-landscape-left', 'island-phone-landscape-right', 'rectangular-phone-landscape', 'small-rectangular-landscape', 'intermediate-landscape', 'phone-portrait']) {
    await applyProfile(page, profile)
    await waitForModalReady(dialog)
    const facts = await modalFacts(dialog, 'body', 'chat-content')
    const controls = await dialog.evaluate((element) => {
      const composer = element.querySelector<HTMLElement>('[data-chat-composer]')!.getBoundingClientRect()
      const navigation = element.querySelector<HTMLElement>('[data-modal-tab-nav]')!.getBoundingClientRect()
      const frame = element.getBoundingClientRect()
      const input = element.querySelector('textarea')!.getBoundingClientRect()
      const send = element.querySelector<HTMLElement>('[data-chat-composer] button')!.getBoundingClientRect()
      return {
        composerAboveTabs: composer.bottom <= navigation.top + 1,
        tabsInside: navigation.left >= frame.left && navigation.right <= frame.right && navigation.bottom <= frame.bottom,
        inputInside: input.left >= frame.left && input.right <= frame.right,
        sendWidth: send.width, sendHeight: send.height,
        centerOffset: Math.abs(send.y + send.height / 2 - composer.y - composer.height / 2),
        rightInset: composer.right - send.right,
        inputGap: send.left - input.right,
        sendBackground: getComputedStyle(element.querySelector('[data-chat-composer] button')!, '::before').backgroundColor,
        inputBackground: getComputedStyle(element.querySelector('textarea')!).backgroundColor,
        inputBorder: getComputedStyle(element.querySelector('textarea')!).borderWidth,
        documentOverflow: document.documentElement.scrollWidth - innerWidth,
      }
    })
    expect(controls.composerAboveTabs).toBe(true)
    expect(controls.tabsInside).toBe(true)
    expect(controls.inputInside).toBe(true)
    expect(controls.centerOffset).toBeLessThanOrEqual(1)
    expect(controls.rightInset).toBe(9)
    expect(controls.inputGap).toBe(8)
    expect(controls.sendWidth).toBe(44)
    expect(controls.sendHeight).toBe(44)
    expect(controls.sendBackground).toBe('rgba(30, 136, 229, 0.66)')
    expect(controls.inputBackground).toBe('rgba(24, 24, 24, 0)')
    expect(controls.inputBorder).toBe('0px')
    expect(controls.sendWidth).toBeGreaterThanOrEqual(44)
    expect(controls.sendHeight).toBeGreaterThanOrEqual(44)
    expect(controls.documentOverflow).toBeLessThanOrEqual(1)
    await expectReachableChatActions(dialog)
    await page.screenshot({ path: resolve(directory, `chat-${profile}.png`), scale: 'css' })
    await dialog.getByRole('button', { name: 'View History', exact: true }).click()
    const historyFacts = await modalFacts(dialog, 'body', 'chat-content')
    await expectReachableChatActions(dialog, true)
    for (const key of ['x', 'y', 'width', 'height'] as const) expect(Math.abs(historyFacts.frame[key] - facts.frame[key])).toBeLessThanOrEqual(1)
    await page.screenshot({ path: resolve(directory, `history-${profile}.png`), scale: 'css' })
    await dialog.getByRole('button', { name: 'Back', exact: true }).click()
    await dialog.getByRole('tab', { name: 'Quick Links', exact: true }).click()
    const linksFacts = await modalFacts(dialog)
    for (const key of ['x', 'y', 'width', 'height'] as const) expect(Math.abs(linksFacts.frame[key] - facts.frame[key])).toBeLessThanOrEqual(1)
    await page.screenshot({ path: resolve(directory, `links-${profile}.png`), scale: 'css' })
    await dialog.getByRole('tab', { name: 'Home Assistant', exact: true }).click()
  }
})

for (const profile of ['phone-portrait', 'island-phone-landscape-left', 'desktop']) {
test(`chat textarea keeps pointer focus neutral and hides scrollbars without trapping long text: ${profile}`, async ({ page }, testInfo) => {
  const dialog = await openChat(page)
  const input = dialog.getByRole('textbox', { name: 'Chat Message' })
  const composer = dialog.locator('[data-chat-composer]')
  const directory = resolve(process.env.RESPONSIVE_ARTIFACT_DIR ?? 'artifacts/chat-ux/candidate', testInfo.project.name)
  mkdirSync(directory, { recursive: true })
  const chrome = () => composer.evaluate((element) => [element, element.querySelector('textarea')!].map((control) => {
    const style = getComputedStyle(control)
    return { outline: style.outline, border: style.border, shadow: style.boxShadow }
  }))
    await applyProfile(page, profile)
    await waitForModalReady(dialog)
    await input.fill('')
    await dialog.getByRole('button', { name: 'View History' }).focus()
    const before = await chrome()
    await input.click()
    await page.screenshot({ path: resolve(directory, `input-click-${profile}.png`), scale: 'css' })
    expect(await chrome()).toEqual(before)
    await expect(input).toBeFocused()
    if (testInfo.project.use.hasTouch) {
      await dialog.getByRole('button', { name: 'View History' }).focus()
      await input.tap()
      expect(await chrome()).toEqual(before)
    }
    let frame = await composer.boundingBox()
    for (const text of ['Long_unbroken_'.repeat(140), Array.from({ length: 55 }, (_, index) => `Line ${index}: editable message`).join('\n')]) {
      await input.fill(text)
      await expect(composer).toHaveAttribute('data-expanded', 'true')
      await composer.evaluate((element) => Promise.all(element.getAnimations({ subtree: true }).map((animation) => animation.finished)))
      await expect.poll(async () => (await input.boundingBox())!.height).toBe(48)
      frame = await composer.boundingBox()
      await input.press('Control+End')
      await input.press('x')
      await expect(input).toHaveValue(`${text}x`)
      const overflow = await input.evaluate((element: HTMLTextAreaElement) => {
        const style = getComputedStyle(element)
        const scrollbar = getComputedStyle(element, '::-webkit-scrollbar')
        return {
          scrollHeight: element.scrollHeight, clientHeight: element.clientHeight,
          scrollWidth: element.scrollWidth, clientWidth: element.clientWidth,
          scrollTop: element.scrollTop, overflowY: style.overflowY,
          appearance: style.appearance, webkitAppearance: style.getPropertyValue('-webkit-appearance'),
          scrollbarGutter: element.offsetWidth - element.clientWidth,
          scrollbarWidth: style.scrollbarWidth, scrollbarDisplay: scrollbar.display,
          scrollbarPseudoWidth: scrollbar.width, caret: style.caretColor,
          selectionStart: element.selectionStart, selectionEnd: element.selectionEnd,
          length: element.value.length,
        }
      })
      expect(overflow.scrollHeight).toBeGreaterThan(overflow.clientHeight)
      expect(overflow.scrollTop).toBeGreaterThan(0)
      expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1)
      expect(overflow.overflowY).toBe('auto')
      expect(overflow.appearance).toBe('none')
      expect(overflow.scrollbarGutter).toBe(0)
      expect(overflow.scrollbarWidth).toBe('none')
      expect(overflow.scrollbarDisplay).toBe('none')
      expect(overflow.scrollbarPseudoWidth).toBe('0px')
      expect(overflow.caret).toBe('rgb(247, 251, 255)')
      expect(overflow.selectionStart).toBe(overflow.length)
      expect(overflow.selectionEnd).toBe(overflow.length)
      writeFileSync(resolve(directory, `input-metrics-${text.includes('\n') ? 'multiline' : 'unbroken'}-${profile}.json`), JSON.stringify({
        profile, pointerChromeBefore: before, pointerChromeAfter: await chrome(), overflow,
      }, null, 2))
      await input.press('Control+Home')
      expect(await input.evaluate((element: HTMLTextAreaElement) => element.selectionStart)).toBe(0)
      await input.hover()
      if (testInfo.project.name === 'webkit') {
        // Playwright mobile WebKit has no wheel API; keyboard caret travel above is native.
        await input.evaluate((element) => element.scrollTo(0, 0))
      } else {
        await page.mouse.wheel(0, -10000)
      }
      await expect.poll(() => input.evaluate((element) => element.scrollTop)).toBe(0)
      await input.press('Control+End')
      await input.press('y')
      await expect(input).toHaveValue(`${text}xy`)
      expect(await composer.boundingBox()).toEqual(frame)
      expect(await chrome()).toEqual(before)
      await page.screenshot({ path: resolve(directory, `input-${text.includes('\n') ? 'multiline' : 'unbroken'}-${profile}.png`), scale: 'css' })
    }
    await dialog.getByRole('button', { name: 'Send Chat Message' }).focus()
    await page.keyboard.press('Shift+Tab')
    await expect(input).toBeFocused()
    await expect(input).toHaveCSS('caret-color', 'rgb(247, 251, 255)')
    await input.press('Control+End')
    await input.press('z')
    await expect(input).toHaveValue(/xyz$/)
    const send = await dialog.getByRole('button', { name: 'Send Chat Message' }).boundingBox()
    expect(send!.width).toBe(44)
    expect(send!.height).toBe(44)
    expect(Math.abs(send!.y + 22 - frame!.y - frame!.height / 2)).toBeLessThanOrEqual(1)
    expect(frame!.x + frame!.width - send!.x - send!.width).toBe(9)
    await page.screenshot({ path: resolve(directory, `input-overflow-${profile}.png`), scale: 'css' })
    await input.fill('x'.repeat(4001))
    const errorBorder = await composer.evaluate((element) => getComputedStyle(element).borderColor)
    expect(errorBorder).toBe('rgba(229, 57, 53, 0.7)')
    await input.click()
    await expect(composer).toHaveCSS('border-color', errorBorder)
    await expect(dialog.getByRole('button', { name: 'Send Chat Message' })).toBeDisabled()
  expect(await page.evaluate(() => window.__mockHass!.chat.messages.filter((message) => message.type === 'conversation/process').length)).toBe(0)
})
}

test('assistant invitation keeps initial storage loading visually quiet and accessible', async ({ page }, testInfo) => {
  const dialog = await openChatState(page, 'loading')
  await expect(dialog.getByRole('heading', { name: 'Home Assistant Agent' })).toBeVisible()
  await expect(dialog.getByText('Ask a question or give a command to Home Assistant.')).toBeVisible()
  await expect(dialog.locator('[data-chat-panel]')).toHaveAttribute('aria-busy', 'true')
  const loading = dialog.getByRole('status')
  await expect(loading).toHaveText('Loading Chat History from Home Assistant…')
  expect(await loading.evaluate((element) => {
    const style = getComputedStyle(element)
    return { position: style.position, width: style.width, height: style.height, overflow: style.overflow }
  })).toEqual({ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden' })
  await expect(dialog.getByRole('textbox')).toBeDisabled()
  const directory = resolve(process.env.RESPONSIVE_ARTIFACT_DIR ?? 'artifacts/chat-ux/candidate', testInfo.project.name)
  mkdirSync(directory, { recursive: true })
  await page.screenshot({ path: resolve(directory, 'assistant-loading.png'), scale: 'css' })
  expect(await page.evaluate(() => window.__mockHass!.chat.messages.some((message) => message.type === 'conversation/process'))).toBe(false)
})

for (const profile of ['phone-portrait', 'island-phone-landscape-left', 'small-rectangular-landscape', 'desktop']) {
test(`chat grows one to two lines reversibly and matches close-sized header controls across details: ${profile}`, async ({ page }, testInfo) => {
  const dialog = await openChat(page)
  const input = dialog.getByRole('textbox')
  const composer = dialog.locator('[data-chat-composer]')
  const send = dialog.getByRole('button', { name: 'Send Chat Message' })
  const directory = resolve(process.env.RESPONSIVE_ARTIFACT_DIR ?? 'artifacts/chat-ux/candidate', testInfo.project.name)
  mkdirSync(directory, { recursive: true })
  const visual = () => send.evaluate((element) => parseFloat(getComputedStyle(element, '::before').width))
  await applyProfile(page, profile)
  await waitForModalReady(dialog)
  await expect(dialog).toHaveAccessibleName('Home Assistant')
  await expect(dialog.getByRole('heading', { name: 'Home Assistant Agent', exact: true })).toBeVisible()
  await expect(dialog.getByText('Ask a question or give a command to Home Assistant.', { exact: true })).toBeVisible()
  await expect(dialog.getByText('Google Gemini', { exact: true })).toHaveCount(0)
  await expect(dialog.getByText(/Chats are shared with other devices/)).toHaveCount(0)
  await input.fill('')
  await expect(composer).toHaveAttribute('data-expanded', 'false')
  await expect.poll(visual).toBe(32)
  const oneLine = await input.boundingBox()
  const outer = await dialog.boundingBox()
  expect(oneLine!.height).toBe(24)
  const header = dialog.getByRole('button', { name: 'Close', exact: true }).locator('..')
  const headerBox = await header.boundingBox()
  const close = await dialog.getByRole('button', { name: 'Close', exact: true }).boundingBox()
  await expect(dialog.getByRole('button', { name: 'Models', exact: true })).toHaveCount(0)
  await expect(dialog.getByText(/Currently selected model:|Model changed to/)).toHaveCount(0)
  await expect(dialog.locator('[data-chat-models], [data-chat-model-change]')).toHaveCount(0)
  for (const name of ['View History', 'Start New Chat']) {
    const box = await dialog.getByRole('button', { name, exact: true }).boundingBox()
    expect(box!.width).toBe(close!.width)
    expect(box!.height).toBe(close!.height)
  }
  await input.fill('First')
  await input.press('Shift+Enter')
  await expect(composer).toHaveAttribute('data-expanded', 'true')
  await expect.poll(visual).toBe(44)
  expect((await input.boundingBox())!.height).toBe(48)
  const transition = await input.evaluate((element) => getComputedStyle(element).transitionDuration)
  expect(transition).not.toBe('0s')
  await input.fill('unbroken'.repeat(250))
  await expect(composer).toHaveAttribute('data-expanded', 'true')
  expect((await input.boundingBox())!.height).toBe(48)
  await expect(input).toHaveCSS('overflow-y', 'auto')
  await expect(input).toHaveCSS('scrollbar-width', 'none')
  const frame = await composer.boundingBox()
  const target = await send.boundingBox()
  expect(target!.width).toBe(44)
  expect(target!.height).toBe(44)
  expect(Math.abs(target!.y + 22 - frame!.y - frame!.height / 2)).toBeLessThanOrEqual(1)
  await page.screenshot({ path: resolve(directory, `adaptive-two-${profile}.png`), scale: 'css' })
  await input.fill('Short')
  await expect(composer).toHaveAttribute('data-expanded', 'false')
  await expect.poll(visual).toBe(32)
  expect((await input.boundingBox())!.height).toBeCloseTo(oneLine!.height, 0)
  expect(await dialog.boundingBox()).toEqual(outer)
  await page.screenshot({ path: resolve(directory, `adaptive-one-${profile}.png`), scale: 'css' })
  await dialog.getByRole('button', { name: 'View History', exact: true }).click()
  expect(await header.boundingBox()).toEqual(headerBox)
  await dialog.getByRole('button', { name: 'Back', exact: true }).click()
  await dialog.getByRole('tab', { name: 'Quick Links', exact: true }).click()
  expect(await header.boundingBox()).toEqual(headerBox)
  await dialog.getByRole('tab', { name: 'Home Assistant', exact: true }).click()
})
}

test('chat wrapping follows a mounted phone and desktop resize and honors reduced motion', async ({ page }) => {
  const dialog = await openChat(page)
  const input = dialog.getByRole('textbox')
  const composer = dialog.locator('[data-chat-composer]')
  const send = dialog.getByRole('button', { name: 'Send Chat Message' })
  await applyProfile(page, 'phone-portrait')
  await input.fill('A moderately long line that wraps on a phone but not on a wide desktop')
  await expect(composer).toHaveAttribute('data-expanded', 'true')
  await applyProfile(page, 'desktop')
  await expect(composer).toHaveAttribute('data-expanded', 'false')
  await applyProfile(page, 'phone-portrait')
  await expect(composer).toHaveAttribute('data-expanded', 'true')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await input.fill('one\ntwo')
  await expect(input).toHaveCSS('transition-property', 'none')
  expect(await send.evaluate((element) => getComputedStyle(element, '::before').transitionProperty)).toBe('none')
  await expect(dialog.getByRole('button', { name: 'View Latest Message' })).toHaveCount(0)
})

test('pending chat dots are genuine, accessible and reduced-motion safe across close and tabs', async ({ page }) => {
  const dialog = await openChat(page)
  await page.evaluate(() => window.__mockHass!.chat.setPending())
  await dialog.getByRole('textbox', { name: 'Chat Message' }).fill('A pending focused question')
  await dialog.getByRole('button', { name: 'Send Chat Message', exact: true }).click()
  const dots = dialog.locator('[data-chat-thinking]')
  await expect(dots).toHaveAttribute('role', 'status')
  await expect(dots.locator('[aria-hidden="true"]')).toHaveCount(3)
  expect((await dots.boundingBox())!.width).toBeLessThanOrEqual(100)
  await expect(dots.locator('span').first()).not.toHaveCSS('animation-name', 'none')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(dots.locator('span').first()).toHaveCSS('animation-name', 'none')
  await dialog.getByRole('tab', { name: 'Quick Links', exact: true }).click()
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  await page.getByRole('button', { name: 'Open Chat and Quick Links', exact: true }).click()
  await page.getByRole('dialog').getByRole('tab', { name: 'Home Assistant', exact: true }).click()
  await expect(page.locator('[data-chat-thinking]')).toBeVisible()
  expect(await page.evaluate(() => window.__mockHass!.chat.messages.filter((message) => message.type === 'conversation/process').length)).toBe(1)
})

test('independent browser writes survive and conflicting saved tails stop continuation', async ({ browser, baseURL }, testInfo) => {
  const server = new MockChatServer()
  server.seed('shared-account', { theme: 'retained preference' })
  const device = testInfo.project.name === 'desktop' ? devices['Desktop Chrome'] : devices['iPhone 13']
  const first = await browser.newContext({ ...device, baseURL })
  const second = await browser.newContext({ ...device, baseURL })
  const fresh = await browser.newContext({ ...device, baseURL })
  try {
    await bindChatServer(first, server, 'shared-account')
    await bindChatServer(second, server, 'shared-account')
    const a = await first.newPage()
    const b = await second.newPage()
    await Promise.all([openChat(a, 'shared-account'), openChat(b, 'shared-account')])
    await Promise.all([sendChat(a, 'Question from the first device'), sendChat(b, 'Question from the second device')])
    await expect.poll(() => Object.values(server.data('shared-account')).filter((record) => (record as ChatRecord).kind === 'result').length).toBe(2)
    const records = Object.values(server.data('shared-account')) as ChatRecord[]
    const thread = records.find((record): record is ChatThreadRecord => record.kind === 'thread')!
    const parent = records.find((record): record is ChatResultRecord => record.kind === 'result' && record.threadId === thread.id)!
    const request = (id: string, text: string): ChatRequestRecord => ({
      version: 1, kind: 'request', id, threadId: thread.id, parentId: parent.id,
      conversationId: parent.conversationId, clientId: id, createdAt: Date.now(), text,
    })
    await Promise.all([
      a.evaluate((record) => window.__chatMockBridge!.request({
        type: 'frontend/set_user_data', key: `react-dash.chat.v1.request.${record.id}`, value: record,
      }), request('concurrent-first', 'A conflicting first-device message')),
      b.evaluate((record) => window.__chatMockBridge!.request({
        type: 'frontend/set_user_data', key: `react-dash.chat.v1.request.${record.id}`, value: record,
      }), request('concurrent-second', 'A conflicting second-device message')),
    ])
    await first.close()
    await second.close()
    await bindChatServer(fresh, server, 'shared-account')
    const page = await fresh.newPage()
    const dialog = await openChat(page, 'shared-account')
    await dialog.getByRole('button', { name: 'View History', exact: true }).click()
    await expect(dialog.locator('[data-chat-history-thread]')).toHaveCount(2)
    await dialog.locator(`[data-chat-history-thread="${thread.id}"]`).click()
    await expect(dialog.getByText('Messages overlapped with messages from another device.', { exact: false })).toBeVisible()
    await expect(dialog.getByText('A conflicting first-device message', { exact: true })).toBeVisible()
    await expect(dialog.getByText('A conflicting second-device message', { exact: true })).toBeVisible()
    await expect(dialog.getByRole('textbox', { name: 'Chat Message' })).toBeDisabled()
    expect(server.data('shared-account').theme).toBe('retained preference')
    expect(server.calls.filter((call) => call.message.type === 'conversation/process')).toHaveLength(2)
  } finally { await first.close(); await second.close(); await fresh.close() }
})

test('chat frames remain stable through pending, reply-save failure and storage-only recovery', async ({ page }) => {
  const dialog = await openChat(page)
  await applyProfile(page, 'island-phone-landscape-left')
  const before = (await modalFacts(dialog, 'body', 'chat-content')).frame
  await page.evaluate(() => window.__mockHass!.chat.setResultWriteFailure(true))
  await dialog.getByRole('textbox', { name: 'Chat Message' }).fill('One request with a save failure')
  await dialog.getByRole('button', { name: 'Send Chat Message' }).click()
  await expect(dialog.getByRole('alert')).toContainText('could not be saved')
  const failed = (await modalFacts(dialog, 'body', 'chat-content')).frame
  for (const key of ['x', 'y', 'width', 'height'] as const) expect(Math.abs(before[key] - failed[key])).toBeLessThanOrEqual(1)
  await page.evaluate(() => window.__mockHass!.chat.setResultWriteFailure(false))
  await dialog.getByRole('button', { name: 'Retry Saving Chat History' }).click()
  await expect(dialog.getByRole('alert')).toHaveCount(0)
  expect(await page.evaluate(() => window.__mockHass!.chat.messages.filter((message) => message.type === 'conversation/process').length)).toBe(1)
  const saved = (await modalFacts(dialog, 'body', 'chat-content')).frame
  for (const key of ['x', 'y', 'width', 'height'] as const) expect(Math.abs(before[key] - saved[key])).toBeLessThanOrEqual(1)
})

test('chat follows a new reply on rotation but does not steal an older reading position', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 })
  let dialog = await openChat(page)
  await applyProfile(page, 'island-phone-landscape-left')
  await expect.poll(() => dialog.locator('[data-modal-sheet-body]').evaluate((element) => element.scrollTop)).toBe(0)
  const emptyToolbar = await dialog.getByRole('button', { name: 'View History', exact: true }).boundingBox()
  const emptyBody = await dialog.locator('[data-modal-sheet-body]').boundingBox()
  const emptyFrame = await dialog.boundingBox()
  expect(emptyToolbar!.y).toBeGreaterThanOrEqual(emptyFrame!.y)
  expect(emptyToolbar!.y + emptyToolbar!.height).toBeLessThanOrEqual(emptyBody!.y + emptyBody!.height)
  expect(emptyToolbar!.y + emptyToolbar!.height).toBeLessThanOrEqual(emptyBody!.y)
  await applyProfile(page, 'phone-portrait')
  await sendChat(page, 'A compact conversation')
  await expect(dialog.getByRole('button', { name: 'View Latest Message' })).toHaveCount(0)
  await applyProfile(page, 'island-phone-landscape-left')
  await expect.poll(async () => {
    const body = await dialog.locator('[data-modal-sheet-body]').boundingBox()
    const reply = await dialog.locator('[data-chat-role="assistant"]').last().boundingBox()
    return reply!.y + reply!.height <= body!.y + body!.height + 1
  }).toBe(true)
  dialog = await openChatState(page, 'long')
  const body = dialog.locator('[data-modal-sheet-body]')
  await body.evaluate((element) => { element.scrollTop = 0; element.dispatchEvent(new Event('scroll')) })
  const before = await body.evaluate((element) => element.scrollTop)
  await page.evaluate(() => window.__mockHass!.chat.seed({
    'react-dash.chat.v1.request.new-remote-turn': {
      version: 1, kind: 'request', id: 'new-remote-turn', threadId: 'layout-chat', parentId: 'layout-turn',
      clientId: 'remote-device', createdAt: Date.now(), text: 'A new remote turn', conversationId: '01LAYOUTNATIVECONTEXT000000',
    },
    'react-dash.chat.v1.result.new-remote-turn': {
      version: 1, kind: 'result', id: 'new-remote-turn', threadId: 'layout-chat', createdAt: Date.now(),
      text: 'A new remote reply', conversationId: '01LAYOUTNATIVECONTEXT000000', response: 'answer', contextReset: false,
    },
  }))
  await expect(dialog.getByText('A new remote reply', { exact: true })).toBeAttached()
  expect(await body.evaluate((element) => element.scrollTop)).toBe(before)
  const latest = dialog.getByRole('button', { name: 'View Latest Message', exact: true })
  await expect(latest).toHaveCount(0)
  await body.evaluate((element) => { element.scrollTop = element.scrollHeight })
  await expect.poll(async () => {
    const owner = await body.boundingBox()
    const tail = await dialog.getByText('A new remote reply', { exact: true }).boundingBox()
    return tail!.y + tail!.height <= owner!.y + owner!.height + 1
  }).toBe(true)
})

test('multiline keyboard input and pending controls fit a synthetic contracted viewport', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 852, height: 393 })
  await installSyntheticKeyboard(page)
  const dialog = await openChat(page)
  await applyProfile(page, 'island-phone-landscape-left')
  const input = dialog.getByRole('textbox', { name: 'Chat Message' })
  await input.fill('First line')
  await input.press('Shift+Enter')
  await input.press('a')
  await expect(input).toHaveValue('First line\na')
  await input.dispatchEvent('compositionstart')
  await input.press('Enter')
  await input.dispatchEvent('compositionend')
  await input.dispatchEvent('keydown', { key: 'Enter', isComposing: true })
  await input.dispatchEvent('keydown', { key: 'Enter', keyCode: 229 })
  await input.dispatchEvent('keydown', { key: 'Enter', repeat: true })
  expect(await page.evaluate(() => window.__mockHass!.chat.messages.filter((message) => message.type === 'conversation/process').length)).toBe(0)
  await page.evaluate(() => {
    Object.assign(window.visualViewport!, { height: 263 })
    window.visualViewport!.dispatchEvent(new Event('resize'))
  })
  await expect.poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue('--dashboard-keyboard-overlay-inset'))).toBe('130px')
  const frame = await dialog.boundingBox()
  expect(frame!.x).toBeCloseTo(71, 0)
  expect(frame!.y).toBeCloseTo(8, 0)
  expect(frame!.width).toBeCloseTo(725, 0)
  expect(frame!.height).toBeCloseTo(226, 0)
  await page.evaluate(() => window.__mockHass!.chat.setPending())
  await input.press('Enter')
  await expect(dialog.locator('[data-chat-thinking]')).toBeAttached()
  await input.press('Enter')
  await input.dispatchEvent('submit')
  await expect(input).toBeFocused()
  await expectReachableChatActions(dialog)
  for (const control of [dialog.getByRole('button', { name: 'Close' }), dialog.locator('[data-chat-composer]'), dialog.getByRole('tablist')]) {
    const box = await control.boundingBox()
    expect(box!.y + box!.height).toBeLessThanOrEqual(263)
  }
  await expect.poll(() => page.evaluate(() => window.__mockHass!.chat.messages.filter((message) => message.type === 'conversation/process').length)).toBe(1)
  const { composer, send, inputBox } = await dialog.locator('[data-chat-composer]').evaluate((element) => ({
    composer: element.getBoundingClientRect().toJSON(),
    send: element.querySelector('button')!.getBoundingClientRect().toJSON(),
    inputBox: element.querySelector('textarea')!.getBoundingClientRect().toJSON(),
  }))
  expect(send!.width).toBe(44)
  expect(send!.height).toBe(44)
  expect(Math.abs(send!.y + 22 - composer!.y - composer!.height / 2)).toBeLessThanOrEqual(1)
  expect(composer!.x + composer!.width - send!.x - send!.width).toBe(9)
  expect(inputBox!.x + inputBox!.width).toBeLessThan(send!.x)
  const directory = resolve(process.env.RESPONSIVE_ARTIFACT_DIR ?? 'artifacts/chat-ux/candidate', testInfo.project.name)
  mkdirSync(directory, { recursive: true })
  await page.screenshot({ path: resolve(directory, 'composer-keyboard.png'), scale: 'css' })
  await applyProfile(page, 'phone-portrait')
  await expect(input).toHaveValue('')
})

test('chat history and new-chat actions remain reachable at a long transcript tail and under keyboard contraction', async ({ page }, testInfo) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ width: 393, height: 852 })
  await installSyntheticKeyboard(page)
  const dialog = await openChatState(page, 'long')
  await dialog.getByRole('button', { name: 'Continue Anyway', exact: true }).click()
  const body = dialog.locator('[data-modal-sheet-body]')
  const directory = resolve(process.env.RESPONSIVE_ARTIFACT_DIR ?? 'artifacts/chat-ux/candidate', testInfo.project.name)
  mkdirSync(directory, { recursive: true })
  for (const profile of ['phone-portrait', 'island-phone-landscape-left', 'island-phone-landscape-right', 'small-rectangular-landscape', 'rectangular-phone-landscape', 'intermediate-landscape', 'desktop']) {
    await applyProfile(page, profile)
    await waitForModalReady(dialog)
    await body.evaluate((element) => { element.scrollTop = element.scrollHeight })
    const atTail = await body.evaluate((element) => element.scrollTop)
    expect(atTail).toBeGreaterThan(0)
    await expectReachableChatActions(dialog)
    expect(await body.evaluate((element) => element.scrollTop)).toBe(atTail)
    await page.screenshot({ path: resolve(directory, `header-tail-${profile}.png`), scale: 'css' })
    await dialog.getByRole('button', { name: 'View History', exact: true }).click()
    await expect(dialog).toHaveAccessibleName('Chat History')
    await expectReachableChatActions(dialog, true)
    await dialog.getByRole('button', { name: 'Back', exact: true }).click()
    await expect(dialog).toHaveAccessibleName('Home Assistant')
    await expect(dialog.getByRole('button', { name: 'View History', exact: true })).toBeFocused()
    await expect.poll(() => body.evaluate((element) => element.scrollTop)).toBeCloseTo(atTail, 0)
  }
  await applyProfile(page, 'island-phone-landscape-left')
  await dialog.getByRole('textbox', { name: 'Chat Message' }).focus()
  await page.evaluate(() => {
    Object.assign(window.visualViewport!, { height: 263 })
    window.visualViewport!.dispatchEvent(new Event('resize'))
  })
  await expect.poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue('--dashboard-keyboard-overlay-inset'))).toBe('130px')
  await body.evaluate((element) => { element.scrollTop = element.scrollHeight })
  expect(await body.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
  await expectReachableChatActions(dialog)
  const frame = await dialog.boundingBox()
  expect(frame!.height).toBeCloseTo(226, 0)
  await page.screenshot({ path: resolve(directory, 'header-tail-keyboard.png'), scale: 'css' })
  await dialog.getByRole('button', { name: 'Start New Chat', exact: true }).click()
  await expect(dialog.locator('[data-chat-role]')).toHaveCount(0)
  await expect(dialog.getByRole('textbox', { name: 'Chat Message' })).toHaveValue('')
  expect(await page.evaluate(() => window.__mockHass!.chat.messages.filter((message) => message.type === 'conversation/process').length)).toBe(0)
})

for (const state of ['not-sent', 'oversized-reply', 'multiple-agents', 'unreadable', 'limit'] as const) {
  test(`chat ${state} has explicit recovery and reachable controls across the focused viewport journey`, async ({ page }, testInfo) => {
    test.setTimeout(120_000)
    const dialog = await openChatState(page, state)
    const directory = resolve(process.env.RESPONSIVE_ARTIFACT_DIR ?? 'artifacts/chat-ux/candidate', testInfo.project.name)
    mkdirSync(directory, { recursive: true })
    for (const profile of ['phone-portrait', 'island-phone-landscape-left', 'small-rectangular-landscape', 'desktop']) {
      await applyProfile(page, profile)
      await chatStateFacts(dialog, state)
      if (state === 'oversized-reply') {
        await dialog.locator('[data-modal-sheet-body]').evaluate((element) => { element.scrollTop = element.scrollHeight })
        await expect(dialog.getByRole('alert')).toBeInViewport()
      }
      await expectReachableChatActions(dialog)
      await page.screenshot({ path: resolve(directory, `${state}-${profile}.png`), scale: 'css' })
    }
    if (state === 'unreadable' || state === 'limit') {
      await page.evaluate(() => window.__mockHass!.chat.replaceRecords({}))
      await dialog.getByRole('button', { name: 'Retry Loading Chat', exact: true }).click()
      await expect(dialog.getByRole('alert')).toHaveCount(0)
      await expect(dialog.getByRole('textbox', { name: 'Chat Message' })).toBeEnabled()
    } else if (state === 'multiple-agents') {
      await dialog.getByRole('combobox').selectOption('conversation.second_gemini')
      await expect(dialog.getByRole('textbox', { name: 'Chat Message' })).toBeEnabled()
      await expect(dialog.getByRole('combobox')).toHaveValue('conversation.second_gemini')
    } else if (state === 'not-sent') {
      await dialog.getByRole('button', { name: 'Start New Chat', exact: true }).click()
      await expect(dialog.getByRole('textbox', { name: 'Chat Message' })).toBeEnabled()
      await expect(dialog.getByRole('textbox', { name: 'Chat Message' })).toHaveValue('')
    }
    expect(await page.evaluate(() => window.__mockHass!.chat.messages.filter((message) => message.type === 'conversation/process').length)).toBe(state === 'oversized-reply' ? 1 : 0)
    expect(await page.evaluate(() => window.__mockHass!.chat.messages.some((message) => String(message.type).includes('device_registry')))).toBe(false)
  })
}
