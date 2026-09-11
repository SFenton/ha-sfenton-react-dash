export const CHAT_STORAGE_PREFIX = 'react-dash.chat.'
export const CHAT_STORAGE_VERSION = 1
export const CHAT_MESSAGE_LIMIT = 180
export const CHAT_REPLY_LIMIT = 64_000
export const CHAT_RECORD_LIMIT = 2000
export const CHAT_THREAD_LIMIT = 100
export const CHAT_BYTE_LIMIT = 1_500_000
export const CHAT_CONTEXT_IDLE_MS = 5 * 60_000
export const CHAT_PENDING_MS = 2 * 60_000
export const CHAT_HISTORY_VISIBLE_MS = 14 * 24 * 60 * 60_000
const LIGHT_POLARITIES = new Set(['on', 'off'])
type LightPolarity = 'on' | 'off'

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

export interface ChatSkillContext {
  domain: string
  roomId: string | null
  entityIds: string[]
  lightNames: string[]
  lastAction?: 'on' | 'off' | 'up' | 'down' | 'brightness' | 'color' | 'state' | 'count' | 'list' | 'rooms-on' | 'color-state' | 'brightness-state' | 'history' | 'reason' | 'pbl' | 'pbl-rules' | 'set'
  lastState?: 'on' | 'off' | 'mixed' | 'unavailable'
  targetState?: LightPolarity
  historyBefore?: string
}

export type ChatResponseControl =
  | { id: string; kind: 'room-picker'; options: Array<{ label: string; value: string; message: string }> }
  | { id: string; kind: 'color-picker'; room: string; rooms: string[]; palette: string[]; supportsCustomRgb: boolean; colorMode: 'rgb' | 'temperature'; entityIds: string[]; subject?: string; currentRgb?: [number, number, number]; currentTemperatureKelvin?: number; minTemperatureKelvin: number; maxTemperatureKelvin: number }
  | { id: string; kind: 'brightness-slider'; room: string; value: number; min: number; max: number; step: number; subject?: string }
  | { id: string; kind: 'suggestions'; options: Array<{ label: string; message: string }> }

export interface ChatRequestRecord extends RecordBase {
  kind: 'request'
  threadId: string
  parentId: string | null
  clientId: string
  text: string
  conversationId: string | null
  sourceControlId?: string | null
  sourceResultId?: string | null
}

export interface ChatResultRecord extends RecordBase {
  kind: 'result'
  threadId: string
  text: string | null
  conversationId: string | null
  response: 'answer' | 'error' | 'empty'
  contextReset: boolean
  controls?: ChatResponseControl[]
  skillContext?: ChatSkillContext | null
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

export interface ChatImprovementConversation {
  version: 1
  threadId: string
  createdAt: number
  updatedAt: number
  turns: Array<{
    id: string
    createdAt: number
    userText: string
    assistantText: string | null
    outcome: 'answer' | 'error' | 'empty'
    parsedAsLights: boolean
    contextBefore: ChatSkillContext | null
    contextAfter: ChatSkillContext | null
  }>
}

const identifier = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(value)
const nullableString = (value: unknown): value is string | null => value === null || typeof value === 'string'
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const compareId = (left: string, right: string) => left < right ? -1 : left > right ? 1 : 0

function stringArray(value: unknown, max = 100): string[] | null {
  return Array.isArray(value) && value.length <= max && value.every((item) => typeof item === 'string') ? value : null
}

function parseSkillContext(value: unknown): ChatSkillContext | null {
  if (value === null || value === undefined) return null
  if (!object(value) || typeof value.domain !== 'string' || !(value.roomId === null || typeof value.roomId === 'string')) return null
  const entityIds = stringArray(value.entityIds)
  const lightNames = stringArray(value.lightNames)
  if (!entityIds || !lightNames) return null
  const lastAction = typeof value.lastAction === 'string' && /^(?:on|off|up|down|brightness|color|state|count|list|rooms-on|color-state|brightness-state|history|reason|pbl|pbl-rules|set)$/.test(value.lastAction)
    ? value.lastAction : undefined
  const lastState = typeof value.lastState === 'string' && /^(?:on|off|mixed|unavailable)$/.test(value.lastState)
    ? value.lastState : undefined
  const requestedPolarity = typeof value.targetState === 'string' && LIGHT_POLARITIES.has(value.targetState)
    ? value.targetState as LightPolarity : undefined
  const historyBefore = typeof value.historyBefore === 'string' ? value.historyBefore : undefined
  return {
    domain: value.domain,
    roomId: value.roomId,
    entityIds,
    lightNames,
    ...(lastAction ? { lastAction } : {}),
    ...(lastState ? { lastState } : {}),
    ...(requestedPolarity ? { targetState: requestedPolarity } : {}),
    ...(historyBefore ? { historyBefore } : {}),
  } as ChatSkillContext
}

function parseControls(value: unknown): ChatResponseControl[] | null {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.length > 8) return null
  const controls: ChatResponseControl[] = []
  for (const item of value) {
    if (!object(item) || !identifier(item.id) || typeof item.kind !== 'string') return null
    if (item.kind === 'room-picker') {
      if (!Array.isArray(item.options) || item.options.length > 30 || !item.options.every((option) => object(option) && typeof option.label === 'string' && typeof option.value === 'string' && typeof option.message === 'string' && option.message.length <= CHAT_MESSAGE_LIMIT)) return null
      controls.push({ id: item.id, kind: item.kind, options: item.options.map((option) => ({ label: String(option.label), value: String(option.value), message: String(option.message) })) })
    } else if (item.kind === 'color-picker') {
      const palette = stringArray(item.palette, 30)
      const rooms = stringArray(item.rooms, 30) ?? (typeof item.room === 'string' ? [item.room] : null)
      const entityIds = stringArray(item.entityIds, 100) ?? []
      const colorMode = item.colorMode === 'rgb' || item.colorMode === 'temperature' ? item.colorMode : item.supportsCustomRgb === true ? 'rgb' : 'temperature'
      const minTemperatureKelvin = typeof item.minTemperatureKelvin === 'number' ? item.minTemperatureKelvin : 2000
      const maxTemperatureKelvin = typeof item.maxTemperatureKelvin === 'number' ? item.maxTemperatureKelvin : 6500
      const currentRgb = Array.isArray(item.currentRgb) && item.currentRgb.length === 3 && item.currentRgb.every((channel) => typeof channel === 'number' && Number.isFinite(channel))
        ? item.currentRgb as [number, number, number] : undefined
      if (typeof item.room !== 'string' || !rooms || !palette || typeof item.supportsCustomRgb !== 'boolean' || !Number.isFinite(minTemperatureKelvin) || !Number.isFinite(maxTemperatureKelvin)) return null
      controls.push({ id: item.id, kind: item.kind, room: item.room, rooms, palette, supportsCustomRgb: item.supportsCustomRgb, colorMode, entityIds, minTemperatureKelvin, maxTemperatureKelvin, ...(typeof item.subject === 'string' ? { subject: item.subject } : {}), ...(currentRgb ? { currentRgb } : {}), ...(typeof item.currentTemperatureKelvin === 'number' && Number.isFinite(item.currentTemperatureKelvin) ? { currentTemperatureKelvin: item.currentTemperatureKelvin } : {}) })
    } else if (item.kind === 'brightness-slider') {
      if (typeof item.room !== 'string' || ![item.value, item.min, item.max, item.step].every((number) => typeof number === 'number' && Number.isFinite(number))) return null
      controls.push({ id: item.id, kind: item.kind, room: item.room, value: item.value as number, min: item.min as number, max: item.max as number, step: item.step as number, ...(typeof item.subject === 'string' ? { subject: item.subject } : {}) })
    } else if (item.kind === 'suggestions') {
      if (!Array.isArray(item.options) || item.options.length > 12 || !item.options.every((option) => object(option) && typeof option.label === 'string' && typeof option.message === 'string' && option.message.length <= CHAT_MESSAGE_LIMIT)) return null
      controls.push({ id: item.id, kind: item.kind, options: item.options.map((option) => ({ label: String(option.label), message: String(option.message) })) })
    } else return null
  }
  return controls
}

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
      || typeof value.text !== 'string' || !value.text.trim() || !nullableString(value.conversationId)
      || !(value.sourceControlId === undefined || value.sourceControlId === null || identifier(value.sourceControlId))
      || !(value.sourceResultId === undefined || value.sourceResultId === null || identifier(value.sourceResultId))) return null
    return {
      ...scoped, kind: 'request', parentId: value.parentId, clientId: value.clientId, text: value.text,
      conversationId: value.conversationId, sourceControlId: value.sourceControlId ?? null,
      sourceResultId: value.sourceResultId ?? null,
    }
  }
  if (value.kind === 'result') {
    const controls = parseControls(value.controls)
    const skillContext = parseSkillContext(value.skillContext)
    if (!nullableString(value.text) || !nullableString(value.conversationId) || controls === null
      || (value.skillContext !== undefined && value.skillContext !== null && skillContext === null)
      || !['answer', 'error', 'empty'].includes(String(value.response)) || typeof value.contextReset !== 'boolean') return null
    return {
      ...scoped, kind: 'result', text: value.text, conversationId: value.conversationId,
      response: value.response as ChatResultRecord['response'], contextReset: value.contextReset,
      controls, skillContext,
    }
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

export function visibleChatHistoryThreads(threads: readonly ChatThread[], now: number) {
  const cutoff = now - CHAT_HISTORY_VISIBLE_MS
  return threads.filter((thread) => thread.turns.length > 0 && thread.updatedAt >= cutoff)
}

export function chatImprovementConversation(thread: ChatThread): ChatImprovementConversation | null {
  if (!thread.turns.length || thread.turns.some((turn) => !turn.result || turn.state !== 'answered')) return null
  return {
    version: 1,
    threadId: thread.record.id,
    createdAt: thread.record.createdAt,
    updatedAt: thread.updatedAt,
    turns: thread.turns.map((turn, index) => ({
      id: turn.request.id,
      createdAt: turn.request.createdAt,
      userText: turn.request.text,
      assistantText: turn.result?.text ?? null,
      outcome: turn.result?.response ?? 'empty',
      parsedAsLights: turn.result?.skillContext?.domain === 'lights',
      contextBefore: index > 0 ? thread.turns[index - 1].result?.skillContext ?? null : null,
      contextAfter: turn.result?.skillContext ?? null,
    })),
  }
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
