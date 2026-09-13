import {
  CHAT_BYTE_LIMIT, CHAT_CONTEXT_IDLE_MS, CHAT_HISTORY_VISIBLE_MS, CHAT_MESSAGE_LIMIT, CHAT_PENDING_MS,
  CHAT_RECORD_LIMIT, CHAT_REPLY_LIMIT, CHAT_THREAD_LIMIT, chatAvailability, chatRecordBytes, chatRecordKey,
  chatImprovementConversation, deriveChatThreads, parseChatRecord, readChatData, sameChatRecord, visibleChatHistoryThreads,
  type ChatAvailability, type ChatRecord, type ChatRequestRecord, type ChatResponseControl, type ChatResultRecord,
  type ChatSkillContext, type ChatStatusRecord, type ChatThread, type ChatThreadRecord,
} from './chatRecords'
import { createChatId } from './chatId'
import { HomeMcpRequestRejected, type HomeMcpClient } from './homeMcpClient'

export interface ChatConnection {
  connected?: boolean
  options?: { auth?: { accessToken?: string } }
  sendMessagePromise: <T>(message: Record<string, unknown>) => Promise<T>
  subscribeMessage: <T>(callback: (value: T) => void, message: Record<string, unknown>, options?: { resubscribe?: boolean }) => Promise<() => void | Promise<void>>
  addEventListener?: (event: 'ready' | 'disconnected', listener: () => void) => void
  removeEventListener?: (event: 'ready' | 'disconnected', listener: () => void) => void
}

export interface ChatAgent {
  id: string
  name: string
}

export type ChatIssue = 'load' | 'save' | 'limit' | 'unreadable' | 'message-limit' | null

export interface ChatSnapshot {
  status: 'idle' | 'loading' | 'ready' | 'error'
  connected: boolean
  agents: ChatAgent[]
  agentId: string
  threads: ChatThread[]
  historyThreads: ChatThread[]
  selectedId: string | null
  draft: string
  busy: boolean
  waitingId: string | null
  availability: ChatAvailability
  consented: boolean
  issue: ChatIssue
  unsavedKeys: ReadonlySet<string>
  improvementIssue: boolean
}

class ChatFailure extends Error {
  readonly issue: Exclude<ChatIssue, null>
  constructor(issue: Exclude<ChatIssue, null>) {
    super(issue)
    this.issue = issue
  }
}

class ChatBlocked extends Error {}

const isObject = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const GEMINI_PLATFORM = 'google_generative_ai_conversation'
export const HOME_MCP_AGENT: ChatAgent = { id: 'conversation.home_mcp', name: 'Home Assistant' }
export const CHAT_METADATA_TIMEOUT_MS = 30_000

async function discoverAgents(connection: Pick<ChatConnection, 'sendMessagePromise'>): Promise<ChatAgent[]> {
  const response = await connection.sendMessagePromise<unknown>({ type: 'conversation/agent/list' })
  if (!isObject(response) || !Array.isArray(response.agents)) throw new ChatFailure('load')
  const agents = response.agents.filter((agent): agent is ChatAgent => isObject(agent)
    && typeof agent.id === 'string' && /^conversation\.[a-z0-9_]+$/.test(agent.id)
    && typeof agent.name === 'string' && Boolean(agent.name.trim()))
  if (!agents.length) return []
  const entries = await connection.sendMessagePromise<unknown>({
    type: 'config/entity_registry/get_entries', entity_ids: agents.map((agent) => agent.id),
  })
  if (!isObject(entries)) throw new ChatFailure('load')
  return agents.filter((agent) => {
    const entry = entries[agent.id]
    return isObject(entry) && entry.platform === GEMINI_PLATFORM && !entry.disabled_by
  }).map(({ id, name }) => ({ id, name }))
}

function instanceControls(value: unknown, requestId: string) {
  if (!Array.isArray(value)) return []
  return value.map((control, index) => isObject(control)
    ? { ...control, id: `control-${requestId}-${index}` }
    : control) as ChatResponseControl[]
}

function conversationResult(response: unknown, request: ChatRequestRecord, now: number): ChatResultRecord {
  if (!isObject(response)) throw new ChatFailure('load')
  const conversationId = typeof response.conversation_id === 'string' && response.conversation_id ? response.conversation_id : null
  if (typeof response.text === 'string' && response.text.trim()) {
    const candidate = parseChatRecord({
      version: 1, kind: 'result', id: request.id, threadId: request.threadId, createdAt: now,
      text: response.text, conversationId, response: 'answer',
      contextReset: request.conversationId !== null && conversationId !== request.conversationId,
      controls: instanceControls(response.controls, request.id),
      skillContext: isObject(response.context) ? response.context as unknown as ChatSkillContext : null,
      handledByHomeMcp: response.handled_by_home_mcp === true,
      homeMcpStatus: response.handled_by_home_mcp === true && typeof response.status === 'string'
        ? response.status
        : undefined,
    })
    if (!candidate || candidate.kind !== 'result') throw new ChatFailure('load')
    return candidate
  }
  if (!isObject(response.response)) throw new ChatFailure('load')
  const result = response.response
  const speech = isObject(result.speech) && isObject(result.speech.plain) ? result.speech.plain.speech : null
  const plainSpeech = typeof speech === 'string' && speech.trim() ? speech : null
  const candidate = parseChatRecord({
    version: 1, kind: 'result', id: request.id, threadId: request.threadId, createdAt: now,
    text: plainSpeech, conversationId, response: result.response_type === 'error' ? 'error' : plainSpeech ? 'answer' : 'empty',
    contextReset: request.conversationId !== null && conversationId !== request.conversationId,
    controls: [], skillContext: isObject(response.context) ? response.context : null,
    handledByHomeMcp: response.handled_by_home_mcp === true,
    homeMcpStatus: response.handled_by_home_mcp === true && typeof response.status === 'string'
      ? response.status
      : undefined,
  })
  if (!candidate || candidate.kind !== 'result') throw new ChatFailure('load')
  return candidate
}

/** Owns requests independently of modal content; all persistent records are HA-user scoped. */
export class ChatClient {
  private state: ChatSnapshot = {
    status: 'idle', connected: true, agents: [], agentId: '', threads: [], historyThreads: [], selectedId: null,
    draft: '', busy: false, waitingId: null, availability: 'fresh', consented: false, issue: null, unsavedKeys: new Set(),
    improvementIssue: false,
  }
  private readonly listeners = new Set<() => void>()
  private readonly records = new Map<string, ChatRecord>()
  private readonly unsaved = new Map<string, ChatRecord>()
  private readonly drafts = new Map<string, string>()
  private readonly knownTurns = new Set<string>()
  private readonly consents = new Set<string>()
  private unsubscribe?: () => void | Promise<void>
  private activated = false
  private generation = 0
  private loadGeneration = 0
  private selectionGeneration = 0
  private operationSequence = 0
  private activeOperation = 0
  private replyOperation = 0
  private clientId = ''
  private expiryTimer?: ReturnType<typeof setTimeout>
  private replyTimer?: ReturnType<typeof setTimeout>
  private recordIssue: 'limit' | 'unreadable' | null = null
  private observedBytes = 0
  private observedCount = 0
  private pendingRequest?: ChatRequestRecord
  private pendingControlId: string | null = null
  private pendingControlOwnerResultId: string | null = null
  private readonly pendingControlKeys = new Set<string>()
  private readonly pendingMetadata = new Set<() => void>()
  private readonly connection: ChatConnection
  private readonly userId: string
  private readonly now: () => number
  private readonly newId: () => string
  private readonly homeMcp?: HomeMcpClient

  constructor(
    connection: ChatConnection,
    userId: string,
    now = Date.now,
    newId = createChatId,
    homeMcp?: HomeMcpClient,
  ) {
    this.connection = connection
    this.userId = userId
    this.now = now
    this.newId = newId
    this.homeMcp = homeMcp
  }

  getSnapshot = () => this.state
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  private current(generation: number) { return this.activated && generation === this.generation }
  private draftKey() { return this.state.selectedId ?? 'draft' }
  private consentKey(thread: ChatThread | undefined) { return thread?.tail ? `${thread.record.id}:${thread.tail.id}` : '' }

  private beginOperation() {
    this.activeOperation = ++this.operationSequence
    this.publish({ busy: true })
    return this.activeOperation
  }

  private finishOperation(operation: number) {
    if (this.activeOperation !== operation) return
    this.activeOperation = 0
    this.publish({ busy: false })
  }

  private finishWaiting(operation: number, request?: ChatRequestRecord) {
    if (this.replyOperation === operation) {
      clearTimeout(this.replyTimer)
      this.replyTimer = undefined
      this.replyOperation = 0
    }
    if (request && this.pendingRequest?.id === request.id) this.pendingRequest = undefined
  }

  private rpc = <T,>(message: Record<string, unknown>): Promise<T> => new Promise((resolve, reject) => {
    let settled = false
    const finish = (action: () => void) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      this.pendingMetadata.delete(cancel)
      action()
    }
    const cancel = () => finish(() => reject(new ChatFailure('load')))
    const timer = setTimeout(cancel, CHAT_METADATA_TIMEOUT_MS)
    this.pendingMetadata.add(cancel)
    try {
      void this.connection.sendMessagePromise<T>(message).then(
        (value) => finish(() => resolve(value)),
        (error: unknown) => finish(() => reject(error)),
      )
    } catch (error) { finish(() => reject(error)) }
  })

  private publish(patch: Partial<ChatSnapshot> = {}) {
    this.state = { ...this.state, ...patch }
    const combined = new Map([...this.records, ...this.unsaved])
    const now = this.activated ? this.now() : 0
    const threads = deriveChatThreads(combined, now)
    const selected = threads.find((thread) => thread.record.id === this.state.selectedId)
    this.state = {
      ...this.state, threads, historyThreads: visibleChatHistoryThreads(threads, now),
      draft: this.drafts.get(this.draftKey()) ?? '',
      waitingId: this.pendingRequest?.id ?? null,
      availability: chatAvailability(selected, this.activated ? this.now() : 0, this.knownTurns, this.state.agents),
      consented: this.consents.has(this.consentKey(selected)),
      unsavedKeys: new Set(this.unsaved.keys()),
    }
    for (const listener of this.listeners) listener()
    this.scheduleExpiry()
  }

  private scheduleExpiry() {
    clearTimeout(this.expiryTimer)
    if (!this.activated) return
    const now = this.now()
    const deadlines = [...this.records.values(), ...this.unsaved.values()].flatMap((record) => {
      const deadline = record.createdAt + (record.kind === 'result' ? CHAT_CONTEXT_IDLE_MS : CHAT_PENDING_MS)
      return deadline > now ? [deadline] : []
    })
    deadlines.push(...this.state.historyThreads.flatMap((thread) => {
      const deadline = thread.updatedAt + CHAT_HISTORY_VISIBLE_MS + 1
      return deadline > now ? [deadline] : []
    }))
    if (deadlines.length) this.expiryTimer = setTimeout(() => this.publish(), Math.min(...deadlines) - now + 1)
  }

  private unsavedIssue(): 'limit' | 'unreadable' | null {
    let issue: 'limit' | null = null
    for (const [key, record] of this.unsaved) {
      const parsed = parseChatRecord(record)
      const saved = this.records.get(key)
      if (!parsed || chatRecordKey(parsed) !== key || (saved && !sameChatRecord(saved, record))) return 'unreadable'
      if (chatRecordBytes(record) > CHAT_BYTE_LIMIT || (record.kind === 'result' && (record.text?.length ?? 0) > CHAT_REPLY_LIMIT)) issue = 'limit'
    }
    return issue
  }

  private ingest(response: unknown, refresh = false) {
    const data = readChatData(response)
    for (const key of data.tombstones) {
      const removed = this.records.get(key)
      if (!removed) continue
      this.records.delete(key)
      this.knownTurns.delete(removed.id)
      this.observedCount = Math.max(0, this.observedCount - 1)
      this.observedBytes = Math.max(0, this.observedBytes - chatRecordBytes({ [key]: removed }))
    }
    if (refresh && data.issue !== 'unreadable') {
      this.records.clear()
      this.observedBytes = data.bytes
      this.observedCount = data.count
      this.recordIssue = data.issue
      this.knownTurns.clear()
      this.consents.clear()
    } else {
      this.observedBytes = Math.max(this.observedBytes, data.bytes)
      this.observedCount = Math.max(this.observedCount, data.count)
      this.recordIssue = data.issue === 'unreadable' ? data.issue : this.recordIssue ?? data.issue
    }
    for (const [key, record] of data.records) {
      const existing = this.records.get(key)
      if (existing && !sameChatRecord(existing, record)) this.recordIssue = 'unreadable'
      else this.records.set(key, record)
    }
    const localIssue = this.unsavedIssue()
    this.recordIssue = localIssue === 'unreadable' ? localIssue : this.recordIssue ?? localIssue
    this.publish({ issue: this.recordIssue ?? (this.unsaved.size || this.state.issue !== 'save' ? this.state.issue : null) })
  }

  private async verifyUser(generation: number) {
    if (!this.current(generation) || this.connection.connected === false) throw new ChatFailure('load')
    const user = await this.rpc<unknown>({ type: 'auth/current_user' })
    if (!this.current(generation) || !isObject(user) || user.id !== this.userId) throw new ChatFailure('load')
  }

  private async read(generation: number, refresh = false) {
    await this.verifyUser(generation)
    const response = await this.rpc<unknown>({ type: 'frontend/get_user_data' })
    if (!this.current(generation)) throw new ChatFailure('load')
    this.ingest(response, refresh)
  }

  private removeSubscription() {
    const unsubscribe = this.unsubscribe
    this.unsubscribe = undefined
    if (unsubscribe) void Promise.resolve(unsubscribe()).catch(() => undefined)
  }

  private onDisconnected = () => {
    if (!this.activated) return
    this.loadGeneration += 1
    this.removeSubscription()
    this.knownTurns.clear()
    this.consents.clear()
    this.publish({ connected: false })
  }

  private onReady = () => {
    if (!this.activated) return
    this.knownTurns.clear()
    this.consents.clear()
    void this.load()
  }

  async activate() {
    if (this.activated) return
    this.activated = true
    try { this.clientId ||= this.newId() } catch { this.publish({ status: 'error', issue: 'load' }); return }
    this.connection.addEventListener?.('disconnected', this.onDisconnected)
    this.connection.addEventListener?.('ready', this.onReady)
    await this.load()
  }

  async reload() {
    if (this.state.busy) return
    if (!this.clientId) {
      this.activated = false
      await this.activate()
    } else await this.load()
  }

  private async load() {
    if (!this.activated) return
    const generation = this.generation
    const loadGeneration = ++this.loadGeneration
    this.removeSubscription()
    this.publish({ status: 'loading', connected: this.connection.connected !== false, issue: this.recordIssue })
    try {
      await this.verifyUser(generation)
      const agents = this.homeMcp
        ? [HOME_MCP_AGENT]
        : await discoverAgents({ sendMessagePromise: this.rpc })
      await this.read(generation, true)
      if (!this.current(generation) || loadGeneration !== this.loadGeneration) return
      const unsubscribe = await this.connection.subscribeMessage<unknown>((response) => {
        if (!this.current(generation) || loadGeneration !== this.loadGeneration) return
        try { this.ingest(response) } catch { this.publish({ issue: 'unreadable' }) }
      }, { type: 'frontend/subscribe_user_data' }, { resubscribe: false })
      if (!this.current(generation) || loadGeneration !== this.loadGeneration) {
        void Promise.resolve(unsubscribe()).catch(() => undefined)
        return
      }
      this.unsubscribe = unsubscribe
      const agentId = agents.some((agent) => agent.id === this.state.agentId)
        ? this.state.agentId : agents.length === 1 ? agents[0].id : ''
      this.publish({ status: 'ready', connected: true, agents, agentId, issue: this.recordIssue ?? (this.unsaved.size ? 'save' : null) })
    } catch {
      if (this.current(generation) && loadGeneration === this.loadGeneration) this.publish({ status: 'error', issue: 'load' })
    }
  }

  setDraft(value: string) {
    this.drafts.set(this.draftKey(), value)
    const issue = this.state.issue === 'message-limit' ? null : this.state.issue
    this.publish({ issue: issue ?? (value.length > CHAT_MESSAGE_LIMIT ? 'message-limit' : null) })
  }

  selectAgent(agentId: string) {
    if (this.state.busy || this.state.selectedId || (agentId !== '' && !this.state.agents.some((agent) => agent.id === agentId))) return
    this.publish({ agentId })
  }

  selectThread(id: string) {
    if (!this.state.threads.some((thread) => thread.record.id === id)) return
    this.selectionGeneration += 1
    this.publish({ selectedId: id })
  }

  newChat() {
    void this.finishConversation()
    this.selectionGeneration += 1
    this.drafts.delete('draft')
    this.publish({ selectedId: null })
  }

  async finishConversation() {
    const thread = this.state.threads.find((item) => item.record.id === this.state.selectedId)
    const conversation = thread ? chatImprovementConversation(thread) : null
    if (!this.homeMcp?.endConversation || !conversation) return
    try {
      await this.homeMcp.endConversation(conversation.threadId)
      if (this.state.improvementIssue) this.publish({ improvementIssue: false })
    } catch {
      this.publish({ improvementIssue: true })
    }
  }

  async systemInfo() {
    return this.homeMcp?.info?.() ?? null
  }

  allowResume() {
    const thread = this.state.threads.find((item) => item.record.id === this.state.selectedId)
    if (chatAvailability(thread, this.now(), this.knownTurns, this.state.agents) !== 'confirm') return
    this.consents.add(this.consentKey(thread))
    this.publish()
  }

  private assertSendable(thread: ChatThread | undefined) {
    if (this.recordIssue) throw new ChatFailure(this.recordIssue)
    if (!this.state.connected || this.connection.connected === false) throw new ChatFailure('load')
    const availability = chatAvailability(thread, this.now(), this.knownTurns, this.state.agents)
    if (!['fresh', 'current'].includes(availability)
      && !(availability === 'confirm' && this.consents.has(this.consentKey(thread)))) throw new ChatBlocked()
    if (this.unsaved.size) throw new ChatFailure('save')
    const records = [...this.records.values()]
    const bytes = Math.max(this.observedBytes, records.reduce((total, record) => total + chatRecordBytes({ [chatRecordKey(record)]: record }), 0))
    // Reserve room for the reply before asking the agent; never prune an old record.
    if (Math.max(this.observedCount, records.length) + 5 > CHAT_RECORD_LIMIT || bytes + CHAT_REPLY_LIMIT * 4 + CHAT_MESSAGE_LIMIT * 4 > CHAT_BYTE_LIMIT
      || (!thread && records.filter((record) => record.kind === 'thread').length >= CHAT_THREAD_LIMIT)) throw new ChatFailure('limit')
  }

  private async persist(record: ChatRecord, generation: number) {
    if (!this.current(generation)) throw new ChatFailure('load')
    const key = chatRecordKey(record)
    const existing = this.records.get(key)
    if (existing && !sameChatRecord(existing, record)) throw new ChatFailure('unreadable')
    this.unsaved.set(key, record)
    this.publish()
    try {
      const issue = this.unsavedIssue()
      if (issue) {
        this.recordIssue = issue === 'unreadable' ? issue : this.recordIssue ?? issue
        throw new ChatFailure(issue)
      }
      await this.verifyUser(generation)
      await this.rpc({ type: 'frontend/set_user_data', key, value: record })
      if (!this.current(generation)) throw new ChatFailure('load')
      this.records.set(key, record)
      this.unsaved.delete(key)
      this.publish({ issue: this.recordIssue ?? (this.unsaved.size || this.state.issue !== 'save' ? this.state.issue : null) })
    } catch (error) {
      if (this.current(generation)) this.publish({ issue: this.recordIssue ?? 'save' })
      throw error
    }
  }

  private statusRecord(request: ChatRequestRecord, kind: ChatStatusRecord['kind']): ChatStatusRecord {
    const key = chatRecordKey({ kind, id: request.id })
    const existing = this.records.get(key) ?? this.unsaved.get(key)
    if (existing && existing.kind === kind && 'threadId' in existing && existing.threadId === request.threadId) return existing as ChatStatusRecord
    return { version: 1, kind, id: request.id, threadId: request.threadId, createdAt: this.now() }
  }

  async retrySave() {
    if (!this.activated || this.state.busy || !this.unsaved.size || this.recordIssue === 'unreadable') return
    const generation = this.generation
    const operation = this.beginOperation()
    try {
      for (const record of [...this.unsaved.values()]) await this.persist(record, generation)
    } catch { /* persist retains the exact unsaved record and reports the failure. */ }
    finally { if (this.current(generation)) this.finishOperation(operation) }
  }

  controlUsed(controlId: string, ownerResultId?: string) {
    return this.state.threads.some((thread) => thread.turns.some((turn) =>
      turn.request.sourceControlId === controlId && (!ownerResultId
        || turn.request.sourceResultId === ownerResultId
        || (!turn.request.sourceResultId && turn.request.parentId === ownerResultId))))
  }

  async sendControl(controlId: string, text: string, ownerResultId?: string) {
    const pendingKey = `${ownerResultId ?? ''}:${controlId}`
    if (this.state.busy || !controlId || this.pendingControlKeys.has(pendingKey) || this.controlUsed(controlId, ownerResultId)
      || text.length > CHAT_MESSAGE_LIMIT || !text.trim()) return
    this.pendingControlKeys.add(pendingKey)
    this.pendingControlId = controlId
    this.pendingControlOwnerResultId = ownerResultId ?? null
    this.publish()
    try { await this.dispatchRequest(text, this.draftKey(), false) }
    finally {
      this.pendingControlId = null
      this.pendingControlOwnerResultId = null
      this.pendingControlKeys.delete(pendingKey)
      this.publish()
    }
  }

  async send() {
    return this.dispatchRequest(this.state.draft, this.draftKey(), true)
  }

  private async dispatchRequest(text: string, draftKey: string, clearDraft: boolean) {
    if (!this.activated || this.state.status !== 'ready' || this.state.busy || !text.trim()) return
    if (text.length > CHAT_MESSAGE_LIMIT) { this.publish({ issue: 'message-limit' }); return }
    const generation = this.generation
    const selectionGeneration = this.selectionGeneration
    const selectedId = this.state.selectedId
    let request: ChatRequestRecord | undefined
    let dispatched = false
    let received = false
    const operation = this.beginOperation()
    try {
      await this.read(generation)
      const thread = this.state.threads.find((item) => item.record.id === selectedId)
      if (selectedId && !thread) throw new ChatFailure('load')
      this.assertSendable(thread)
      const agentId = thread?.record.agentId ?? this.state.agentId
      const agent = this.state.agents.find((item) => item.id === agentId)
      if (!agent) throw new ChatBlocked()
      const threadRecord: ChatThreadRecord = thread?.record ?? {
        version: 1, kind: 'thread', id: this.newId(), agentId: agent.id, agentName: agent.name, createdAt: this.now(),
      }
      request = {
        version: 1, kind: 'request', id: this.newId(), threadId: threadRecord.id, createdAt: this.now(),
        parentId: thread?.turns.at(-1)?.request.id ?? null, conversationId: thread?.tail?.conversationId ?? null,
        clientId: this.clientId, text, sourceControlId: this.pendingControlId,
        sourceResultId: this.pendingControlOwnerResultId,
      }
      if (!thread) await this.persist(threadRecord, generation)
      if (this.selectionGeneration === selectionGeneration) this.publish({ selectedId: threadRecord.id })
      await this.persist(request, generation)
      await this.read(generation)
      const currentThread = this.state.threads.find((item) => item.record.id === request?.threadId)
      if (currentThread?.conflict || currentThread?.unreadable) throw new ChatBlocked()
      if (!this.state.connected || this.connection.connected === false) throw new ChatFailure('load')
      if (clearDraft && this.drafts.get(draftKey) === text) this.drafts.delete(draftKey)
      this.pendingRequest = request
      const waiting = request
      this.replyOperation = operation
      this.replyTimer = setTimeout(() => {
        if (this.current(generation) && this.replyOperation === operation && this.pendingRequest?.id === waiting.id) {
          this.finishWaiting(operation, waiting)
          void this.persist(this.statusRecord(waiting, 'unknown'), generation).catch(() => undefined)
          this.finishOperation(operation)
        }
      }, CHAT_PENDING_MS)
      dispatched = true
      this.publish()
      const responsePromise = this.homeMcp
        ? this.homeMcp.request(text, request.conversationId, thread?.tail?.skillContext ?? null, {
            threadId: request.threadId,
            turnId: request.id,
            ...(request.sourceControlId ? { controlId: request.sourceControlId } : {}),
          })
        : this.connection.sendMessagePromise<unknown>({
            type: 'conversation/process', agent_id: agent.id, text, conversation_id: request.conversationId,
          })
      void this.persist(this.statusRecord(request, 'pending'), generation).catch(() => undefined)
      const response = await responsePromise
      if (!this.current(generation)) return
      this.finishWaiting(operation, request)
      const result = conversationResult(response, request, this.now())
      received = true
      this.knownTurns.add(request.id)
      await this.persist(result, generation)
    } catch (error) {
      if (!this.current(generation)) return
      this.finishWaiting(operation, request)
      if (request && !received && (this.records.has(chatRecordKey(request)) || this.unsaved.has(chatRecordKey(request)))) {
        const outcome = this.statusRecord(request, dispatched && !(error instanceof HomeMcpRequestRejected) ? 'unknown' : 'not-sent')
        if (!this.records.has(chatRecordKey(request))) {
          this.unsaved.set(chatRecordKey(outcome), outcome)
        } else {
          try { await this.persist(outcome, generation) } catch { /* Saving can be retried, never the prompt. */ }
        }
      }
      if (this.activeOperation === operation) {
        this.publish({ issue: this.recordIssue ?? (error instanceof ChatFailure && error.issue === 'limit' ? 'limit'
          : this.unsaved.size ? 'save' : error instanceof ChatFailure ? error.issue : error instanceof ChatBlocked || dispatched ? null : 'load') })
      }
    } finally {
      if (this.current(generation)) {
        this.finishWaiting(operation, request)
        this.finishOperation(operation)
      }
    }
  }

  dispose() {
    this.activated = false
    this.generation += 1
    this.loadGeneration += 1
    for (const cancel of this.pendingMetadata) cancel()
    clearTimeout(this.expiryTimer)
    clearTimeout(this.replyTimer)
    this.replyTimer = undefined
    this.replyOperation = 0
    this.activeOperation = 0
    this.removeSubscription()
    this.connection.removeEventListener?.('ready', this.onReady)
    this.connection.removeEventListener?.('disconnected', this.onDisconnected)
    this.knownTurns.clear()
    this.consents.clear()
    this.records.clear()
    this.unsaved.clear()
    this.drafts.clear()
    this.pendingRequest = undefined
    this.pendingControlId = null
    this.pendingControlOwnerResultId = null
    this.pendingControlKeys.clear()
    this.recordIssue = null
    this.observedBytes = 0
    this.observedCount = 0
    this.publish({ status: 'idle', connected: false, agents: [], agentId: '', selectedId: null, busy: false, issue: null, improvementIssue: false })
  }
}
