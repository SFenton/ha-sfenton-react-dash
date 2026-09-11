import { loadRuntimeEnvironment } from './lib/runtimeEnv'
import { chatImprovementConversation, deriveChatThreads, readChatData } from '../src/components/hass/chat/chatRecords'

interface RpcResult {
  id?: number
  type?: string
  success?: boolean
  result?: unknown
  message?: string
}

function websocketUrl(url: string) {
  const parsed = new URL(url)
  parsed.protocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:'
  parsed.pathname = '/api/websocket'
  parsed.search = ''
  parsed.hash = ''
  return parsed.href
}

async function readFrontendUserData(haUrl: string, token: string) {
  const socket = new WebSocket(websocketUrl(haUrl))
  return new Promise<unknown>((resolvePromise, reject) => {
    const timeout = setTimeout(() => {
      socket.close()
      reject(new Error('Home Assistant user-data request timed out'))
    }, 30_000)
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data)) as RpcResult
      if (message.type === 'auth_required') {
        socket.send(JSON.stringify({ type: 'auth', access_token: token }))
      } else if (message.type === 'auth_invalid') {
        clearTimeout(timeout)
        socket.close()
        reject(new Error('Home Assistant rejected the configured token'))
      } else if (message.type === 'auth_ok') {
        socket.send(JSON.stringify({ id: 1, type: 'frontend/get_user_data' }))
      } else if (message.id === 1 && message.type === 'result') {
        clearTimeout(timeout)
        socket.close()
        if (!message.success) reject(new Error(message.message ?? 'Home Assistant user-data request failed'))
        else resolvePromise(message.result)
      }
    })
    socket.addEventListener('error', () => {
      clearTimeout(timeout)
      reject(new Error('Could not connect to Home Assistant user data'))
    })
  })
}

async function callReview(homeMcpUrl: string, token: string, conversation: NonNullable<ReturnType<typeof chatImprovementConversation>>, id: number) {
  const response = await fetch(homeMcpUrl, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id,
      method: 'tools/call',
      params: { name: 'home_chat_review', arguments: { conversation } },
    }),
  })
  const payload = await response.json() as { error?: { message?: string }; result?: { structuredContent?: { status?: string } } }
  if (!response.ok || payload.error) throw new Error(payload.error?.message ?? `Home MCP returned ${response.status}`)
  return payload.result?.structuredContent?.status ?? 'unknown'
}

function readLimit() {
  const index = process.argv.indexOf('--limit')
  const value = index >= 0 ? Number(process.argv[index + 1]) : 10
  if (!Number.isInteger(value) || value < 1 || value > 100) throw new Error('--limit must be between 1 and 100')
  return value
}

loadRuntimeEnvironment()
const haUrl = process.env.VITE_HA_URL
const token = process.env.VITE_HA_TOKEN
if (!haUrl || !token) throw new Error('VITE_HA_URL and VITE_HA_TOKEN are required')
const homeMcpUrl = process.env.HOME_MCP_URL ?? new URL('/api/sfenton_home_mcp', haUrl).href

const data = readChatData(await readFrontendUserData(haUrl, token))
const conversations = deriveChatThreads(data.records, Date.now())
  .map(chatImprovementConversation)
  .filter((conversation): conversation is NonNullable<typeof conversation> => conversation !== null)
  .slice(0, readLimit())
const counts = new Map<string, number>()
for (let index = 0; index < conversations.length; index += 1) {
  const status = await callReview(homeMcpUrl, token, conversations[index], index + 1)
  counts.set(status, (counts.get(status) ?? 0) + 1)
}
console.log(`Reviewed ${conversations.length} retained conversation(s): ${[...counts].map(([status, count]) => `${status}=${count}`).join(', ') || 'none'}.`)
