import { createHash } from 'node:crypto'

const AUTH_TIMEOUT_MS = 10_000
const AUTH_CACHE_MS = 60_000
const MAX_AUTH_CACHE_ENTRIES = 256

export interface AuthenticatedHassUser {
  id: string
  isAdmin: boolean
}

export class HassAuthenticationError extends Error {
  constructor(readonly kind: 'invalid' | 'unavailable', message: string) {
    super(message)
  }
}

interface AuthenticatorOptions {
  hassUrl: string
  now?: () => number
  WebSocketImpl?: typeof WebSocket
}

function websocketUrl(hassUrl: string) {
  const url = new URL(hassUrl)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  url.pathname = '/api/websocket'
  url.search = ''
  url.hash = ''
  return url.href
}

function parseUser(value: unknown): AuthenticatedHassUser | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const user = value as Record<string, unknown>
  const isAdmin = user.is_admin ?? user.isAdmin
  return typeof user.id === 'string' && user.id
    && typeof isAdmin === 'boolean'
    ? { id: user.id, isAdmin }
    : null
}

export function createHassUserAuthenticator(options: AuthenticatorOptions) {
  const now = options.now ?? Date.now
  const WebSocketImpl = options.WebSocketImpl ?? WebSocket
  const url = websocketUrl(options.hassUrl)
  const cache = new Map<string, { expiresAt: number; user: AuthenticatedHassUser }>()

  return async (token: string) => {
    const currentTime = now()
    for (const [key, value] of cache) if (value.expiresAt <= currentTime) cache.delete(key)
    const tokenHash = createHash('sha256').update(token).digest('hex')
    const cached = cache.get(tokenHash)
    if (cached && cached.expiresAt > currentTime) return cached.user

    const user = await new Promise<AuthenticatedHassUser>((resolve, reject) => {
      const socket = new WebSocketImpl(url)
      let settled = false
      const finish = (action: () => void) => {
        if (settled) return
        settled = true
        clearTimeout(timeout)
        socket.close()
        action()
      }
      const timeout = setTimeout(() => finish(() => reject(new HassAuthenticationError('unavailable', 'Home Assistant authentication timed out'))), AUTH_TIMEOUT_MS)

      socket.addEventListener('message', (event) => {
        let message: Record<string, unknown>
        try {
          message = JSON.parse(String(event.data)) as Record<string, unknown>
        } catch {
          finish(() => reject(new HassAuthenticationError('unavailable', 'Home Assistant returned invalid authentication data')))
          return
        }
        if (message.type === 'auth_required') {
          socket.send(JSON.stringify({ type: 'auth', access_token: token }))
          return
        }
        if (message.type === 'auth_invalid') {
          finish(() => reject(new HassAuthenticationError('invalid', 'Home Assistant authorization was rejected')))
          return
        }
        if (message.type === 'auth_ok') {
          socket.send(JSON.stringify({ id: 1, type: 'auth/current_user' }))
          return
        }
        if (message.type === 'result' && message.id === 1) {
          const parsed = message.success === true ? parseUser(message.result) : null
          if (!parsed) {
            finish(() => reject(new HassAuthenticationError('unavailable', 'Home Assistant did not return a valid user')))
            return
          }
          finish(() => resolve(parsed))
        }
      })
      socket.addEventListener('error', () => finish(() => reject(new HassAuthenticationError('unavailable', 'Home Assistant authentication is unavailable'))))
      socket.addEventListener('close', () => {
        if (!settled) finish(() => reject(new HassAuthenticationError('unavailable', 'Home Assistant closed authentication early')))
      })
    })

    if (cache.size >= MAX_AUTH_CACHE_ENTRIES) cache.delete(cache.keys().next().value as string)
    cache.set(tokenHash, { expiresAt: now() + AUTH_CACHE_MS, user })
    return user
  }
}
