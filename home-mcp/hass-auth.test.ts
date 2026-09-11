import { createHassUserAuthenticator, HassAuthenticationError } from './hass-auth'

class MockWebSocket extends EventTarget {
  static instances: MockWebSocket[] = []
  readonly sent: string[] = []

  constructor(readonly url: string) {
    super()
    MockWebSocket.instances.push(this)
    queueMicrotask(() => this.message({ type: 'auth_required' }))
  }

  send(value: string) {
    this.sent.push(value)
    const message = JSON.parse(value)
    if (message.type === 'auth') this.message({ type: 'auth_ok' })
    if (message.type === 'auth/current_user') {
      this.message({ id: 1, type: 'result', success: true, result: { id: 'stable-user', is_admin: true } })
    }
  }

  close() {}

  private message(value: unknown) {
    this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(value) }))
  }
}

describe('Home Assistant user authentication', () => {
  beforeEach(() => { MockWebSocket.instances = [] })

  it('resolves and caches a stable Home Assistant user identity', async () => {
    let now = 1
    const authenticate = createHassUserAuthenticator({
      hassUrl: 'https://ha.example',
      now: () => now,
      WebSocketImpl: MockWebSocket as unknown as typeof WebSocket,
    })

    await expect(authenticate('token-one')).resolves.toEqual({ id: 'stable-user', isAdmin: true })
    now += 10
    await expect(authenticate('token-one')).resolves.toEqual({ id: 'stable-user', isAdmin: true })
    expect(MockWebSocket.instances).toHaveLength(1)
    expect(MockWebSocket.instances[0].url).toBe('wss://ha.example/api/websocket')
  })

  it('distinguishes rejected credentials from an unavailable auth service', async () => {
    class RejectingWebSocket extends EventTarget {
      constructor() {
        super()
        queueMicrotask(() => this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify({ type: 'auth_required' }) })))
      }
      send() {
        this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify({ type: 'auth_invalid' }) }))
      }
      close() {}
    }
    const authenticate = createHassUserAuthenticator({
      hassUrl: 'https://ha.example',
      WebSocketImpl: RejectingWebSocket as unknown as typeof WebSocket,
    })

    await expect(authenticate('bad-token')).rejects.toMatchObject<HassAuthenticationError>({ kind: 'invalid' })
  })
})
