import { MockChatServer, MOCK_CHAT_AGENT } from '../../../test/mocks/chatServer'
import { CHAT_METADATA_TIMEOUT_MS, ChatClient } from './chatClient'
import { HomeMcpRequestRejected } from './homeMcpClient'
import {
  CHAT_HISTORY_VISIBLE_MS, CHAT_MESSAGE_LIMIT, CHAT_PENDING_MS, CHAT_REPLY_LIMIT, CHAT_STORAGE_PREFIX,
  CHAT_THREAD_LIMIT, chatRecordKey,
  type ChatRecord, type ChatRequestRecord, type ChatResultRecord, type ChatThreadRecord,
} from './chatRecords'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail })
  return { promise, resolve, reject }
}

const answer = (text = 'A real mocked reply', conversationId = 'native-one') => ({
  conversation_id: conversationId,
  response: { response_type: 'query_answer', speech: { plain: { speech: text } } },
})

describe('native chat client', () => {
  let server: MockChatServer
  let clients: ChatClient[]
  beforeEach(() => { server = new MockChatServer(); clients = [] })
  afterEach(() => { clients.forEach((client) => client.dispose()); vi.useRealTimers() })
  const nativeCalls = () => server.calls.filter((call) => call.message.type === 'conversation/process')
  const clientFor = (userId = 'user-a', connection = server.connect(userId), now = Date.now) => {
    const client = new ChatClient(connection, userId, now)
    clients.push(client)
    return client
  }

  it('does no calls, subscriptions or timers before explicit activation', () => {
    const timers = vi.spyOn(globalThis, 'setTimeout')
    const client = clientFor()
    const unsubscribe = client.subscribe(() => undefined)
    expect(client.getSnapshot().status).toBe('idle')
    expect(server.calls).toHaveLength(0)
    expect(server.subscriptions.size).toBe(0)
    expect(timers).not.toHaveBeenCalled()
    unsubscribe()
    timers.mockRestore()
  })

  it('updates history visibility at the fourteen-day boundary without deleting records', async () => {
    vi.useFakeTimers()
    let now = 1_000_000
    const thread: ChatThreadRecord = { version: 1, kind: 'thread', id: 'retained-thread', agentId: MOCK_CHAT_AGENT.id, agentName: MOCK_CHAT_AGENT.name, createdAt: now }
    const request: ChatRequestRecord = { version: 1, kind: 'request', id: 'retained-turn', threadId: thread.id, parentId: null, clientId: 'seed', text: 'Retain this conversation', conversationId: null, createdAt: now }
    const result: ChatResultRecord = { version: 1, kind: 'result', id: request.id, threadId: thread.id, text: 'Retained reply', conversationId: 'native-retained', response: 'answer', contextReset: false, createdAt: now }
    server.seed('user-a', Object.fromEntries([thread, request, result].map((record) => [chatRecordKey(record), record])))
    const client = clientFor('user-a', server.connect('user-a'), () => now)
    await client.activate()
    expect(client.getSnapshot().historyThreads).toHaveLength(1)

    now += CHAT_HISTORY_VISIBLE_MS + 1
    await vi.advanceTimersByTimeAsync(CHAT_HISTORY_VISIBLE_MS + 1)

    expect(client.getSnapshot().historyThreads).toHaveLength(0)
    expect(client.getSnapshot().threads).toHaveLength(1)
    expect(Object.keys(server.data('user-a'))).toHaveLength(3)
  })

  it('removes acknowledged history on external tombstone events without replay or rewriting tombstones', async () => {
    const connection = server.connect('user-a')
    const client = clientFor('user-a', connection)
    await client.activate()
    client.setDraft('A retained question')
    await client.send()
    const keys = Object.keys(server.data('user-a'))
    expect(client.getSnapshot().threads).toHaveLength(1)
    const calls = nativeCalls().length
    for (const key of keys) {
      await connection.sendMessagePromise({ type: 'frontend/set_user_data', key, value: null })
    }
    expect(client.getSnapshot().threads).toHaveLength(0)
    expect(client.getSnapshot().issue).toBeNull()
    await client.retrySave()
    expect(nativeCalls()).toHaveLength(calls)
    expect(Object.values(server.data('user-a')).every((value) => value === null)).toBe(true)
    await client.reload()
    expect(client.getSnapshot().threads).toHaveLength(0)
    expect(client.getSnapshot().issue).toBeNull()
  })

  it('fails closed on archived model-change records without rewriting or dispatching them', async () => {
    const key = `${CHAT_STORAGE_PREFIX}v1.model-change.archived`
    const archived = { version: 1, kind: 'model-change', id: 'archived', createdAt: 1000,
      threadId: 'old-thread', parentId: null, agentId: 'conversation.other', agentName: 'Other', modelName: 'old-model' }
    server.seed('user-a', { [key]: archived })
    const client = clientFor()
    await client.activate()
    expect(client.getSnapshot().issue).toBe('unreadable')
    client.setDraft('Do not route this')
    await client.send()
    await client.retrySave()
    client.newChat()
    await client.send()
    expect(nativeCalls()).toHaveLength(0)
    expect(server.calls.filter((call) => call.message.type === 'frontend/set_user_data')).toHaveLength(0)
    expect(server.data('user-a')[key]).toEqual(archived)
  })

  it('discovers only registry-verified native Gemini agents and never falls back', async () => {
    server.agents = [MOCK_CHAT_AGENT, { id: 'conversation.other', name: 'Other Agent' }]
    server.platforms['conversation.other'] = 'custom_conversation'
    const client = clientFor()
    await client.activate()
    expect(client.getSnapshot().agents).toEqual([MOCK_CHAT_AGENT])
    expect(client.getSnapshot().agentId).toBe(MOCK_CHAT_AGENT.id)
    expect(server.calls.some((call) => String(call.message.type).includes('device_registry') || String(call.message.type).includes('options'))).toBe(false)
    server.agents = [{ id: 'conversation.other', name: 'Other Agent' }]
    await client.reload()
    client.setDraft('A specific question')
    await client.send()
    expect(nativeCalls()).toHaveLength(0)
    expect(client.getSnapshot().agents).toEqual([])
  })

  it('requires selection when more than one native agent is available', async () => {
    const second = { id: 'conversation.second', name: 'Second Gemini' }
    server.agents.push(second)
    server.platforms[second.id] = 'google_generative_ai_conversation'
    const client = clientFor()
    await client.activate()
    expect(client.getSnapshot().agentId).toBe('')
    client.selectAgent(second.id)
    client.setDraft('One focused question')
    await client.send()
    expect(nativeCalls()[0].message.agent_id).toBe(second.id)
  })

  it('supports deliberately clearing the offered assistant choice without falling back', async () => {
    const client = clientFor()
    await client.activate()
    client.selectAgent('')
    client.setDraft('Wait for an explicit assistant choice')
    await client.send()
    expect(client.getSnapshot().agentId).toBe('')
    expect(nativeCalls()).toHaveLength(0)
    client.selectAgent(MOCK_CHAT_AGENT.id)
    await client.send()
    expect(nativeCalls()).toHaveLength(1)
  })

  it('shares history with a fresh device after the first client closes, without sharing another account', async () => {
    server.seed('user-a', { theme: { private: 'Keep this preference out of prompts' } })
    const first = clientFor()
    await first.activate()
    first.setDraft('Keep this conversation on Home Assistant')
    await first.send()
    const threadId = first.getSnapshot().selectedId!
    const conversationId = first.getSnapshot().threads[0].tail?.conversationId
    first.dispose()
    expect(first.getSnapshot().threads).toEqual([])
    const second = clientFor()
    await second.activate()
    expect(second.getSnapshot().threads[0].title).toBe('Keep this conversation on Home Assistant')
    second.selectThread(threadId)
    expect(second.getSnapshot().availability).toBe('confirm')
    expect(nativeCalls()).toHaveLength(1)
    second.setDraft('Another specific question')
    await second.send()
    expect(nativeCalls()).toHaveLength(1)
    second.allowResume()
    await second.send()
    expect(nativeCalls()).toHaveLength(2)
    expect(nativeCalls()[1].message.conversation_id).toBe(conversationId)
    const otherUser = clientFor('user-b')
    await otherUser.activate()
    expect(otherUser.getSnapshot().threads).toEqual([])
    expect(JSON.stringify(nativeCalls())).not.toContain('private')
    expect(server.data('user-a').theme).toEqual({ private: 'Keep this preference out of prompts' })
  })

  it('preserves independent simultaneous writes without a shared mutable archive', async () => {
    const first = clientFor()
    const second = clientFor()
    await Promise.all([first.activate(), second.activate()])
    first.setDraft('First device question')
    second.setDraft('Second device question')
    await Promise.all([first.send(), second.send()])
    const third = clientFor()
    await third.activate()
    expect(third.getSnapshot().threads.map((thread) => thread.title).sort()).toEqual(['First device question', 'Second device question'])
    const writes = server.calls.filter((call) => call.message.type === 'frontend/set_user_data')
    expect(new Set(writes.map((call) => call.message.key)).size).toBe(8)
    expect(writes.every((call) => String(call.message.key).startsWith(CHAT_STORAGE_PREFIX))).toBe(true)
  })

  it('keeps pending work attached to its original thread when another draft is selected', async () => {
    const reply = deferred<unknown>()
    server.process = () => reply.promise
    const client = clientFor()
    await client.activate()
    client.setDraft('First question')
    const sending = client.send()
    await vi.waitFor(() => expect(nativeCalls()).toHaveLength(1))
    const originalId = client.getSnapshot().selectedId
    client.newChat()
    client.setDraft('Next draft')
    await client.send()
    expect(nativeCalls()).toHaveLength(1)
    reply.resolve(answer())
    await sending
    expect(client.getSnapshot().selectedId).toBeNull()
    expect(client.getSnapshot().draft).toBe('Next draft')
    expect(client.getSnapshot().threads.find((thread) => thread.record.id === originalId)?.tail?.text).toBe('A real mocked reply')
  })

  it('blocks duplicate submissions synchronously and keeps a failed result for storage-only retry', async () => {
    let fail = true
    server.beforeWrite = async ({ message }) => {
      if ((message.value as ChatRecord).kind === 'result' && fail) throw new Error('Write failed')
    }
    const client = clientFor()
    await client.activate()
    client.setDraft('Only once')
    await Promise.all([client.send(), client.send()])
    expect(nativeCalls()).toHaveLength(1)
    expect(client.getSnapshot().issue).toBe('save')
    expect(client.getSnapshot().unsavedKeys.size).toBe(1)
    const failedWrite = server.calls.filter((call) => call.message.type === 'frontend/set_user_data').at(-1)!.message
    fail = false
    await client.retrySave()
    expect(nativeCalls()).toHaveLength(1)
    expect(server.calls.filter((call) => call.message.type === 'frontend/set_user_data').at(-1)!.message).toEqual(failedWrite)
    expect(client.getSnapshot().unsavedKeys.size).toBe(0)
  })

  it('does not send after a request save failure, including when saving is retried', async () => {
    let fail = true
    server.beforeWrite = async ({ message }) => {
      if ((message.value as ChatRecord).kind === 'request' && fail) throw new Error('Write failed')
    }
    const client = clientFor()
    await client.activate()
    client.setDraft('Do not send without a stored request')
    await client.send()
    expect(nativeCalls()).toHaveLength(0)
    expect(client.getSnapshot().threads[0].turns[0].state).toBe('not-sent')
    fail = false
    await client.retrySave()
    expect(nativeCalls()).toHaveLength(0)
    expect(client.getSnapshot().unsavedKeys.size).toBe(0)
  })

  it('discards stale account completions and unsubscribes without writing into a new account', async () => {
    const reply = deferred<unknown>()
    server.process = () => reply.promise
    const first = clientFor()
    await first.activate()
    first.setDraft('Private first account question')
    const sending = first.send()
    await vi.waitFor(() => expect(nativeCalls()).toHaveLength(1))
    first.dispose()
    const second = clientFor('user-b')
    await second.activate()
    reply.resolve(answer('Private first account reply'))
    await sending
    expect(second.getSnapshot().threads).toEqual([])
    expect(JSON.stringify(server.data('user-b'))).not.toContain('Private')
    expect(server.subscriptions.get('user-a')?.size).toBe(0)
    expect(Object.values(server.data('user-a')).some((record) => (record as ChatRecord).kind === 'result')).toBe(false)
  })

  it('marks a definite Home MCP proxy rejection not sent instead of unknown', async () => {
    const homeMcp = { request: async () => { throw new HomeMcpRequestRejected('origin-not-allowed') } }
    const client = new ChatClient(server.connect('user-a'), 'user-a', Date.now, undefined, homeMcp)
    clients.push(client)
    await client.activate()
    client.setDraft('Are the Living Room lights on?')

    await client.send()

    expect(client.getSnapshot().threads[0].turns[0].state).toBe('not-sent')
    expect(Object.values(server.data('user-a')).some((record) => (record as ChatRecord).kind === 'unknown')).toBe(false)
  })

  it('does not retry uncertain native outcomes after a disconnect', async () => {
    server.process = () => new Promise(() => undefined)
    const connection = server.connect('user-a')
    const client = clientFor('user-a', connection)
    await client.activate()
    client.setDraft('One request with an uncertain outcome')
    const sending = client.send()
    await vi.waitFor(() => expect(nativeCalls()).toHaveLength(1))
    connection.disconnect()
    await sending
    expect(client.getSnapshot().threads[0].turns[0].state).toBe('unknown')
    connection.reconnect()
    await vi.waitFor(() => expect(client.getSnapshot().status).toBe('ready'))
    await client.retrySave()
    expect(nativeCalls()).toHaveLength(1)
  })

  it('releases a never-settling request for read and save recovery without resending it', async () => {
    vi.useFakeTimers()
    server.process = () => new Promise(() => undefined)
    let failUnknownSave = true
    server.beforeWrite = async ({ message }) => {
      if ((message.value as ChatRecord).kind === 'unknown' && failUnknownSave) throw new Error('Save failed')
    }
    const client = clientFor()
    await client.activate()
    client.setDraft('A request whose handler never returns')
    void client.send()
    await vi.advanceTimersByTimeAsync(1)
    expect(nativeCalls()).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(CHAT_PENDING_MS)
    expect(client.getSnapshot()).toMatchObject({ busy: false, waitingId: null, availability: 'unknown', issue: 'save' })
    await client.reload()
    expect(client.getSnapshot().status).toBe('ready')
    expect(client.getSnapshot().unsavedKeys.size).toBe(1)
    failUnknownSave = false
    await client.retrySave()
    expect(client.getSnapshot().unsavedKeys.size).toBe(0)
    client.setDraft('Do not continue this uncertain thread')
    await client.send()
    expect(nativeCalls()).toHaveLength(1)
    expect(client.getSnapshot().availability).toBe('unknown')
  })

  it('keeps a newer explicit operation and its deadline owned when an older reply arrives late', async () => {
    vi.useFakeTimers()
    const firstReply = deferred<unknown>()
    const secondReply = deferred<unknown>()
    server.process = () => nativeCalls().length === 1 ? firstReply.promise : secondReply.promise
    const client = clientFor()
    await client.activate()
    client.setDraft('First request')
    const firstSending = client.send()
    await vi.advanceTimersByTimeAsync(1)
    const firstId = client.getSnapshot().selectedId
    await vi.advanceTimersByTimeAsync(CHAT_PENDING_MS)
    expect(client.getSnapshot().busy).toBe(false)
    expect(nativeCalls()).toHaveLength(1)
    client.newChat()
    client.setDraft('A deliberately new request')
    const secondSending = client.send()
    await vi.advanceTimersByTimeAsync(1)
    const secondId = client.getSnapshot().selectedId
    const waitingId = client.getSnapshot().waitingId
    expect(nativeCalls()).toHaveLength(2)
    firstReply.resolve(answer('The late first response', 'first-context'))
    await firstSending
    expect(client.getSnapshot()).toMatchObject({ busy: true, waitingId, selectedId: secondId })
    expect(client.getSnapshot().threads.find((thread) => thread.record.id === firstId)?.tail?.text).toBe('The late first response')
    await vi.advanceTimersByTimeAsync(CHAT_PENDING_MS)
    expect(client.getSnapshot()).toMatchObject({ busy: false, waitingId: null, availability: 'unknown', selectedId: secondId })
    secondReply.resolve(answer('The second response', 'second-context'))
    await secondSending
    expect(client.getSnapshot().threads.find((thread) => thread.record.id === secondId)?.tail?.text).toBe('The second response')
    expect(nativeCalls()).toHaveLength(2)
  })

  it('does not release a storage-retry operation when a timed-out reply finishes', async () => {
    vi.useFakeTimers()
    const reply = deferred<unknown>()
    const write = deferred<void>()
    server.process = () => reply.promise
    let saveMode: 'fail' | 'wait' = 'fail'
    server.beforeWrite = async ({ message }) => {
      if ((message.value as ChatRecord).kind !== 'unknown') return
      if (saveMode === 'fail') throw new Error('Save failed')
      await write.promise
    }
    const client = clientFor()
    await client.activate()
    client.setDraft('One timed-out request')
    const sending = client.send()
    await vi.advanceTimersByTimeAsync(CHAT_PENDING_MS + 1)
    saveMode = 'wait'
    const saving = client.retrySave()
    await vi.advanceTimersByTimeAsync(1)
    expect(client.getSnapshot().busy).toBe(true)
    reply.resolve(answer('An actual late reply'))
    await sending
    expect(client.getSnapshot().busy).toBe(true)
    write.resolve()
    await saving
    expect(client.getSnapshot().busy).toBe(false)
    expect(nativeCalls()).toHaveLength(1)
  })

  it('reuses the same immutable unknown status when a timed-out provider later rejects', async () => {
    vi.useFakeTimers()
    const reply = deferred<unknown>()
    server.process = () => reply.promise
    const client = clientFor()
    await client.activate()
    client.setDraft('An uncertain result')
    const sending = client.send()
    await vi.advanceTimersByTimeAsync(CHAT_PENDING_MS + 1)
    const before = Object.values(server.data('user-a')).find((record) => (record as ChatRecord).kind === 'unknown')
    reply.reject(new Error('Late provider failure'))
    await sending
    const after = Object.values(server.data('user-a')).find((record) => (record as ChatRecord).kind === 'unknown')
    expect(after).toEqual(before)
    expect(client.getSnapshot()).toMatchObject({ busy: false, issue: null, availability: 'unknown' })
    expect(nativeCalls()).toHaveLength(1)
  })

  it.each(['reload', 'reconnect'] as const)('reconciles repaired unreadable and over-limit server stores on %s', async (recovery) => {
    for (const issue of ['unreadable', 'limit'] as const) {
      const userId = `repair-${issue}`
      const connection = server.connect(userId)
      const invalid = issue === 'unreadable'
        ? { [`${CHAT_STORAGE_PREFIX}future`]: { version: 9 } }
        : Object.fromEntries(Array.from({ length: CHAT_THREAD_LIMIT + 1 }, (_, index) => {
          const record: ChatThreadRecord = {
            version: 1, kind: 'thread', id: `reserved-${index}`, agentId: MOCK_CHAT_AGENT.id,
            agentName: MOCK_CHAT_AGENT.name, createdAt: Date.now(),
          }
          return [chatRecordKey(record), record]
        }))
      server.seed(userId, { theme: 'untouched', ...invalid })
      const client = clientFor(userId, connection)
      await client.activate()
      expect(client.getSnapshot().issue).toBe(issue)
      server.users.set(userId, { theme: 'untouched' })
      server.notify(userId)
      expect(client.getSnapshot().issue).toBe(issue)
      if (recovery === 'reload') await client.reload()
      else {
        connection.disconnect()
        connection.reconnect()
        await vi.waitFor(() => expect(client.getSnapshot().status).toBe('ready'))
      }
      expect(client.getSnapshot().issue).toBeNull()
      expect(client.getSnapshot().threads).toEqual([])
      client.newChat()
      client.setDraft('A new request after server repair')
      await client.send()
      expect(client.getSnapshot().threads[0].tail?.text).toBe('What would you like to explore next?')
      expect(server.data(userId).theme).toBe('untouched')
    }
  })

  it('retains genuinely invalid unsaved records while loading an otherwise repaired store', async () => {
    let id = 0
    const client = new ChatClient(server.connect('user-a'), 'user-a', Date.now, () => ++id === 2 ? 'invalid identifier' : `id-${id}`)
    clients.push(client)
    await client.activate()
    client.setDraft('Do not write a malformed reservation')
    await client.send()
    expect(client.getSnapshot()).toMatchObject({ issue: 'unreadable', busy: false })
    expect(client.getSnapshot().unsavedKeys.size).toBe(1)
    await client.reload()
    expect(client.getSnapshot().issue).toBe('unreadable')
    expect(client.getSnapshot().unsavedKeys.size).toBe(1)
    expect(server.calls.filter((call) => call.message.type === 'frontend/set_user_data')).toHaveLength(0)
    expect(nativeCalls()).toHaveLength(0)
  })

  it('keeps unknown-version records and blocks new writes rather than dropping history', async () => {
    server.seed('user-a', { [`${CHAT_STORAGE_PREFIX}v9.future`]: { version: 9, important: 'Keep me' } })
    const client = clientFor()
    await client.activate()
    client.setDraft('Do not overwrite old data')
    await client.send()
    expect(client.getSnapshot().issue).toBe('unreadable')
    expect(server.data('user-a')[`${CHAT_STORAGE_PREFIX}v9.future`]).toEqual({ version: 9, important: 'Keep me' })
    expect(nativeCalls()).toHaveLength(0)
  })

  it('enforces the input bound without silently truncating a message', async () => {
    const client = clientFor()
    await client.activate()
    const draft = 'x'.repeat(CHAT_MESSAGE_LIMIT + 1)
    client.setDraft(draft)
    await client.send()
    expect(client.getSnapshot().issue).toBe('message-limit')
    expect(client.getSnapshot().draft).toBe(draft)
    expect(nativeCalls()).toHaveLength(0)
  })

  it('shows a changed native ID as a context boundary and never replays earlier turns', async () => {
    const client = clientFor()
    await client.activate()
    client.setDraft('First question')
    await client.send()
    server.process = async () => answer('Reply without old context', 'unexpected-new-context')
    client.setDraft('Second question')
    await client.send()
    expect(nativeCalls().map((call) => call.message.text)).toEqual(['First question', 'Second question'])
    expect(client.getSnapshot().threads[0].tail?.contextReset).toBe(true)
    expect(client.getSnapshot().availability).toBe('expired')
  })

  it('detects overlapping same-thread tails and retains both without asserting a distributed lock', async () => {
    const first = clientFor()
    const second = clientFor()
    await Promise.all([first.activate(), second.activate()])
    first.setDraft('Shared opening question')
    await first.send()
    second.selectThread(first.getSnapshot().selectedId!)
    second.allowResume()
    const gate = deferred<void>()
    let arrivals = 0
    server.beforeRead = async () => {
      arrivals += 1
      if (arrivals <= 2) {
        if (arrivals === 2) gate.resolve()
        await gate.promise
      }
    }
    first.setDraft('Device A follow-up')
    second.setDraft('Device B follow-up')
    await Promise.all([first.send(), second.send()])
    const third = clientFor()
    await third.activate()
    const thread = third.getSnapshot().threads[0]
    expect(thread.conflict).toBe(true)
    expect(thread.turns.map((turn) => turn.request.text)).toEqual(expect.arrayContaining(['Device A follow-up', 'Device B follow-up']))
    third.selectThread(thread.record.id)
    third.setDraft('Do not continue a fork')
    const count = nativeCalls().length
    await third.send()
    expect(nativeCalls()).toHaveLength(count)
  })

  it('does not overwrite an immutable record changed outside the client', async () => {
    const client = clientFor()
    await client.activate()
    client.setDraft('Original')
    await client.send()
    const request = client.getSnapshot().threads[0].turns[0].request
    server.seed('user-a', { [chatRecordKey(request)]: { ...request, text: 'Changed elsewhere' } })
    expect(client.getSnapshot().issue).toBe('unreadable')
    client.setDraft('No further writes')
    await client.send()
    expect(nativeCalls()).toHaveLength(1)
    expect((server.data('user-a')[chatRecordKey(request)] as { text: string }).text).toBe('Changed elsewhere')
  })

  it('bounds stalled metadata requests without sending or losing the unsent draft', async () => {
    const client = clientFor()
    await client.activate()
    vi.useFakeTimers()
    server.beforeRead = () => new Promise(() => undefined)
    client.setDraft('Keep this unsent draft')
    const sending = client.send()
    await vi.advanceTimersByTimeAsync(CHAT_METADATA_TIMEOUT_MS + 1)
    await sending
    expect(client.getSnapshot().busy).toBe(false)
    expect(client.getSnapshot().issue).toBe('load')
    expect(client.getSnapshot().draft).toBe('Keep this unsent draft')
    expect(nativeCalls()).toHaveLength(0)
  })

  it('cancels metadata deadlines when the owning account scope is disposed', async () => {
    vi.useFakeTimers()
    server.beforeRead = () => new Promise(() => undefined)
    const client = clientFor()
    const activation = client.activate()
    await vi.advanceTimersByTimeAsync(1)
    client.dispose()
    await activation
    expect(vi.getTimerCount()).toBe(0)
    expect(client.getSnapshot().threads).toEqual([])
  })

  it('unsubscribes a subscription that completes after its owner is gone', async () => {
    const gate = deferred<void>()
    let subscribing = false
    server.beforeSubscribe = async () => { subscribing = true; await gate.promise }
    const client = clientFor()
    const activation = client.activate()
    await vi.waitFor(() => expect(subscribing).toBe(true))
    client.dispose()
    gate.resolve()
    await activation
    expect(server.subscriptions.get('user-a')?.size).toBe(0)
    expect(nativeCalls()).toHaveLength(0)
  })

  it('persists structured controls, carries semantic context, and lets each control submit only once', async () => {
    const requests: Array<{ text: string; context: unknown }> = []
    const homeMcp = {
      request: async (text: string, conversationId: string | null, context: unknown) => {
        requests.push({ text, context })
        if (requests.length === 1) return {
          status: 'clarify', text: 'Which room?', conversation_id: conversationId ?? 'home-mcp-lights:pending',
          handled_by_home_mcp: true,
          controls: [{ id: 'lights-room-picker', kind: 'room-picker', options: [{ label: 'Living Room', value: 'Living Room', message: 'Turn on the Living Room lights.' }] }],
          context: { domain: 'lights', roomId: null, entityIds: [], lightNames: [] },
        }
        return {
          status: 'success', text: 'I turned on the Living Room lights.', conversation_id: 'home-mcp-thread', controls: [],
          handled_by_home_mcp: true,
          context: { domain: 'lights', roomId: 'living-room', entityIds: [], lightNames: [] },
        }
      },
    }
    const client = new ChatClient(server.connect('user-a'), 'user-a', Date.now, undefined, homeMcp)
    clients.push(client)
    await client.activate()
    client.setDraft('Turn on the lights')
    await client.send()
    const control = client.getSnapshot().threads[0].tail?.controls?.[0]
    expect(control).toMatchObject({ kind: 'room-picker' })
    expect(control?.id).toMatch(/^control-[a-zA-Z0-9_-]+-0$/)

    client.setDraft('Keep this composer draft')
    await client.sendControl(control!.id, 'Use the Living Room.')
    await client.sendControl(control!.id, 'Use the Kitchen.')

    expect(requests).toHaveLength(2)
    expect(requests[1].context).toMatchObject({ domain: 'lights', roomId: null })
    expect(client.controlUsed(control!.id)).toBe(true)
    expect(client.getSnapshot().threads[0].turns[1].request).toMatchObject({
      text: 'Use the Living Room.', sourceControlId: control!.id,
    })
    expect(client.getSnapshot().threads[0].tail?.skillContext).toMatchObject({ roomId: 'living-room' })
    expect(client.getSnapshot().threads[0].tail?.handledByHomeMcp).toBe(true)
    expect(client.getSnapshot().threads[0].tail?.homeMcpStatus).toBe('success')
    expect(client.getSnapshot().draft).toBe('Keep this composer draft')
  })

  it('queues a complete light conversation when starting a new chat', async () => {
    const ended = vi.fn(async () => ({ status: 'queued' }))
    const homeMcp = {
      endConversation: ended,
      request: async () => ({
        status: 'answer',
        text: 'The Living Room lights are off.',
        conversation_id: 'home-mcp-thread',
        controls: [],
        context: { domain: 'lights', roomId: 'living-room', entityIds: [], lightNames: [], lastAction: 'state', lastState: 'off' },
      }),
    }
    const client = new ChatClient(server.connect('user-a'), 'user-a', Date.now, undefined, homeMcp)
    clients.push(client)
    await client.activate()
    client.setDraft('Are the Living Room lights on?')
    await client.send()

    client.newChat()

    await vi.waitFor(() => expect(ended).toHaveBeenCalledOnce())
    expect(ended).toHaveBeenCalledWith(expect.stringMatching(/^[a-zA-Z0-9_-]+$/))
    expect(client.getSnapshot().selectedId).toBeNull()
  })

  it('persists failed Home MCP status for improvement deduplication', async () => {
    const homeMcp = {
      request: async () => ({
        status: 'failed',
        text: 'The light change failed.',
        conversation_id: 'home-mcp-thread',
        controls: [],
        context: { domain: 'lights', roomId: 'living-room', entityIds: [], lightNames: [], lastAction: 'off' },
        handled_by_home_mcp: true,
      }),
    }
    const client = new ChatClient(server.connect('user-a'), 'user-a', Date.now, undefined, homeMcp)
    clients.push(client)
    await client.activate()
    client.setDraft('Turn off the Living Room lights.')
    await client.send()

    expect(client.getSnapshot().threads[0].tail).toMatchObject({
      response: 'answer',
      handledByHomeMcp: true,
      homeMcpStatus: 'failed',
    })
  })

  it('keeps a failed Home MCP command conversationally resumable', async () => {
    const requests: string[] = []
    const homeMcp = {
      request: async (text: string, conversationId: string | null) => {
        requests.push(text)
        return requests.length === 1
          ? { status: 'failed', text: 'I was unable to turn on the Living Room lights. Would you like me to try again?', conversation_id: conversationId ?? 'home-mcp-lights:living-room', controls: [], context: { domain: 'lights', roomId: 'living-room', entityIds: [], lightNames: [], lastAction: 'on' } }
          : { status: 'answer', text: 'The Living Room lights are on.', conversation_id: conversationId, controls: [], context: { domain: 'lights', roomId: 'living-room', entityIds: [], lightNames: [], lastAction: 'state', lastState: 'on' } }
      },
    }
    const client = new ChatClient(server.connect('user-a'), 'user-a', Date.now, undefined, homeMcp)
    clients.push(client)
    await client.activate()
    client.setDraft('Turn on the Living Room lights')
    await client.send()
    expect(client.getSnapshot().threads[0].tail?.response).toBe('answer')
    expect(client.getSnapshot().availability).toBe('current')

    client.setDraft('Are they on?')
    await client.send()
    expect(requests).toEqual(['Turn on the Living Room lights', 'Are they on?'])
    expect(client.getSnapshot().threads[0].tail?.text).toBe('The Living Room lights are on.')
  })

  it('locks legacy repeated control ids only for the reply that submitted them', async () => {
    const thread: ChatThreadRecord = { version: 1, kind: 'thread', id: 'thread-legacy', agentId: MOCK_CHAT_AGENT.id, agentName: MOCK_CHAT_AGENT.name, createdAt: 1 }
    const requestOne: ChatRequestRecord = { version: 1, kind: 'request', id: 'request-one', threadId: thread.id, createdAt: 2, parentId: null, clientId: 'legacy', text: 'Turn on the lights', conversationId: null }
    const resultOne: ChatResultRecord = { version: 1, kind: 'result', id: requestOne.id, threadId: thread.id, createdAt: 3, text: 'Which room?', conversationId: 'legacy', response: 'answer', contextReset: false, controls: [] }
    const requestTwo: ChatRequestRecord = { version: 1, kind: 'request', id: 'request-two', threadId: thread.id, createdAt: 4, parentId: resultOne.id, clientId: 'legacy', text: 'Living Room', conversationId: 'legacy', sourceControlId: 'lights-room-picker-state' }
    const resultTwo: ChatResultRecord = { version: 1, kind: 'result', id: requestTwo.id, threadId: thread.id, createdAt: 5, text: 'Which room?', conversationId: 'legacy', response: 'answer', contextReset: false, controls: [] }
    server.seed('user-a', Object.fromEntries([thread, requestOne, resultOne, requestTwo, resultTwo].map((record) => [chatRecordKey(record), record])))
    const client = clientFor()
    await client.activate()

    expect(client.controlUsed('lights-room-picker-state', resultOne.id)).toBe(true)
    expect(client.controlUsed('lights-room-picker-state', resultTwo.id)).toBe(false)
  })

  it('instances repeated server control ids per reply and chat', async () => {
    const requests: string[] = []
    const homeMcp = {
      request: async (text: string, conversationId: string | null) => {
        requests.push(text)
        return {
          status: 'clarify', text: 'Which room?', conversation_id: conversationId ?? `conversation-${requests.length}`,
          controls: [{ id: 'lights-room-picker-state', kind: 'room-picker', options: [{ label: 'Living Room', value: 'Living Room', message: 'Turn on the Living Room lights.' }] }],
          context: { domain: 'lights', roomId: null, entityIds: [], lightNames: [] },
        }
      },
    }
    const client = new ChatClient(server.connect('user-a'), 'user-a', Date.now, undefined, homeMcp)
    clients.push(client)
    await client.activate()

    client.setDraft('Turn on the lights')
    await client.send()
    const firstThreadId = client.getSnapshot().selectedId!
    const firstControlId = client.getSnapshot().threads[0].tail!.controls![0].id
    await client.sendControl(firstControlId, 'Turn on the Living Room lights.')
    const repeatedControlId = client.getSnapshot().threads[0].tail!.controls![0].id

    expect(repeatedControlId).not.toBe(firstControlId)
    expect(client.controlUsed(firstControlId)).toBe(true)
    expect(client.controlUsed(repeatedControlId)).toBe(false)
    await client.sendControl(repeatedControlId, 'Turn on the Living Room lights.')
    await client.sendControl(firstControlId, 'Turn on the Kitchen lights.', client.getSnapshot().threads[0].turns[0].result!.id)
    expect(requests).toHaveLength(3)

    client.newChat()
    client.setDraft('Turn on the lights')
    await client.send()
    const newChatControlId = client.getSnapshot().threads.find((thread) => thread.record.id === client.getSnapshot().selectedId)!.tail!.controls![0].id
    expect(newChatControlId).not.toBe(firstControlId)
    expect(client.controlUsed(newChatControlId)).toBe(false)
    await client.sendControl(newChatControlId, 'Turn on the Living Room lights.')

    client.selectThread(firstThreadId)
    expect(client.controlUsed(firstControlId)).toBe(true)
    expect(client.controlUsed(repeatedControlId)).toBe(true)
    expect(requests).toHaveLength(5)
  })

  it('retains an oversized reply visibly unconfirmed rather than truncating or resending it', async () => {
    const longReply = 'x'.repeat(CHAT_REPLY_LIMIT + 1)
    server.process = async () => answer(longReply)
    const client = clientFor()
    await client.activate()
    client.setDraft('A small request')
    await client.send()
    expect(client.getSnapshot().threads[0].tail?.text).toBe(longReply)
    expect(client.getSnapshot().issue).toBe('limit')
    await vi.waitFor(() => expect(client.getSnapshot().unsavedKeys.size).toBe(1))
    await client.reload()
    expect(client.getSnapshot().threads[0].tail?.text).toBe(longReply)
    expect(client.getSnapshot().issue).toBe('limit')
    expect(client.getSnapshot().unsavedKeys.size).toBe(1)
    await client.retrySave()
    expect(nativeCalls()).toHaveLength(1)
    expect(server.calls.filter((call) => call.message.type === 'frontend/set_user_data')
      .some((call) => (call.message.value as ChatRecord).kind === 'result')).toBe(false)
  })
})
