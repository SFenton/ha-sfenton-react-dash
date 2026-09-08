export const CHAT_STORAGE_PREFIX = 'react-dash.chat.'
export const CHAT_STORAGE_VERSION = 1
export const CHAT_MESSAGE_LIMIT = 4000
export const CHAT_REPLY_LIMIT = 64_000
export const CHAT_RECORD_LIMIT = 2000
export const CHAT_THREAD_LIMIT = 100
export const CHAT_BYTE_LIMIT = 1_500_000
export const CHAT_CONTEXT_IDLE_MS = 5 * 60_000
export const CHAT_PENDING_MS = 2 * 60_000

interface RecordBase {
  version: 1
  id: string
  createdAt: number
}

export interface ChatThreadRecord extends RecordBase {
  kind: 'thread'
  agentId: string
  agentName: string
}

export interface ChatRequestRecord extends RecordBase {
  kind: 'request'
  threadId: string
  parentId: string | null
  clientId: string
  text: string
  conversationId: string | null
}

export interface ChatResultRecord extends RecordBase {
  kind: 'result'
  threadId: string
  text: string | null
  conversationId: string | null
  response: 'answer' | 'error' | 'empty'
  contextReset: boolean
}

export interface ChatStatusRecord extends RecordBase {
  kind: 'pending' | 'unknown' | 'not-sent'
  threadId: string
}

export type ChatRecord = ChatThreadRecord | ChatRequestRecord | ChatResultRecord | ChatStatusRecord
export type ChatRecordIssue = 'limit' | 'unreadable'

export interface ChatData {
  records: Map<string, ChatRecord>
  tombstones: Set<string>
  bytes: number
  count: number
  issue: ChatRecordIssue | null
}

export interface ChatTurn {
  request: ChatRequestRecord
  result?: ChatResultRecord
  state: 'saving' | 'pending' | 'answered' | 'unknown' | 'not-sent'
}

export interface ChatThread {
  record: ChatThreadRecord
  turns: ChatTurn[]
  tail?: ChatResultRecord
  title: string
  updatedAt: number
  conflict: boolean
  unreadable: boolean
}

const identifier = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(value)
const nullableString = (value: unknown): value is string | null => value === null || typeof value === 'string'
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const compareId = (left: string, right: string) => left < right ? -1 : left > right ? 1 : 0

export function chatRecordKey(record: Pick<ChatRecord, 'kind' | 'id'>) {
  return `${CHAT_STORAGE_PREFIX}v${CHAT_STORAGE_VERSION}.${record.kind}.${record.id}`
}

export function chatRecordBytes(value: unknown) {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength
}

export function parseChatRecord(value: unknown): ChatRecord | null {
  if (!object(value) || value.version !== 1 || !identifier(value.id)
    || typeof value.createdAt !== 'number' || !Number.isFinite(new Date(value.createdAt).getTime()) || value.createdAt < 0) return null
  const base: RecordBase = { version: 1, id: value.id, createdAt: value.createdAt }
  if (value.kind === 'thread') {
    if (typeof value.agentId !== 'string' || !/^conversation\.[a-z0-9_]+$/.test(value.agentId)
      || typeof value.agentName !== 'string' || !value.agentName.trim()) return null
    return { ...base, kind: 'thread', agentId: value.agentId, agentName: value.agentName }
  }
  if (!identifier(value.threadId)) return null
  const scoped = { ...base, threadId: value.threadId }
  if (value.kind === 'request') {
    if (!(value.parentId === null || identifier(value.parentId)) || !identifier(value.clientId)
      || typeof value.text !== 'string' || !value.text.trim() || !nullableString(value.conversationId)) return null
    return { ...scoped, kind: 'request', parentId: value.parentId, clientId: value.clientId, text: value.text, conversationId: value.conversationId }
  }
  if (value.kind === 'result') {
    if (!nullableString(value.text) || !nullableString(value.conversationId)
      || !['answer', 'error', 'empty'].includes(String(value.response)) || typeof value.contextReset !== 'boolean') return null
    return { ...scoped, kind: 'result', text: value.text, conversationId: value.conversationId, response: value.response as ChatResultRecord['response'], contextReset: value.contextReset }
  }
  if (value.kind === 'pending' || value.kind === 'unknown' || value.kind === 'not-sent') {
    return { ...scoped, kind: value.kind }
  }
  return null
}

export function readChatData(response: unknown): ChatData {
  if (!object(response) || !object(response.value)) throw new Error('invalid-chat-storage-response')
  const records = new Map<string, ChatRecord>()
  const tombstones = new Set<string>()
  let bytes = 0
  let count = 0
  let issue: ChatRecordIssue | null = null
  for (const [key, value] of Object.entries(response.value)) {
    if (!key.startsWith(CHAT_STORAGE_PREFIX)) continue
    if (value === null && /^react-dash\.chat\.v1\.(thread|request|result|pending|unknown|not-sent)\.[a-zA-Z0-9_-]{1,100}$/.test(key)) {
      tombstones.add(key)
      continue
    }
    count += 1
    bytes += chatRecordBytes({ [key]: value })
    const record = parseChatRecord(value)
    if (!record || chatRecordKey(record) !== key) issue = 'unreadable'
    else records.set(key, record)
  }
  if (!issue && (count > CHAT_RECORD_LIMIT || bytes > CHAT_BYTE_LIMIT
    || [...records.values()].filter((record) => record.kind === 'thread').length > CHAT_THREAD_LIMIT)) issue = 'limit'
  return { records, tombstones, bytes, count, issue }
}

export function sameChatRecord(left: ChatRecord, right: ChatRecord) {
  return JSON.stringify(parseChatRecord(left)) === JSON.stringify(parseChatRecord(right))
}

export function deriveChatThreads(records: ReadonlyMap<string, ChatRecord>, now: number): ChatThread[] {
  const all = [...records.values()]
  return all.filter((record): record is ChatThreadRecord => record.kind === 'thread').map((record) => {
    const requests = all.filter((item): item is ChatRequestRecord => item.kind === 'request' && item.threadId === record.id)
      .sort((left, right) => left.createdAt - right.createdAt || compareId(left.id, right.id))
    const byId = new Map(requests.map((request) => [request.id, request]))
    const children = new Map<string | null, ChatRequestRecord[]>()
    for (const request of requests) {
      const siblings = children.get(request.parentId) ?? []
      siblings.push(request)
      children.set(request.parentId, siblings)
    }
    const ordered: ChatRequestRecord[] = []
    const visited = new Set<string>()
    const append = (root: ChatRequestRecord) => {
      const pending = [root]
      while (pending.length) {
        const request = pending.pop()!
        if (visited.has(request.id)) continue
        visited.add(request.id)
        ordered.push(request)
        pending.push(...[...(children.get(request.id) ?? [])].reverse())
      }
    }
    for (const root of children.get(null) ?? []) append(root)
    const unreadable = ordered.length !== requests.length
      || requests.some((request) => request.parentId !== null && !byId.has(request.parentId))
      || all.some((item) => item.kind !== 'thread' && item.kind !== 'request' && item.threadId === record.id && !byId.has(item.id))
    for (const request of requests) append(request)
    const conflict = [...children.values()].some((siblings) => siblings.length > 1)
    const turns = ordered.map((request): ChatTurn => {
      const get = (kind: ChatRecord['kind']) => records.get(chatRecordKey({ kind, id: request.id }))
      const resultRecord = get('result')
      const result = resultRecord?.kind === 'result' && resultRecord.threadId === record.id ? resultRecord : undefined
      const pending = get('pending')
      const stopped = get('not-sent')
      const unknown = get('unknown')
      const state = result ? 'answered'
        : stopped ? 'not-sent'
          : unknown || now - (pending?.createdAt ?? request.createdAt) >= CHAT_PENDING_MS ? 'unknown'
            : pending ? 'pending' : 'saving'
      return { request, result, state }
    })
    const tail = turns.at(-1)?.result
    return {
      record, turns, tail, conflict, unreadable,
      title: turns[0]?.request.text ?? '',
      updatedAt: Math.max(record.createdAt, ...ordered.map((item) => item.createdAt), ...turns.map((turn) => turn.result?.createdAt ?? turn.request.createdAt)),
    }
  }).sort((left, right) => right.updatedAt - left.updatedAt || compareId(left.record.id, right.record.id))
}

export type ChatAvailability = 'fresh' | 'current' | 'confirm' | 'expired' | 'conflict' | 'unknown' | 'pending' | 'not-sent' | 'unavailable'

export function chatAvailability(thread: ChatThread | undefined, now: number, knownTurns: ReadonlySet<string>, agents: readonly { id: string }[]): ChatAvailability {
  if (!thread) return 'fresh'
  if (thread.conflict || thread.unreadable) return 'conflict'
  if (!agents.some((agent) => agent.id === thread.record.agentId)) return 'unavailable'
  const last = thread.turns.at(-1)
  if (last?.state === 'saving' || last?.state === 'pending') return 'pending'
  if (last?.state === 'unknown') return 'unknown'
  if (last?.state === 'not-sent') return 'not-sent'
  if (!thread.tail) return 'fresh'
  if (!thread.tail.conversationId || thread.tail.contextReset || thread.tail.response !== 'answer'
    || now - thread.tail.createdAt >= CHAT_CONTEXT_IDLE_MS) return 'expired'
  return knownTurns.has(thread.tail.id) ? 'current' : 'confirm'
}
