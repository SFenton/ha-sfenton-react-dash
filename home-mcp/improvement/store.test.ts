import { mkdtemp, readFile, readdir, rename, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ConversationImprovementStore } from './store'
import type { ImprovementConversation } from './types'

const lightConversation = (threadId = 'thread-one'): ImprovementConversation => ({
  version: 1,
  threadId,
  userScope: 'user-one',
  createdAt: 1,
  updatedAt: 2,
  turns: [{
    id: 'turn-one',
    createdAt: 2,
    userText: 'Turn on the living room lights.',
    assistantText: 'I turned on the Living Room lights.',
    outcome: 'answer',
    parsedAsLights: true,
    handledByHomeMcp: true,
    contextBefore: null,
    contextAfter: { domain: 'lights', roomId: 'living-room', entityIds: [], lightNames: [], lastAction: 'on' },
  }],
})

describe('ConversationImprovementStore', () => {
  it('queues supported conversations once and exposes queue status', async () => {
    const root = await mkdtemp(join(tmpdir(), 'home-mcp-improvements-'))
    const store = new ConversationImprovementStore({ root, enabled: true, autoPublish: true })

    expect(await store.reviewConversation(lightConversation(), 'user-one')).toMatchObject({ status: 'queued' })
    expect(await store.reviewConversation(lightConversation(), 'user-one')).toMatchObject({ status: 'duplicate' })

    const info = await store.info('Gemini')
    expect(info.queue).toMatchObject({ enabled: true, autoPublish: true, pending: 1, processing: false })
  })

  it('sanitizes a runtime turn before writing it to disk', async () => {
    const root = await mkdtemp(join(tmpdir(), 'home-mcp-improvements-'))
    const store = new ConversationImprovementStore({ root, enabled: true })
    await store.recordTurn({
      userScope: 'stable-user',
      threadId: 'thread-secret',
      turn: {
        id: 'turn-secret',
        createdAt: 2,
        userText: 'Turn on the Living Room lights with password=SecretValue123456789.',
        assistantText: 'Used light.living_room.',
        outcome: 'answer',
        parsedAsLights: true,
        handledByHomeMcp: true,
        contextBefore: null,
        contextAfter: { domain: 'lights', roomId: 'living-room', entityIds: ['light.living_room'], lightNames: [], lastAction: 'on' },
      },
    })
    const [file] = await readdir(join(root, 'conversations'))
    const persisted = await readFile(join(root, 'conversations', file), 'utf8')
    expect(persisted).not.toContain('SecretValue123456789')
    expect(persisted).not.toContain('light.living_room')
    expect(persisted).toContain('[redacted]')
    expect(persisted).toContain('[entity]')
  })

  it('serializes concurrent writes and queueing without losing turns', async () => {
    const root = await mkdtemp(join(tmpdir(), 'home-mcp-improvements-'))
    const store = new ConversationImprovementStore({ root, enabled: true })
    const first = lightConversation().turns[0]
    const second = {
      ...first,
      id: 'turn-two',
      createdAt: 3,
      userText: 'Are the Living Room lights on?',
      assistantText: 'The Living Room lights are on.',
      contextAfter: { ...first.contextAfter!, lastAction: 'state' as const },
    }

    await Promise.all([
      store.recordTurn({ userScope: 'user-one', threadId: 'thread-one', turn: first }),
      store.recordTurn({ userScope: 'user-one', threadId: 'thread-one', turn: second }),
    ])
    const [conversationFile] = await readdir(join(root, 'conversations'))
    const conversation = JSON.parse(await readFile(join(root, 'conversations', conversationFile), 'utf8')) as ImprovementConversation
    expect(conversation.turns.map((turn) => turn.id).sort()).toEqual(['turn-one', 'turn-two'])

    const third = { ...second, id: 'turn-three', createdAt: 4 }
    await Promise.all([
      store.queueConversation('user-one', 'thread-one', 'runtime'),
      store.recordTurn({ userScope: 'user-one', threadId: 'thread-one', turn: third }),
    ])
    const queuedFiles = await readdir(join(root, 'inbox'))
    const queued = await Promise.all(queuedFiles.map(async (file) =>
      JSON.parse(await readFile(join(root, 'inbox', file), 'utf8')) as { conversation?: ImprovementConversation }))
    const remainingFiles = await readdir(join(root, 'conversations'))
    const remaining = await Promise.all(remainingFiles.map(async (file) =>
      JSON.parse(await readFile(join(root, 'conversations', file), 'utf8')) as ImprovementConversation))
    const retainedIds = [...queued.flatMap((job) => job.conversation?.turns.map((turn) => turn.id) ?? []),
      ...remaining.flatMap((item) => item.turns.map((turn) => turn.id))]
    expect(new Set(retainedIds)).toEqual(new Set(['turn-one', 'turn-two', 'turn-three']))
  })

  it('does not idle-queue a thread while a request is active', async () => {
    const root = await mkdtemp(join(tmpdir(), 'home-mcp-improvements-'))
    const store = new ConversationImprovementStore({ root, enabled: true, quietMs: 100 })
    await store.recordTurn({ userScope: 'user-one', threadId: 'thread-one', turn: lightConversation().turns[0] })
    const activity = await store.beginConversationActivity('user-one', 'thread-one')
    const queueing = store.queueIdleConversations(1_000)
    await activity.recordTurn({
      ...lightConversation().turns[0],
      id: 'turn-two',
      createdAt: 1_000,
      userText: 'Are the Living Room lights on?',
      assistantText: 'The Living Room lights are on.',
    })
    activity.release()

    expect(await queueing).toEqual([])
    const [file] = await readdir(join(root, 'conversations'))
    const conversation = JSON.parse(await readFile(join(root, 'conversations', file), 'utf8')) as ImprovementConversation
    expect(conversation.turns.map((turn) => turn.id)).toEqual(['turn-one', 'turn-two'])
  })

  it('keeps unsupported conversations out of the Copilot queue', async () => {
    const root = await mkdtemp(join(tmpdir(), 'home-mcp-improvements-'))
    const store = new ConversationImprovementStore({ root, enabled: true })
    const conversation = lightConversation('weather-thread')
    conversation.turns[0] = {
      ...conversation.turns[0],
      userText: 'What is the weather?',
      assistantText: 'It is sunny.',
      parsedAsLights: false,
      handledByHomeMcp: false,
      contextAfter: null,
    }

    expect(await store.reviewConversation(conversation, 'user-one')).toEqual({ status: 'unsupported' })
    expect((await store.info('Gemini')).queue.pending).toBe(0)
  })

  it('moves one queued job into processing atomically', async () => {
    const root = await mkdtemp(join(tmpdir(), 'home-mcp-improvements-'))
    const store = new ConversationImprovementStore({ root, enabled: true })
    await store.reviewConversation(lightConversation(), 'user-one')

    const claimed = await store.claimNextJob()
    expect(claimed?.job?.conversation?.threadId).toBe('thread-one')
    expect((await store.info('Gemini')).queue).toMatchObject({ pending: 0 })
    expect(JSON.parse(await readFile(claimed!.path, 'utf8')).id).toBe(claimed!.job!.id)
  })

  it('defers a failed job without letting a second worker claim it early', async () => {
    const root = await mkdtemp(join(tmpdir(), 'home-mcp-improvements-'))
    const store = new ConversationImprovementStore({ root, enabled: true })
    await store.reviewConversation(lightConversation(), 'user-one')
    const claimed = await store.claimNextJob(100)
    await store.retryJob(claimed!.path, claimed!.job!, 'temporary failure', 5_000)

    expect(await store.claimNextJob(Date.now())).toBeNull()
    expect((await store.info('Gemini')).queue.pending).toBe(1)
  })

  it('recovers a stale processing claim after a worker crash', async () => {
    const root = await mkdtemp(join(tmpdir(), 'home-mcp-improvements-'))
    const store = new ConversationImprovementStore({ root, enabled: true })
    await store.reviewConversation(lightConversation(), 'user-one')
    const oldClaim = Date.now() - 20 * 60_000
    expect(await store.claimNextJob(oldClaim)).not.toBeNull()

    const restarted = new ConversationImprovementStore({ root, enabled: true })
    await restarted.recoverStaleJobs(Date.now())
    const recovered = await restarted.claimNextJob(Date.now())

    expect(recovered?.job?.conversationHash).toBeTruthy()
    expect(recovered?.job?.attempts).toBe(1)
  })

  it('recovers a processing file when a worker crashes before recording claimedAt', async () => {
    const root = await mkdtemp(join(tmpdir(), 'home-mcp-improvements-'))
    const store = new ConversationImprovementStore({ root, enabled: true })
    await store.reviewConversation(lightConversation(), 'user-one')
    const [file] = await readdir(join(root, 'inbox'))
    await rename(join(root, 'inbox', file), join(root, 'processing', file))

    await store.recoverStaleJobs(Date.now())
    const recovered = await store.claimNextJob(Date.now())

    expect(recovered?.job?.conversationHash).toBeTruthy()
    expect(recovered?.job?.attempts).toBe(1)
  })

  it('moves a repeatedly crashing stale job to terminal failure', async () => {
    const root = await mkdtemp(join(tmpdir(), 'home-mcp-improvements-'))
    const store = new ConversationImprovementStore({ root, enabled: true })
    await store.reviewConversation(lightConversation(), 'user-one')
    const claimed = await store.claimNextJob(Date.now() - 20 * 60_000)
    await store.updateProcessingJob(claimed!.path, { ...claimed!.job!, attempts: 2 })

    await store.recoverStaleJobs(Date.now())

    expect(await readdir(join(root, 'inbox'))).toEqual([])
    expect(await readdir(join(root, 'processing'))).toEqual([])
    expect(await readdir(join(root, 'failed'))).toHaveLength(1)
  })

  it('retains a merged-stage receipt without retaining the transcript on retry', async () => {
    const root = await mkdtemp(join(tmpdir(), 'home-mcp-improvements-'))
    const store = new ConversationImprovementStore({ root, enabled: true })
    await store.reviewConversation(lightConversation(), 'user-one')
    const claimed = await store.claimNextJob()
    const merged = {
      ...claimed!.job!,
      stage: 'merged' as const,
      conversation: undefined,
      analysis: {
        version: 1 as const,
        outcome: 'needs-improvement' as const,
        inferredIntent: 'Handle a light request.',
        issues: ['Missed intent.'],
        summary: ['Understands another light request.'],
        regressions: [],
      },
      releaseVersion: '0.2.1',
      pr: 123,
      mergeCommit: 'abc123',
    }
    await store.updateProcessingJob(claimed!.path, merged)
    const persisted = await store.readProcessingJob(claimed!.path)
    await store.retryJob(claimed!.path, persisted!, 'publish failed', 0)

    const retry = await store.claimNextJob(Date.now() + 1)
    expect(retry?.job).toMatchObject({ stage: 'merged', releaseVersion: '0.2.1', mergeCommit: 'abc123' })
    expect(retry?.job?.conversation).toBeUndefined()
  })

  it('keeps failed jobs deduplicated for a cooldown, then permits a later backfill retry', async () => {
    const root = await mkdtemp(join(tmpdir(), 'home-mcp-improvements-'))
    const store = new ConversationImprovementStore({ root, enabled: true })
    await store.reviewConversation(lightConversation(), 'user-one')
    const claimed = await store.claimNextJob()
    await store.failJob(claimed!.path, { status: 'failed', message: 'temporary' })

    expect(await store.reviewConversation(lightConversation(), 'user-one')).toMatchObject({ status: 'duplicate' })
    const [failedFile] = await readdir(join(root, 'failed'))
    const failedPath = join(root, 'failed', failedFile)
    const failed = JSON.parse(await readFile(failedPath, 'utf8'))
    await writeFile(failedPath, JSON.stringify({ ...failed, retryAfter: new Date(0).toISOString() }))

    expect(await store.reviewConversation(lightConversation(), 'user-one')).toMatchObject({ status: 'queued' })
  })

  it('exposes only a classified worker error through home_info', async () => {
    const root = await mkdtemp(join(tmpdir(), 'home-mcp-improvements-'))
    const store = new ConversationImprovementStore({ root, enabled: true })
    await store.writeWorkerStatus({
      state: 'error',
      jobId: 'job-one',
      updatedAt: new Date().toISOString(),
      message: '/private/path failed with internal diagnostics',
    })

    expect((await store.info('Gemini')).queue.lastError).toBe('improvement-failed')
  })
})
