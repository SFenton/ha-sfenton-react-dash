import { createHash } from 'node:crypto'
import { parseLightUtterance, type LightContext } from '../light-skill'
import {
  IMPROVEMENT_SCHEMA_VERSION,
  MAX_IMPROVEMENT_ASSISTANT_CHARS,
  MAX_IMPROVEMENT_TURNS,
  type ImprovementConversation,
  type ImprovementConversationTurn,
} from './types'

const IDENTIFIER = /^[a-zA-Z0-9_-]{1,100}$/
const CONTEXTUAL_LIGHT_FOLLOW_UP = /^(?:and\s+)?(?:why|which ones|what about now|before that|what does that mean|what are those rules|try again|yes|no|okay|ok|thanks|thank you|perfect|great|never mind|cancel)[?.!,\s]*$/i
const SECRET = /\b(?:gh[opsu]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|Bearer\s+\S+)\b/gi
const SECRET_ASSIGNMENT = /\b(?:api[_ -]?key|access[_ -]?token|auth(?:orization)?|password|passwd|passcode|secret|private[_ -]?key)\b(?:(?![.!?\n]).){0,80}?(?::|=|\bis\b|\bwas\b|\bare\b)\s*(?:"[^"\n]*"|'[^'\n]*'|[^.!?\n]{1,200})/gi
const NETWORK_ASSIGNMENT = /\b(?:wi[- ]?fi(?: network)?|wireless network|ssid)\b(?:(?![.!?\n]).){0,80}?(?::|=|\bis\b|\bwas\b|\bare\b)\s*(?:"[^"\n]{1,64}"|'[^'\n]{1,64}'|[A-Za-z0-9._ -]{1,64}?)(?=\s+(?:and|but)\b|[;!?]|\.(?:\s|$)|$)/gi
const ACCESS_CODE = /\b(?:guest\s+)?(?:pass[ -]?code|pin|door\s+code|access\s+code)\b\s*(?:(?::|=|\bis\b|\bwas\b|\bare\b)\s*)?#?\s*[A-Za-z0-9-]{3,32}\b/gi
const PEM_BLOCK = /-----BEGIN [^-]+-----[\s\S]*?-----END [^-]+-----/g
const HIGH_ENTROPY_TOKEN = /\b(?=[A-Za-z0-9_+=/-]{24,}\b)(?=[A-Za-z0-9_+=/-]*[A-Z])(?=[A-Za-z0-9_+=/-]*[a-z])(?=[A-Za-z0-9_+=/-]*\d)[A-Za-z0-9_+=/-]+\b/g
const ENTITY_ID = /\b[a-z0-9_]+\.[a-z0-9_]+\b/gi
const URL = /\bhttps?:\/\/\S+/gi
const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi
const STREET_ADDRESS = /\b\d{1,6}\s+[A-Za-z0-9.' -]{1,80}\s(?:street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr|court|ct|way|parkway|pkwy)\b/gi
const PRIVATE_DETAIL = /\b(?:medical|health|diagnosis|appointment|street address|home address|email address|phone number|social security|ssn|credit card|bank account)\b(?:(?![.!?\n]).){0,200}/gi
const PHONE_NUMBER = /(?:\+\d{1,3}[ .-]?)?(?:\(\d{2,4}\)|\d{2,4})[ .-]\d{2,4}[ .-]\d{3,4}\b/g
const SSN = /\b\d{3}-\d{2}-\d{4}\b/g
const LONG_NUMBER = /\b\d{7,}\b/g
const GROUPED_NUMBER = /\b(?:\d{3,4}[ -]){2,}\d{3,4}\b/g

function object(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function sanitizeImprovementText(value: string, max: number) {
  return value
    .replace(PEM_BLOCK, '[redacted]')
    .replace(NETWORK_ASSIGNMENT, '[redacted]')
    .replace(SECRET_ASSIGNMENT, '[redacted]')
    .replace(ACCESS_CODE, '[redacted]')
    .replace(SECRET, '[redacted]')
    .replace(HIGH_ENTROPY_TOKEN, '[redacted]')
    .replace(URL, '[link]')
    .replace(EMAIL, '[redacted]')
    .replace(STREET_ADDRESS, '[redacted]')
    .replace(ENTITY_ID, '[entity]')
    .replace(PRIVATE_DETAIL, '[redacted]')
    .replace(PHONE_NUMBER, '[redacted]')
    .replace(SSN, '[redacted]')
    .replace(GROUPED_NUMBER, '[redacted]')
    .replace(LONG_NUMBER, '[redacted]')
    .slice(0, max)
}

export function improvementTextNeedsRedaction(value: string) {
  return sanitizeImprovementText(value, value.length) !== value
}

function parseContext(value: unknown): LightContext | null {
  if (!object(value) || value.domain !== 'lights'
    || !(value.roomId === null || typeof value.roomId === 'string')
    || !Array.isArray(value.entityIds) || !value.entityIds.every((item) => typeof item === 'string')
    || !Array.isArray(value.lightNames) || !value.lightNames.every((item) => typeof item === 'string')) return null
  return {
    domain: 'lights',
    roomId: value.roomId,
    entityIds: [],
    lightNames: value.lightNames,
    ...(typeof value.lastAction === 'string' ? { lastAction: value.lastAction as LightContext['lastAction'] } : {}),
    ...(typeof value.lastState === 'string' ? { lastState: value.lastState as LightContext['lastState'] } : {}),
    ...(value.targetState === 'on' || value.targetState === 'off' ? { targetState: value.targetState } : {}),
    ...(typeof value.historyBefore === 'string' ? { historyBefore: value.historyBefore } : {}),
  }
}

function parseTurn(value: unknown, index: number): ImprovementConversationTurn | null {
  if (!object(value)) return null
  const userText = typeof value.userText === 'string' ? sanitizeImprovementText(value.userText.trim(), 180) : ''
  const assistantText = value.assistantText === null
    ? null
    : typeof value.assistantText === 'string'
      ? sanitizeImprovementText(value.assistantText.trim(), MAX_IMPROVEMENT_ASSISTANT_CHARS)
      : null
  const outcome = ['answer', 'error', 'empty', 'failed'].includes(String(value.outcome))
    ? value.outcome as ImprovementConversationTurn['outcome']
    : null
  if (!userText || !outcome) return null
  return {
    id: typeof value.id === 'string' && IDENTIFIER.test(value.id) ? value.id : `turn-${index + 1}`,
    createdAt: typeof value.createdAt === 'number' && Number.isFinite(value.createdAt) ? value.createdAt : Date.now(),
    userText,
    assistantText,
    outcome,
    parsedAsLights: false,
    contextBefore: parseContext(value.contextBefore),
    contextAfter: parseContext(value.contextAfter),
  }
}

export function normalizeImprovementConversation(value: unknown, fallbackUserScope = 'unknown'): ImprovementConversation | null {
  if (!object(value) || typeof value.threadId !== 'string' || !IDENTIFIER.test(value.threadId)
    || !Array.isArray(value.turns) || value.turns.length < 1 || value.turns.length > MAX_IMPROVEMENT_TURNS) return null
  const turns = value.turns.map(parseTurn)
  if (turns.some((turn) => turn === null)) return null
  const parsedTurns = turns as ImprovementConversationTurn[]
  let context: LightContext | null = null
  const classifiedTurns = parsedTurns.map((turn) => {
    const contextBefore = turn.contextBefore ?? context
    const parsed = parseLightUtterance(turn.userText, contextBefore)
    const contextAfter = turn.contextAfter ?? parsed?.context ?? contextBefore
    const classified = {
      ...turn,
      parsedAsLights: Boolean(parsed),
      contextBefore,
      contextAfter,
    }
    context = contextAfter
    return classified
  })
  const createdAt = typeof value.createdAt === 'number' && Number.isFinite(value.createdAt)
    ? value.createdAt : parsedTurns[0].createdAt
  const updatedAt = typeof value.updatedAt === 'number' && Number.isFinite(value.updatedAt)
    ? value.updatedAt : parsedTurns.at(-1)!.createdAt
  return {
    version: IMPROVEMENT_SCHEMA_VERSION,
    threadId: value.threadId,
    userScope: typeof value.userScope === 'string' && IDENTIFIER.test(value.userScope) ? value.userScope : fallbackUserScope,
    createdAt,
    updatedAt,
    turns: classifiedTurns,
  }
}

export function conversationIsSupportedLights(conversation: ImprovementConversation) {
  let context: LightContext | null = null
  let lightTurns = 0
  for (const turn of conversation.turns) {
    const turnContext: LightContext | null = turn.contextBefore ?? context
    const parsed = parseLightUtterance(turn.userText, turnContext)
    const lightLike = Boolean(parsed) || (Boolean(turnContext) && CONTEXTUAL_LIGHT_FOLLOW_UP.test(turn.userText))
    if (!lightLike) return false
    if (parsed) lightTurns += 1
    context = turn.contextAfter ?? parsed?.context ?? turnContext
  }
  return lightTurns > 0
}

export function conversationHash(conversation: ImprovementConversation) {
  const stable = {
    threadId: conversation.threadId,
    userScope: conversation.userScope,
    turns: conversation.turns.map((turn) => ({
      id: turn.id,
      userText: turn.userText,
      assistantText: turn.assistantText,
      outcome: turn.outcome,
      contextBefore: turn.contextBefore,
      contextAfter: turn.contextAfter,
    })),
  }
  return createHash('sha256').update(JSON.stringify(stable)).digest('hex')
}
