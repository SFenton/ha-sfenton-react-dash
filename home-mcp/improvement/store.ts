import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import metadataJson from '../metadata.json' with { type: 'json' }
import { conversationHash, conversationIsSupportedLights, normalizeImprovementConversation } from './scope'
import {
  IMPROVEMENT_SCHEMA_VERSION,
  type HomeMcpInfo,
  type HomeMcpMetadata,
  type ImprovementConversation,
  type ImprovementConversationTurn,
  type ImprovementJob,
  type ImprovementWorkerStatus,
} from './types'

const metadata = metadataJson as HomeMcpMetadata
const STALE_CLAIM_MS = 15 * 60_000
const TERMINAL_RETENTION_MS = 365 * 24 * 60 * 60_000
const FAILED_RETRY_MS = 7 * 24 * 60 * 60_000
const MAX_TERMINAL_FILES = 2_000
const DEFAULT_WORKER_STATUS: ImprovementWorkerStatus = {
  state: 'idle',
  jobId: null,
  updatedAt: new Date(0).toISOString(),
  message: null,
}

async function readJson<T>(path: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as T
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

async function atomicWrite(path: string, value: unknown) {
  const temporary = `${path}.${process.pid}.${Date.now()}.tmp`
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
  await rename(temporary, path)
}

async function jsonFiles(path: string) {
  try {
    return (await readdir(path)).filter((file) => file.endsWith('.json')).sort()
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
}

function safeId(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 100)
}

export class ConversationImprovementStore {
  readonly root: string
  readonly enabled: boolean
  readonly autoPublish: boolean
  readonly quietMs: number
  private readonly conversationLocks = new Map<string, Promise<void>>()

  constructor(options: { root?: string; enabled?: boolean; autoPublish?: boolean; quietMs?: number }) {
    this.root = resolve(options.root ?? '.home-mcp-improvements')
    this.enabled = options.enabled === true
    this.autoPublish = options.autoPublish === true
    this.quietMs = options.quietMs ?? 5 * 60_000
  }

  private directory(name: 'conversations' | 'inbox' | 'processing' | 'results' | 'failed') {
    return join(this.root, name)
  }

  private async prepare() {
    if (!this.enabled) return
    await Promise.all(['conversations', 'inbox', 'processing', 'results', 'failed']
      .map((name) => mkdir(this.directory(name as 'inbox'), { recursive: true })))
  }

  async recoverStaleJobs(now = Date.now()) {
    await this.prepare()
    for (const file of await jsonFiles(this.directory('processing'))) {
      const path = join(this.directory('processing'), file)
      const job = await readJson<ImprovementJob>(path)
      if (!job || (job.claimedAt !== undefined && now - job.claimedAt < STALE_CLAIM_MS)) continue
      if (job.attempts >= 2) {
        await this.failJob(path, {
          status: 'failed',
          stage: job.stage,
          message: 'The improvement worker stopped before completing this stage.',
          processedAt: new Date(now).toISOString(),
        })
        continue
      }
      await atomicWrite(join(this.directory('inbox'), file), {
        ...job,
        attempts: job.attempts + 1,
        claimedAt: undefined,
        notBefore: undefined,
      })
      await rm(path, { force: true })
    }
  }

  private conversationPath(userScope: string, threadId: string) {
    return join(this.directory('conversations'), `${safeId(userScope)}-${safeId(threadId)}.json`)
  }

  private async acquireConversationLock(path: string) {
    const previous = this.conversationLocks.get(path) ?? Promise.resolve()
    let release = () => {}
    const pending = new Promise<void>((resolvePending) => { release = resolvePending })
    const tail = previous.catch(() => undefined).then(() => pending)
    this.conversationLocks.set(path, tail)
    await previous.catch(() => undefined)
    let released = false
    return () => {
      if (released) return
      released = true
      release()
      if (this.conversationLocks.get(path) === tail) this.conversationLocks.delete(path)
    }
  }

  private async withConversationLock<T>(path: string, task: () => Promise<T>): Promise<T> {
    const release = await this.acquireConversationLock(path)
    try {
      return await task()
    } finally {
      release()
    }
  }

  private async recordTurnAtPath(path: string, input: {
    userScope: string
    threadId: string
    turn: ImprovementConversationTurn
  }) {
    const existing = await readJson<ImprovementConversation>(path)
    const normalized = normalizeImprovementConversation(existing, input.userScope)
    const turns = normalized?.turns ?? []
    const candidate = normalizeImprovementConversation({
      version: IMPROVEMENT_SCHEMA_VERSION,
      threadId: input.threadId,
      userScope: input.userScope,
      createdAt: input.turn.createdAt,
      updatedAt: input.turn.createdAt,
      turns: [input.turn],
    }, input.userScope)
    const sanitizedTurn = candidate?.turns[0]
    if (!sanitizedTurn) throw new Error('Invalid improvement conversation turn')
    const duplicate = turns.find((turn) => turn.id === sanitizedTurn.id)
    if (duplicate) return
    const conversation = normalizeImprovementConversation({
      version: IMPROVEMENT_SCHEMA_VERSION,
      threadId: input.threadId,
      userScope: input.userScope,
      createdAt: normalized?.createdAt ?? sanitizedTurn.createdAt,
      updatedAt: sanitizedTurn.createdAt,
      turns: [...turns, sanitizedTurn],
    }, input.userScope)
    if (!conversation) throw new Error('Invalid improvement conversation')
    await atomicWrite(path, conversation)
  }

  async beginConversationActivity(userScope: string, threadId: string) {
    if (!this.enabled) return {
      recordTurn: async () => {},
      release: () => {},
    }
    await this.prepare()
    const path = this.conversationPath(userScope, threadId)
    const release = await this.acquireConversationLock(path)
    return {
      recordTurn: (turn: ImprovementConversationTurn) => this.recordTurnAtPath(path, { userScope, threadId, turn }),
      release,
    }
  }

  async recordTurn(input: {
    userScope: string
    threadId: string
    turn: ImprovementConversationTurn
  }) {
    if (!this.enabled) return
    await this.prepare()
    const path = this.conversationPath(input.userScope, input.threadId)
    await this.withConversationLock(path, () => this.recordTurnAtPath(path, input))
  }

  async queueConversation(userScope: string, threadId: string, source: ImprovementJob['source']) {
    if (!this.enabled) return { status: 'disabled' as const }
    await this.prepare()
    const path = this.conversationPath(userScope, threadId)
    return this.withConversationLock(path, () => this.queueConversationAtPath(path, userScope, source))
  }

  private async queueConversationAtPath(path: string, userScope: string, source: ImprovementJob['source'], idleBefore?: number) {
    const raw = await readJson<ImprovementConversation>(path)
    const conversation = normalizeImprovementConversation(raw, userScope)
    if (!conversation) return { status: 'missing' as const }
    if (idleBefore !== undefined && conversation.updatedAt > idleBefore) return { status: 'active' as const }
    if (!conversationIsSupportedLights(conversation)) {
      await this.writeResult(conversationHash(conversation), {
        status: 'unsupported',
        processedAt: new Date().toISOString(),
      })
      await rm(path, { force: true })
      return { status: 'unsupported' as const }
    }
    const hash = conversationHash(conversation)
    if (await this.hasJob(hash)) {
      await rm(path, { force: true })
      return { status: 'duplicate' as const, id: hash }
    }
    const job: ImprovementJob = {
      version: IMPROVEMENT_SCHEMA_VERSION,
      id: hash,
      conversationHash: hash,
      enqueuedAt: Date.now(),
      attempts: 0,
      stage: 'queued',
      source,
      conversation,
    }
    await atomicWrite(join(this.directory('inbox'), `${hash}.json`), job)
    await rm(path, { force: true })
    return { status: 'queued' as const, id: hash }
  }

  async reviewConversation(value: unknown, userScope: string, source: ImprovementJob['source'] = 'history') {
    if (!this.enabled) return { status: 'disabled' as const }
    await this.prepare()
    const parsed = normalizeImprovementConversation(value, userScope)
    if (!parsed) return { status: 'invalid' as const }
    const conversation = { ...parsed, userScope }
    const path = this.conversationPath(userScope, conversation.threadId)
    return this.withConversationLock(path, async () => {
      await atomicWrite(path, conversation)
      return this.queueConversationAtPath(path, userScope, source)
    })
  }

  async queueIdleConversations(now = Date.now()) {
    if (!this.enabled) return []
    await this.prepare()
    await this.compactTerminalJobs(now)
    const queued = []
    for (const file of await jsonFiles(this.directory('conversations'))) {
      const path = join(this.directory('conversations'), file)
      const result = await this.withConversationLock(path, async () => {
        const conversation = normalizeImprovementConversation(await readJson(path))
        if (!conversation || now - conversation.updatedAt < this.quietMs) return null
        return this.queueConversationAtPath(path, conversation.userScope, 'runtime', now - this.quietMs)
      })
      if (result) queued.push(result)
    }
    return queued
  }

  private async hasJob(hash: string, now = Date.now()) {
    for (const directory of ['inbox', 'processing', 'results'] as const) {
      if (await readJson(join(this.directory(directory), `${hash}.json`))) return true
    }
    const failedPath = join(this.directory('failed'), `${hash}.json`)
    const failed = await readJson<{ retryAfter?: string }>(failedPath)
    if (!failed) return false
    const retryAfter = failed.retryAfter ? Date.parse(failed.retryAfter) : Number.POSITIVE_INFINITY
    if (retryAfter > now) return true
    await rm(failedPath, { force: true })
    return false
  }

  async claimNextJob(now = Date.now()) {
    if (!this.enabled) return null
    await this.prepare()
    const files = await jsonFiles(this.directory('inbox'))
    let first: string | undefined
    for (const file of files) {
      const candidate = await readJson<ImprovementJob>(join(this.directory('inbox'), file))
      if (candidate && (candidate.notBefore === undefined || candidate.notBefore <= now)) {
        first = file
        break
      }
    }
    if (!first) return null
    const from = join(this.directory('inbox'), first)
    const to = join(this.directory('processing'), first)
    try {
      await rename(from, to)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
      throw error
    }
    const job = await readJson<ImprovementJob>(to)
    if (!job) return null
    const claimed = { ...job, claimedAt: now }
    await atomicWrite(to, claimed)
    return { job: claimed, path: to }
  }

  async updateProcessingJob(processingPath: string, job: ImprovementJob) {
    await atomicWrite(processingPath, job)
  }

  async readProcessingJob(processingPath: string) {
    return readJson<ImprovementJob>(processingPath)
  }

  async completeJob(processingPath: string, result: Record<string, unknown>) {
    const id = basename(processingPath, '.json')
    await this.writeResult(id, result)
    await rm(processingPath, { force: true })
  }

  async failJob(processingPath: string, result: Record<string, unknown>) {
    const id = basename(processingPath, '.json')
    const now = Date.now()
    await atomicWrite(join(this.directory('failed'), `${id}.json`), {
      ...result,
      processedAt: typeof result.processedAt === 'string' ? result.processedAt : new Date(now).toISOString(),
      retryAfter: new Date(now + FAILED_RETRY_MS).toISOString(),
    })
    await rm(processingPath, { force: true })
  }

  async compactTerminalJobs(now = Date.now()) {
    await this.prepare()
    for (const directory of ['results', 'failed'] as const) {
      const records = []
      for (const file of await jsonFiles(this.directory(directory))) {
        const path = join(this.directory(directory), file)
        const value = await readJson<{ processedAt?: string; failedAt?: string }>(path)
        const timestamp = Date.parse(value?.processedAt ?? value?.failedAt ?? '')
        if (Number.isFinite(timestamp) && now - timestamp > TERMINAL_RETENTION_MS) {
          await rm(path, { force: true })
          continue
        }
        records.push({ path, timestamp: Number.isFinite(timestamp) ? timestamp : 0 })
      }
      records.sort((left, right) => right.timestamp - left.timestamp)
      await Promise.all(records.slice(MAX_TERMINAL_FILES).map((record) => rm(record.path, { force: true })))
    }
  }

  async retryJob(processingPath: string, job: ImprovementJob, message: string, delayMs = 5 * 60_000) {
    const retry: ImprovementJob = {
      ...job,
      attempts: job.attempts + 1,
      claimedAt: undefined,
      notBefore: Date.now() + delayMs,
    }
    await atomicWrite(join(this.directory('inbox'), `${job.id}.json`), retry)
    await atomicWrite(join(this.root, 'last-error.json'), {
      jobId: job.id,
      message,
      failedAt: new Date().toISOString(),
      retryAt: new Date(retry.notBefore!).toISOString(),
    })
    await rm(processingPath, { force: true })
  }

  async writeWorkerStatus(status: ImprovementWorkerStatus) {
    if (!this.enabled) return
    await this.prepare()
    await atomicWrite(join(this.root, 'worker-status.json'), status)
  }

  private async writeResult(id: string, result: Record<string, unknown>) {
    await atomicWrite(join(this.directory('results'), `${id}.json`), result)
  }

  async info(chatModel: string): Promise<HomeMcpInfo> {
    await this.prepare()
    const worker = this.enabled
      ? await readJson<ImprovementWorkerStatus>(join(this.root, 'worker-status.json')) ?? DEFAULT_WORKER_STATUS
      : DEFAULT_WORKER_STATUS
    const processingCount = this.enabled ? (await jsonFiles(this.directory('processing'))).length : 0
    return {
      chatModel,
      mcpVersion: metadata.serverVersion,
      supportedTools: ['lights'],
      queue: {
        enabled: this.enabled,
        autoPublish: this.autoPublish,
        pending: this.enabled ? (await jsonFiles(this.directory('inbox'))).length : 0,
        processing: processingCount > 0 || worker.state === 'processing',
        lastError: worker.state === 'error' ? 'improvement-failed' : null,
      },
      improvements: metadata.improvements.slice(0, 5),
    }
  }
}
