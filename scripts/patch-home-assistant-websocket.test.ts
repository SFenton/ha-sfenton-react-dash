import { getCollection } from 'home-assistant-js-websocket/dist/collection.js'
import {
  patchEmbeddedCollectionTeardown,
  patchReadyListenerCleanup,
} from './patch-home-assistant-websocket.mjs'

interface FakeConnection {
  [key: string]: unknown
  addEventListener: (event: string, callback: () => void) => void
  connected: boolean
  removeEventListener: (event: string, callback: () => void) => void
}

function fakeConnection() {
  const listeners = new Map<string, Set<() => void>>()
  const connection: FakeConnection = {
    addEventListener(event, callback) {
      const callbacks = listeners.get(event) ?? new Set()
      callbacks.add(callback)
      listeners.set(event, callbacks)
    },
    connected: true,
    removeEventListener(event, callback) {
      listeners.get(event)?.delete(callback)
    },
  }
  return { connection, listeners }
}

describe('Home Assistant websocket cleanup patch', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('replaces only the mismatched ready-listener callback', () => {
    expect(patchReadyListenerCleanup(
      'conn.addEventListener("ready", refreshSwallow); conn.removeEventListener("ready", refresh);',
    )).toEqual({
      changed: true,
      source: 'conn.addEventListener("ready", refreshSwallow); conn.removeEventListener("ready", refreshSwallow);',
    })
  })

  it('accepts an already-patched dependency and rejects an unknown source shape', () => {
    expect(patchReadyListenerCleanup(
      'conn.removeEventListener("ready", refreshSwallow);',
    )).toEqual({
      changed: false,
      source: 'conn.removeEventListener("ready", refreshSwallow);',
    })
    expect(() => patchReadyListenerCleanup('const unrelated = true')).toThrow(
      'Unable to find the expected ready-listener cleanup',
    )
  })

  it('tears embedded collections down synchronously and removes their parent cache', () => {
    const source = `const getCollection = (conn, key) => {
    let store = createStore();
    const teardownUpdateSubscription = () => {
        conn.removeEventListener("disconnected", handleDisconnect);
    };
    const scheduleTeardownUpdateSubscription = () => {
        unsubTimer = setTimeout(teardownUpdateSubscription, UNSUB_GRACE_PERIOD);
    };
    // @ts-ignore
    conn[key] = {
        subscribe() {}
    };
    // @ts-ignore
    return conn[key];
};
// Legacy name`

    const patched = patchEmbeddedCollectionTeardown(source)

    expect(patched.changed).toBe(true)
    expect(patched.source).toContain(
      'const embeddedWindow = typeof window !== "undefined" && window.top !== window;',
    )
    expect(patched.source).toContain('if (embeddedWindow) {')
    expect(patched.source).toContain('delete conn[key];')
    expect(patched.source).toContain('const collection = {')
    expect(patched.source).toContain('conn[key] = collection;')
    expect(patched.source).toContain('return collection;')
  })

  it('removes the actual collection ready listener after the last subscriber leaves', async () => {
    vi.useFakeTimers()
    const { connection, listeners } = fakeConnection()
    const collection = getCollection(
      connection,
      '_lifecycle_test',
      async () => [],
      undefined,
    )
    const unsubscribe = collection.subscribe(() => undefined)

    expect(listeners.get('ready')?.size).toBe(1)
    unsubscribe()
    await vi.advanceTimersByTimeAsync(5_000)

    expect(listeners.get('ready')?.size ?? 0).toBe(0)
  })
})
