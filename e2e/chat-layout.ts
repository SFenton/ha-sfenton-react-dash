import { expect, type Locator, type Page } from './layout/fixture'
import { modalFacts, waitForModalReady, waitForRoute } from './layout/evidence'
import { chatFixtureRecords, CHAT_FIXTURE_PROMPT, CHAT_LAYOUT_STATES } from '../src/test/fixtures/chat'
export type ChatLayoutState = typeof CHAT_LAYOUT_STATES[number]

export async function openChatState(page: Page, state: string) {
  if (!CHAT_LAYOUT_STATES.includes(state as ChatLayoutState)) throw new Error(`Unknown chat fixture state: ${state}`)
  if (state === 'settings') {
    await page.addInitScript(() => { window.__homeMcpUrl = '/__layout-home-mcp' })
    await page.route('**/__layout-home-mcp', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          result: {
            structuredContent: {
              chatModel: 'Gemini 3.1 Flash Lite',
              mcpVersion: '0.2.0',
              supportedTools: ['lights'],
              queue: { enabled: true, autoPublish: true, pending: 0, processing: false, lastError: null },
              improvements: [{
                version: '0.2.0',
                publishedAt: '2026-09-10T14:00:00.000Z',
                summary: ['Learns from completed light conversations one at a time.'],
              }],
            },
          },
        }),
      })
    })
  }
  await page.goto('/index.html?path=overview')
  await waitForRoute(page, 'overview')
  const seeded = !['empty', 'history-empty', 'conversation', 'loading', 'unavailable', 'load-error', 'request-save-error', 'save-error', 'pending', 'oversized-reply', 'multiple-agents', 'unreadable', 'limit', 'settings'].includes(state)
  if (seeded) {
    const kind = ['archive', 'unknown', 'conflict', 'long', 'reset', 'empty-reply', 'agent-error', 'not-sent', 'history-retained', 'light-room-control', 'light-color-control', 'light-custom-color-control', 'light-brightness-control'].includes(state)
      ? state as Parameters<typeof chatFixtureRecords>[0] : 'conversation'
    await page.evaluate((records) => window.__mockHass!.chat.seed(records), chatFixtureRecords(kind, Date.now()))
  }
  if (state === 'limit') await page.evaluate((records) => window.__mockHass!.chat.seed(records), chatFixtureRecords('limit', Date.now()))
  await page.evaluate((state) => {
    const chat = window.__mockHass!.chat
    if (state === 'loading') chat.setLoading()
    if (state === 'load-error') chat.setLoadFailure(true)
    if (state === 'unavailable' || state === 'removed-agent') chat.setAgentsAvailable(false)
    if (state === 'request-save-error') chat.setWriteFailure(true)
    if (state === 'save-error') chat.setResultWriteFailure(true)
    if (state === 'pending') chat.setPending()
    if (state === 'oversized-reply') chat.setReply('x'.repeat(64001))
    if (state === 'multiple-agents') chat.setAgents([
      { id: 'conversation.mock_gemini', name: 'Google Gemini' },
      { id: 'conversation.second_gemini', name: 'Second Assistant' },
    ])
    if (state === 'unreadable') chat.seed({ 'react-dash.chat.v9.future': { version: 9 } })
  }, state)
  await page.getByRole('button', { name: 'Open Chat and Quick Links', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await waitForModalReady(dialog)
  if (state === 'settings') await dialog.getByRole('button', { name: 'Open Chat Settings', exact: true }).click()
  if (seeded || state === 'history-empty') {
    await dialog.getByRole('button', { name: 'View History', exact: true }).click()
    if (!['history', 'history-empty', 'history-retained'].includes(state)) await dialog.locator('[data-chat-history-thread]').first().click()
  }
  if (state === 'resume-ready' || state.startsWith('light-')) await dialog.getByRole('button', { name: 'Continue Anyway', exact: true }).click()
  if (state === 'conversation' || state === 'pending' || state === 'save-error' || state === 'request-save-error' || state === 'oversized-reply') {
    await dialog.getByRole('textbox', { name: 'Chat Message', exact: true }).fill(CHAT_FIXTURE_PROMPT)
    await dialog.getByRole('button', { name: 'Send Chat Message', exact: true }).click()
  }
  await assertChatState(dialog, state)
  await dialog.evaluate((element) => { element.setAttribute('data-layout-mounted', 'original') })
  return dialog
}

export async function chatStateFacts(dialog: Locator, state: string) {
    await assertChatState(dialog, state)
    const facts = await modalFacts(dialog, 'body', state === 'light-custom-color-control' ? 'controls' : 'chat-content')
    await expect(dialog).toHaveAttribute('data-layout-mounted', 'original')
    await expect(dialog.getByRole('tab', { name: 'Home Assistant', exact: true })).toHaveAttribute('aria-selected', 'true')
    const geometry = await dialog.evaluate((element) => {
      const frame = element.getBoundingClientRect()
      const body = element.querySelector<HTMLElement>('[data-modal-sheet-body]')!.getBoundingClientRect()
      const navigation = element.querySelector<HTMLElement>('[data-modal-tab-nav]')!.getBoundingClientRect()
      const composer = element.querySelector<HTMLElement>('[data-chat-composer]')
      const composerRect = composer?.getBoundingClientRect()
      const actions = [...element.querySelectorAll<HTMLElement>('[data-chat-header-action]')].map((action) => {
        const rect = action.getBoundingClientRect()
        const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
        return {
          width: rect.width, height: rect.height,
          hitInset: -parseFloat(getComputedStyle(action, '::before').top),
          insideHeader: rect.left >= frame.left && rect.right <= frame.right && rect.top >= frame.top && rect.bottom <= body.top,
          hit: hit === action || action.contains(hit),
        }
      })
      const messages = [...element.querySelectorAll<HTMLElement>('[data-chat-role]')].map((message) => {
        const rect = message.getBoundingClientRect()
        return { width: rect.width, contained: rect.left >= body.left && rect.right <= body.right, overflow: message.scrollWidth - message.clientWidth }
      })
      return {
        composerAboveTabs: !composerRect || composerRect.bottom <= navigation.top + 1,
        navigationInside: navigation.left >= frame.left && navigation.right <= frame.right && navigation.bottom <= frame.bottom,
        composerCount: composer ? 1 : 0, messages, actions,
        documentOverflow: document.documentElement.scrollWidth - innerWidth,
        tabs: [...element.querySelectorAll('[role="tab"]')].map((tab) => tab.getAttribute('aria-label')),
      }
    })
    expect(geometry.composerAboveTabs).toBe(true)
    expect(geometry.navigationInside).toBe(true)
    expect(geometry.composerCount).toBe(['history', 'history-empty', 'history-retained', 'settings', 'light-custom-color-control'].includes(state) ? 0 : 1)
    expect(geometry.documentOverflow).toBeLessThanOrEqual(1)
    expect(geometry.tabs).toEqual(['Home Assistant', 'Quick Links'])
    const expectedActions = state === 'settings' || state === 'light-custom-color-control'
      ? 0
      : ['history', 'history-empty', 'history-retained'].includes(state) ? 2 : 3
    expect(geometry.actions).toHaveLength(expectedActions)
    for (const action of geometry.actions) {
      expect(action.width).toBe(38)
      expect(action.height).toBe(38)
      expect(action.width + action.hitInset * 2).toBeGreaterThanOrEqual(44)
      expect(action.insideHeader).toBe(true)
      expect(action.hit).toBe(true)
    }
    for (const message of geometry.messages) {
      expect(message.contained).toBe(true)
      expect(message.overflow).toBeLessThanOrEqual(1)
    }
    return { ...facts, selectedState: state, chat: geometry }
}

export async function assertChatState(dialog: Locator, state: string) {
  if (state === 'loading') {
    await expect(dialog.getByRole('status')).toHaveText('Loading Chat History from Home Assistant…')
  } else if (state === 'empty') {
    await expect(dialog.getByRole('heading', { name: 'Home Assistant Agent', exact: true })).toBeVisible()
  } else if (state === 'history-empty') {
    await expect(dialog.getByRole('heading', { name: 'No Stored Chats for This Account', exact: true })).toBeVisible()
  } else if (state === 'settings') {
    await expect(dialog).toHaveAccessibleName('Chat Settings')
    await expect(dialog.locator('[data-chat-settings="true"]')).toBeVisible()
    await expect(dialog.getByText('Gemini 3.1 Flash Lite', { exact: true })).toBeVisible()
    await expect(dialog.getByText('0.2.0', { exact: true })).toBeVisible()
  } else if (state === 'history' || state === 'history-retained') {
    await expect(dialog.locator('[data-chat-history-thread]')).toHaveCount(1)
    if (state === 'history-retained') await expect(dialog.locator('[data-chat-history-thread="layout-chat-retained"]')).toHaveCount(0)
  } else if (state === 'unavailable') {
    await expect(dialog.getByRole('heading', { name: 'No Assistant Available', exact: true })).toBeVisible()
  } else if (state === 'load-error') {
    await expect(dialog.getByRole('alert')).toContainText('Chat could not be loaded')
  } else if (state === 'save-error' || state === 'request-save-error') {
    await expect(dialog.getByRole('alert')).toContainText('could not be saved')
    if (state === 'save-error') await expect(dialog.locator('[data-chat-role="assistant"]')).toContainText('Reply History Save Unconfirmed')
    else await expect(dialog.getByRole('textbox', { name: 'Chat Message' })).toHaveValue(CHAT_FIXTURE_PROMPT)
  } else if (state === 'pending') {
    await expect(dialog.locator('[data-chat-thinking]')).toBeVisible()
  } else if (state === 'archive') {
    await expect(dialog.getByText('The earlier assistant context may have expired.', { exact: false })).toBeVisible()
  } else if (state === 'resume' || state === 'resume-ready') {
    await expect(dialog.locator('[data-chat-resume-warning]')).toContainText('could be handled without previous messages')
    if (state === 'resume') await expect(dialog.getByRole('button', { name: 'Continue Anyway' })).toBeVisible()
    else await expect(dialog.getByRole('textbox', { name: 'Chat Message' })).toBeEnabled()
  } else if (state === 'removed-agent') {
    await expect(dialog.getByText('This assistant is no longer available.', { exact: false })).toBeVisible()
  } else if (state === 'conflict') {
    await expect(dialog.getByText('Messages overlapped with messages from another device.', { exact: false })).toBeVisible()
    await expect(dialog.locator('[data-chat-role="user"]')).toHaveCount(3)
  } else if (state === 'unknown') {
    await expect(dialog.getByText('The reply outcome is unknown', { exact: false })).toBeVisible()
    await expect(dialog.locator('[data-chat-role="assistant"]')).toHaveCount(0)
  } else if (state === 'reset') {
    await expect(dialog.getByText('Home Assistant started a new conversation for this reply', { exact: false })).toBeVisible()
  } else if (state === 'empty-reply') {
    await expect(dialog.getByText('Home Assistant returned no readable reply.', { exact: false })).toBeVisible()
  } else if (state === 'agent-error') {
    await expect(dialog.getByText('The assistant reported an error.', { exact: false })).toBeVisible()
  } else if (state === 'not-sent') {
    await expect(dialog.getByText('The displayed message was not submitted to the assistant.', { exact: false })).toBeVisible()
    await expect(dialog.getByRole('textbox', { name: 'Chat Message' })).toBeDisabled()
  } else if (state === 'oversized-reply') {
    await expect(dialog.getByRole('alert')).toContainText('refreshing or closing the browser loses the unsaved reply')
    expect(await dialog.locator('[data-chat-role="assistant"] > div').evaluate((element) => element.textContent === 'x'.repeat(64001))).toBe(true)
    await expect(dialog.getByText('Reply History Save Unconfirmed')).toBeVisible()
  } else if (state === 'light-room-control') {
    await expect(dialog.getByText('Which room?', { exact: true })).toBeVisible()
    await expect(dialog.getByRole('listbox', { name: 'Rooms' })).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Send Selection' })).toBeEnabled()
  } else if (state === 'light-color-control') {
    await expect(dialog.getByText('What color would you like to change the Music Room lights to?', { exact: true })).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Send Color' })).toBeEnabled()
    await expect(dialog.getByRole('button', { name: 'Custom' })).toBeVisible()
  } else if (state === 'light-custom-color-control') {
    const picker = dialog.locator('[data-light-color-picker="true"]')
    const customButton = dialog.getByRole('button', { name: 'Custom' })
    await expect.poll(async () => await picker.isVisible() || await customButton.isVisible()).toBe(true)
    if (await customButton.isVisible()) {
      await customButton.click()
      await expect(dialog).toHaveAccessibleName('Custom')
    }
    await expect(picker).toBeVisible()
    await expect(dialog.getByRole('spinbutton', { name: 'R channel' })).toHaveValue('255')
  } else if (state === 'light-brightness-control') {
    await expect(dialog.getByRole('slider', { name: 'Brightness' })).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Send Brightness' })).toBeEnabled()
    await expect(dialog.getByRole('button', { name: 'Are They On?' })).toBeEnabled()
  } else if (state === 'multiple-agents') {
    await expect(dialog.getByRole('combobox')).toBeVisible()
    await expect(dialog.getByRole('textbox', { name: 'Chat Message' })).toBeDisabled()
  } else if (state === 'unreadable' || state === 'limit') {
    await expect(dialog.getByRole('alert')).toContainText(state === 'unreadable' ? 'unreadable format' : 'storage limit')
    await expect(dialog.getByRole('button', { name: 'Retry Loading Chat' })).toBeEnabled()
  } else {
    await expect(dialog.locator('[data-chat-role="user"]')).toHaveCount(1)
    await expect(dialog.locator('[data-chat-role="assistant"]')).toHaveCount(1)
  }
}
