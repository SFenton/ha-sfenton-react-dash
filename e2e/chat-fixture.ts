import { expect, type BrowserContext, type Page } from './layout/fixture'
import { waitForRoute } from './layout/evidence'
import { MockChatServer, type ChatMockBridge } from '../src/test/mocks/chatServer'

declare global {
  interface Window {
    __chatMockBridge?: ChatMockBridge
    __chatMockReceive?: (id: string, value: unknown) => void
    __chatFixtureRequest: (message: Record<string, unknown>) => Promise<unknown>
    __chatFixtureSubscribe: (id: string) => Promise<void>
    __chatFixtureUnsubscribe: (id: string) => Promise<void>
  }
}

export async function bindChatServer(context: BrowserContext, server: MockChatServer, userId: string) {
  const connection = server.connect(userId)
  const subscriptions = new Map<string, () => void>()
  await context.exposeBinding('__chatFixtureRequest', (_source, message: Record<string, unknown>) => connection.sendMessagePromise(message))
  await context.exposeBinding('__chatFixtureSubscribe', (source, id: string) => {
    const unsubscribe = server.subscribe(userId, (value) => {
      void source.frame.evaluate(({ id, value }) => window.__chatMockReceive?.(id, value), { id, value }).catch(() => {
        subscriptions.get(id)?.()
        subscriptions.delete(id)
      })
    })
    subscriptions.set(id, unsubscribe)
  })
  await context.exposeBinding('__chatFixtureUnsubscribe', (_source, id: string) => {
    subscriptions.get(id)?.()
    subscriptions.delete(id)
  })
  await context.addInitScript(() => {
    window.__chatMockBridge = {
      request: (message) => window.__chatFixtureRequest(message),
      subscribe: (id) => window.__chatFixtureSubscribe(id),
      unsubscribe: (id) => window.__chatFixtureUnsubscribe(id),
    }
  })
  context.on('close', () => {
    for (const unsubscribe of subscriptions.values()) unsubscribe()
    subscriptions.clear()
    connection.disconnect()
  })
  return connection
}

export async function openChat(page: Page, userId?: string) {
  await page.goto('/index.html?path=overview')
  await waitForRoute(page, 'overview')
  if (userId) await page.evaluate((id) => window.__mockHass!.setUser({ id, name: 'Chat Test User', is_admin: false }), userId)
  await page.getByRole('button', { name: 'Open Chat and Quick Links', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Home Assistant', exact: true })
  await expect(dialog.getByRole('textbox', { name: 'Chat Message', exact: true })).toBeEnabled()
  return page.getByRole('dialog')
}

export async function sendChat(page: Page, text: string) {
  const dialog = page.getByRole('dialog', { name: 'Home Assistant', exact: true })
  const before = await dialog.locator('[data-chat-role="assistant"]').count()
  await dialog.getByRole('textbox', { name: 'Chat Message', exact: true }).fill(text)
  await dialog.getByRole('button', { name: 'Send Chat Message', exact: true }).click()
  await expect(dialog.locator('[data-chat-role="assistant"]')).toHaveCount(before + 1)
  await expect(dialog.getByText('Reply History Save Unconfirmed', { exact: true })).toHaveCount(0)
  return dialog
}
