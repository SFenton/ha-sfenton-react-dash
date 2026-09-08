import type { ChatAgent, ChatConnection } from '../../components/hass/chat/chatClient'

export const MOCK_CHAT_AGENT: ChatAgent = { id: 'conversation.mock_gemini', name: 'Google Gemini' }

export interface MockChatConnection extends ChatConnection {
  connected: boolean
  disconnect: () => void
  reconnect: () => void
}

export interface MockChatCall {
  userId: string
  message: Record<string, unknown>
}

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T

export class MockChatServer {
  readonly users = new Map<string, Record<string, unknown>>()
  readonly calls: MockChatCall[] = []
  readonly subscriptions = new Map<string, Set<(value: unknown) => void>>()
  readonly sessions = new Map<string, number>()
  agents: ChatAgent[] = [MOCK_CHAT_AGENT]
  platforms: Record<string, string> = { [MOCK_CHAT_AGENT.id]: 'google_generative_ai_conversation' }
  beforeWrite?: (call: MockChatCall) => Promise<void>
  beforeRead?: (userId: string) => Promise<void>
  beforeSubscribe?: () => Promise<void>
  process?: (call: MockChatCall) => Promise<unknown>
  private conversationNumber = 0

  data(userId: string) {
    if (!this.users.has(userId)) this.users.set(userId, {})
    return this.users.get(userId)!
  }

  seed(userId: string, values: Record<string, unknown>) {
    Object.assign(this.data(userId), clone(values))
    this.notify(userId)
  }

  notify(userId: string) {
    const value = clone(this.data(userId))
    for (const subscriber of this.subscriptions.get(userId) ?? []) subscriber({ value })
  }

  reset() {
    this.users.clear()
    this.calls.length = 0
    this.sessions.clear()
    this.beforeRead = undefined
    this.beforeWrite = undefined
    this.beforeSubscribe = undefined
    this.process = undefined
    this.agents = [MOCK_CHAT_AGENT]
    this.platforms = { [MOCK_CHAT_AGENT.id]: 'google_generative_ai_conversation' }
    for (const userId of this.subscriptions.keys()) this.notify(userId)
  }

  async handle(userId: string, message: Record<string, unknown>): Promise<unknown> {
    const call = { userId, message: clone(message) }
    this.calls.push(call)
    if (message.type === 'auth/current_user') return { id: userId }
    if (message.type === 'conversation/agent/list') return { agents: this.agents.map(({ id, name }) => ({ id, name })) }
    if (message.type === 'config/entity_registry/get_entries') {
      return Object.fromEntries((message.entity_ids as string[]).map((id) => [id, {
        entity_id: id, platform: this.platforms[id], disabled_by: null,
      }]))
    }
    if (message.type === 'frontend/get_user_data') {
      await this.beforeRead?.(userId)
      const data = this.data(userId)
      return { value: clone(typeof message.key === 'string' ? data[message.key] ?? null : data) }
    }
    if (message.type === 'frontend/set_user_data') {
      await this.beforeWrite?.(call)
      this.data(userId)[String(message.key)] = clone(message.value)
      this.notify(userId)
      return null
    }
    if (message.type === 'conversation/process') {
      if (this.process) return this.process(call)
      const previous = typeof message.conversation_id === 'string' ? message.conversation_id : ''
      const lastUpdated = this.sessions.get(previous)
      const conversationId = lastUpdated && Date.now() - lastUpdated < 5 * 60_000
        ? previous : `01MOCK${String(++this.conversationNumber).padStart(20, '0')}`
      this.sessions.set(conversationId, Date.now())
      return {
        conversation_id: conversationId, continue_conversation: true,
        response: { response_type: 'query_answer', speech: { plain: { speech: 'What would you like to explore next?' } } },
      }
    }
    throw new Error(`Unsupported mocked chat command: ${String(message.type)}`)
  }

  subscribe(userId: string, callback: (value: unknown) => void) {
    this.calls.push({ userId, message: { type: 'frontend/subscribe_user_data' } })
    const subscribers = this.subscriptions.get(userId) ?? new Set()
    subscribers.add(callback)
    this.subscriptions.set(userId, subscribers)
    callback({ value: clone(this.data(userId)) })
    return () => {
      subscribers.delete(callback)
      this.calls.push({ userId, message: { type: 'unsubscribe_events' } })
    }
  }

  connect(userId: string): MockChatConnection {
    const listeners = new Map<string, Set<() => void>>()
    const subscriptions = new Set<() => void>()
    const outstanding = new Set<(error: Error) => void>()
    const connection: MockChatConnection = {
      connected: true,
      sendMessagePromise: <T,>(message: Record<string, unknown>) => {
        if (!connection.connected) return Promise.reject(new Error('Mock connection lost'))
        return new Promise<T>((resolve, reject) => {
          outstanding.add(reject)
          void this.handle(userId, message).then((value) => resolve(value as T), reject).finally(() => outstanding.delete(reject))
        })
      },
      subscribeMessage: async <T,>(callback: (value: T) => void) => {
        await this.beforeSubscribe?.()
        const unsubscribe = this.subscribe(userId, (value) => callback(value as T))
        subscriptions.add(unsubscribe)
        return () => { subscriptions.delete(unsubscribe); unsubscribe() }
      },
      addEventListener: (name, listener) => {
        const set = listeners.get(name) ?? new Set()
        set.add(listener)
        listeners.set(name, set)
      },
      removeEventListener: (name, listener) => { listeners.get(name)?.delete(listener) },
      disconnect: () => {
        connection.connected = false
        for (const reject of outstanding) reject(new Error('Mock connection lost'))
        outstanding.clear()
        for (const unsubscribe of subscriptions) unsubscribe()
        subscriptions.clear()
        for (const listener of listeners.get('disconnected') ?? []) listener()
      },
      reconnect: () => {
        connection.connected = true
        for (const listener of listeners.get('ready') ?? []) listener()
      },
    }
    return connection
  }
}

export interface ChatMockBridge {
  request: (message: Record<string, unknown>) => Promise<unknown>
  subscribe: (id: string) => Promise<void>
  unsubscribe: (id: string) => Promise<void>
}

type ChatMockWindow = Window & {
  __chatMockBridge?: ChatMockBridge
  __chatMockReceive?: (id: string, value: unknown) => void
}

export const mockChatServer = new MockChatServer()
const browserSubscribers = new Map<string, (value: unknown) => void>()
export const mockChatMessages: Record<string, unknown>[] = []

export function isChatMockCommand(message: Record<string, unknown>) {
  return ['auth/current_user', 'conversation/agent/list', 'config/entity_registry/get_entries', 'config/device_registry/list',
    'frontend/get_user_data', 'frontend/set_user_data', 'conversation/process'].includes(String(message.type))
}

export function mockChatRequest(userId: string, message: Record<string, unknown>) {
  mockChatMessages.push(clone(message))
  const bridge = typeof window === 'undefined' ? undefined : (window as ChatMockWindow).__chatMockBridge
  return bridge ? bridge.request(message) : mockChatServer.handle(userId, message)
}

export async function mockChatSubscribe<T>(userId: string, callback: (value: T) => void) {
  mockChatMessages.push({ type: 'frontend/subscribe_user_data' })
  const bridge = typeof window === 'undefined' ? undefined : (window as ChatMockWindow).__chatMockBridge
  if (!bridge) return mockChatServer.subscribe(userId, (value) => callback(value as T))
  const id = crypto.randomUUID()
  browserSubscribers.set(id, (value) => callback(value as T))
  ;(window as ChatMockWindow).__chatMockReceive = (subscriptionId, value) => browserSubscribers.get(subscriptionId)?.(value)
  await bridge.subscribe(id)
  return () => {
    browserSubscribers.delete(id)
    return bridge.unsubscribe(id)
  }
}
