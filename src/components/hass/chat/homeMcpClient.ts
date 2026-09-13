import type { ChatSkillContext } from './chatRecords'

export interface HomeMcpImprovementRecord {
  version: string
  publishedAt: string
  summary: string[]
}

export interface HomeMcpInfo {
  chatModel: string
  mcpVersion: string
  supportedTools: ['lights']
  queue: {
    enabled: boolean
    autoPublish: boolean
    pending: number
    processing: boolean
    lastError: string | null
  }
  improvements: HomeMcpImprovementRecord[]
}

export interface HomeMcpConversation {
  version: 1
  threadId: string
  createdAt: number
  updatedAt: number
  turns: Array<{
    id: string
    createdAt: number
    userText: string
    assistantText: string | null
    outcome: 'answer' | 'error' | 'empty' | 'failed'
    parsedAsLights: boolean
    handledByHomeMcp: boolean
    contextBefore: ChatSkillContext | null
    contextAfter: ChatSkillContext | null
  }>
}

export interface HomeMcpClient {
  endConversation?: (threadId: string) => Promise<unknown>
  info?: () => Promise<HomeMcpInfo>
  request: (
    text: string,
    conversationId: string | null,
    context: ChatSkillContext | null,
    request?: { threadId: string; turnId: string; controlId?: string },
  ) => Promise<unknown>
  reviewConversation?: (conversation: HomeMcpConversation) => Promise<unknown>
}

export class HomeMcpRequestRejected extends Error {}

function object(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function parseHomeMcpInfo(value: unknown): HomeMcpInfo {
  if (!object(value) || typeof value.chatModel !== 'string' || typeof value.mcpVersion !== 'string'
    || !Array.isArray(value.supportedTools) || value.supportedTools.length !== 1 || value.supportedTools[0] !== 'lights'
    || !object(value.queue) || typeof value.queue.enabled !== 'boolean' || typeof value.queue.autoPublish !== 'boolean'
    || typeof value.queue.pending !== 'number' || typeof value.queue.processing !== 'boolean'
    || !(value.queue.lastError === null || typeof value.queue.lastError === 'string')
    || !Array.isArray(value.improvements)) throw new Error('Home MCP returned invalid system information')
  const improvements = value.improvements.map((item) => {
    if (!object(item) || typeof item.version !== 'string' || typeof item.publishedAt !== 'string'
      || !Array.isArray(item.summary) || !item.summary.every((summary) => typeof summary === 'string')) {
      throw new Error('Home MCP returned invalid improvement history')
    }
    return { version: item.version, publishedAt: item.publishedAt, summary: item.summary }
  })
  return {
    chatModel: value.chatModel,
    mcpVersion: value.mcpVersion,
    supportedTools: ['lights'],
    queue: {
      enabled: value.queue.enabled,
      autoPublish: value.queue.autoPublish,
      pending: value.queue.pending,
      processing: value.queue.processing,
      lastError: value.queue.lastError,
    },
    improvements,
  }
}

export function createHomeMcpClient(url: string, accessToken: () => string | undefined): HomeMcpClient {
  let requestId = 0
  const call = async (name: string, args: Record<string, unknown>) => {
    const headers = new Headers({ 'content-type': 'application/json' })
    const token = accessToken()
    if (token) headers.set('authorization', `Bearer ${token}`)
    const response = await fetch(url, {
      method: 'POST',
      credentials: 'same-origin',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0', id: ++requestId, method: 'tools/call',
        params: { name, arguments: args },
      }),
    })
    const payload = await response.json().catch(() => ({})) as { error?: string | { message?: string }; result?: { structuredContent?: unknown; content?: Array<{ type?: string; text?: string }> } }
    const errorMessage = typeof payload.error === 'string' ? payload.error : payload.error?.message
    if (response.status === 401 || response.status === 403) throw new HomeMcpRequestRejected(errorMessage ?? `Home MCP returned ${response.status}`)
    if (!response.ok || payload.error) throw new Error(errorMessage ?? `Home MCP returned ${response.status}`)
    if (payload.result?.structuredContent !== undefined) return payload.result.structuredContent
    const textContent = payload.result?.content?.find((item) => item.type === 'text')?.text
    if (!textContent) throw new Error('Home MCP returned no response')
    return JSON.parse(textContent) as unknown
  }

  return {
    endConversation: (threadId) => call('home_chat_end', { thread_id: threadId }),
    info: async () => parseHomeMcpInfo(await call('home_info', {})),
    request: (text, conversationId, context, request) => call('home_chat', {
      text,
      conversation_id: conversationId,
      context,
      ...(request ? {
        thread_id: request.threadId,
        turn_id: request.turnId,
        ...(request.controlId ? { control_id: request.controlId } : {}),
      } : {}),
    }),
    reviewConversation: (conversation) => call('home_chat_review', { conversation }),
  }
}
