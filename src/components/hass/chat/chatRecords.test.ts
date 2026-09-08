import {
  CHAT_CONTEXT_IDLE_MS, CHAT_STORAGE_PREFIX, chatAvailability, chatRecordKey, deriveChatThreads,
  readChatData, type ChatRecord, type ChatRequestRecord, type ChatResultRecord, type ChatThreadRecord,
} from './chatRecords'

const thread: ChatThreadRecord = { version: 1, kind: 'thread', id: 'thread', agentId: 'conversation.test', agentName: 'Test Agent', createdAt: 1000 }
const request: ChatRequestRecord = {
  version: 1, kind: 'request', id: 'one', threadId: 'thread', parentId: null, clientId: 'client',
  text: 'First message', conversationId: null, createdAt: 2000,
}
const result: ChatResultRecord = {
  version: 1, kind: 'result', id: 'one', threadId: 'thread', text: 'First reply', conversationId: 'native-one',
  response: 'answer', contextReset: false, createdAt: 3000,
}
const data = (...records: ChatRecord[]) => Object.fromEntries(records.map((record) => [chatRecordKey(record), record]))

describe('chat records', () => {
  it('ignores owned retention tombstones without admitting unknown schemas', () => {
    const parsed = readChatData({ value: {
      ...data(thread), [chatRecordKey(request)]: null, [chatRecordKey(result)]: null,
    } })
    expect(parsed.issue).toBeNull()
    expect(parsed.count).toBe(1)
    expect(parsed.records.size).toBe(1)
    expect(readChatData({ value: { 'react-dash.chat.v2.thread.future': null } }).issue).toBe('unreadable')
    expect(readChatData({ value: { 'react-dash.chat.v1.model-change.old': null } }).issue).toBe('unreadable')
  })
  it('treats archived model changes as unsupported instead of routing a switched transcript', () => {
    const change = {
      version: 1, kind: 'model-change', id: 'change', parentId: request.id, threadId: thread.id, createdAt: 500,
      agentId: 'conversation.other', agentName: 'Other agent', modelName: 'gemini-2.5-pro',
    }
    const next: ChatRequestRecord = { ...request, id: 'next', parentId: change.id, conversationId: null, createdAt: 400 }
    const parsed = readChatData({ value: { ...data(thread, request, result, next), [`${CHAT_STORAGE_PREFIX}v1.model-change.change`]: change } })
    expect(parsed.issue).toBe('unreadable')
    expect(parsed.count).toBe(5)
    expect(parsed.records.size).toBe(4)
    const [projected] = deriveChatThreads(parsed.records, 4000)
    expect(projected.unreadable).toBe(true)
    expect(chatAvailability(projected, 4000, new Set(['one']), [{ id: thread.agentId }])).toBe('conflict')
  })
  it('filters foreign user preferences and preserves valid records alongside unknown schema data', () => {
    const parsed = readChatData({ value: { theme: 'private preference', ...data(thread, request, result), [`${CHAT_STORAGE_PREFIX}v2.thread.future`]: { version: 2 } } })
    expect(parsed.records.size).toBe(3)
    expect(parsed.count).toBe(4)
    expect(parsed.issue).toBe('unreadable')
    expect(JSON.stringify([...parsed.records.values()])).not.toContain('private preference')
  })

  it('distinguishes an empty history from an invalid storage response', () => {
    expect(readChatData({ value: {} }).issue).toBeNull()
    expect(() => readChatData({})).toThrow('invalid-chat-storage-response')
    expect(() => readChatData({ value: null })).toThrow('invalid-chat-storage-response')
  })

  it('orders by predecessor identity rather than assuming synchronized device clocks', () => {
    const second: ChatRequestRecord = { ...request, id: 'two', parentId: 'one', text: 'Second message', createdAt: 500 }
    const records = readChatData({ value: data(thread, second, request, result) }).records
    const [projected] = deriveChatThreads(records, 4000)
    expect(projected.turns.map((turn) => turn.request.text)).toEqual(['First message', 'Second message'])
    expect(projected.conflict).toBe(false)
  })

  it('keeps both overlapping tails instead of silently choosing a winning snapshot', () => {
    const left: ChatRequestRecord = { ...request, id: 'left', parentId: 'one', text: 'From device A' }
    const right: ChatRequestRecord = { ...request, id: 'right', parentId: 'one', text: 'From device B' }
    const [projected] = deriveChatThreads(readChatData({ value: data(thread, request, result, left, right) }).records, 4000)
    expect(projected.turns.map((turn) => turn.request.text)).toEqual(['First message', 'From device A', 'From device B'])
    expect(projected.conflict).toBe(true)
  })

  it('presents orphaned and cyclic branches deterministically without treating them as a causal resolution', () => {
    const orphanA: ChatRequestRecord = { ...request, id: 'orphan-a', parentId: 'missing', text: 'Orphan A', createdAt: 600 }
    const orphanB: ChatRequestRecord = { ...request, id: 'orphan-b', parentId: 'missing', text: 'Orphan B', createdAt: 500 }
    const cycleA: ChatRequestRecord = { ...request, id: 'cycle-a', parentId: 'cycle-b', text: 'Cycle A', createdAt: 700 }
    const cycleB: ChatRequestRecord = { ...request, id: 'cycle-b', parentId: 'cycle-a', text: 'Cycle B', createdAt: 700 }
    const forward = [thread, request, result, orphanA, cycleB, orphanB, cycleA]
    const reverse = [...forward].reverse()
    const [first] = deriveChatThreads(readChatData({ value: data(...forward) }).records, 4000)
    const [second] = deriveChatThreads(readChatData({ value: data(...reverse) }).records, 4000)
    expect(first.turns.map((turn) => turn.request.id)).toEqual(['one', 'orphan-b', 'orphan-a', 'cycle-a', 'cycle-b'])
    expect(second.turns.map((turn) => turn.request.id)).toEqual(first.turns.map((turn) => turn.request.id))
    expect(first.unreadable).toBe(true)
    expect(first.conflict).toBe(true)
    expect(chatAvailability(first, 4000, new Set(['one']), [{ id: thread.agentId }])).toBe('conflict')
  })

  it('requires deliberate remote continuation and archives expired or reset contexts', () => {
    const [projected] = deriveChatThreads(readChatData({ value: data(thread, request, result) }).records, 4000)
    const agents = [{ id: thread.agentId }]
    expect(chatAvailability(projected, 4000, new Set(), agents)).toBe('confirm')
    expect(chatAvailability(projected, 4000, new Set(['one']), agents)).toBe('current')
    expect(chatAvailability(projected, 3000 + CHAT_CONTEXT_IDLE_MS, new Set(['one']), agents)).toBe('expired')
    projected.tail = { ...result, contextReset: true }
    expect(chatAvailability(projected, 4000, new Set(['one']), agents)).toBe('expired')
  })

  it('makes an abandoned pending request uncertain without inventing an assistant response', () => {
    const [projected] = deriveChatThreads(readChatData({ value: data(thread, request, { version: 1, kind: 'pending', id: request.id, threadId: thread.id, createdAt: 2000 }) }).records, 122001)
    expect(projected.turns[0].state).toBe('unknown')
    expect(projected.turns[0].result).toBeUndefined()
  })
})
