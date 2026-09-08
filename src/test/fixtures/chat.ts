import type { ChatRecord, ChatRequestRecord, ChatResultRecord } from '../../components/hass/chat/chatRecords'
import { CHAT_THREAD_LIMIT, chatRecordKey } from '../../components/hass/chat/chatRecords'

export const CHAT_FIXTURE_THREAD = 'layout-chat'
export const CHAT_FIXTURE_AGENT = 'conversation.mock_gemini'
export const CHAT_FIXTURE_PROMPT = 'Help me think through a small project.'
export const CHAT_FIXTURE_REPLY = 'We can take it one step at a time.\n\nWhat would you like to focus on first?'
export const CHAT_LAYOUT_STATES = [
  'empty', 'history-empty', 'conversation', 'history', 'loading', 'unavailable', 'load-error',
  'request-save-error', 'save-error', 'pending', 'archive', 'resume', 'resume-ready',
  'removed-agent', 'conflict', 'unknown', 'long', 'reset', 'empty-reply', 'agent-error',
  'not-sent', 'oversized-reply', 'multiple-agents', 'unreadable', 'limit',
] as const

export function chatFixtureRecords(kind: 'conversation' | 'archive' | 'unknown' | 'conflict' | 'long' | 'reset' | 'empty-reply' | 'agent-error' | 'not-sent' | 'limit', now: number) {
  if (kind === 'limit') return Object.fromEntries(Array.from({ length: CHAT_THREAD_LIMIT + 1 }, (_, index) => {
    const record = {
      version: 1, kind: 'thread', id: `layout-reservation-${index}`, createdAt: now,
      agentId: CHAT_FIXTURE_AGENT, agentName: 'Google Gemini',
    } satisfies ChatRecord
    return [chatRecordKey(record), record]
  }))
  const started = kind === 'archive' ? now - 10 * 60_000 : now - 10_000
  const request: ChatRequestRecord = {
    version: 1, kind: 'request', id: 'layout-turn', threadId: CHAT_FIXTURE_THREAD, clientId: 'another-device',
    parentId: null, conversationId: null, createdAt: started,
    text: kind === 'long' ? `${CHAT_FIXTURE_PROMPT}\n\n${'A long, specific detail to keep in view. '.repeat(25)}\n${'unbroken_'.repeat(70)}` : CHAT_FIXTURE_PROMPT,
  }
  const result: ChatResultRecord = {
    version: 1, kind: 'result', id: request.id, threadId: CHAT_FIXTURE_THREAD, createdAt: started + 1000,
    text: kind === 'long' ? `${CHAT_FIXTURE_REPLY}\n\n${'Here is another detail in this longer reply. '.repeat(60)}\n${'long_token_'.repeat(90)}`
      : kind === 'empty-reply' ? null : kind === 'agent-error' ? 'The test assistant could not complete this reply.' : CHAT_FIXTURE_REPLY,
    conversationId: '01LAYOUTNATIVECONTEXT000000',
    response: kind === 'empty-reply' ? 'empty' : kind === 'agent-error' ? 'error' : 'answer',
    contextReset: kind === 'reset',
  }
  const records: ChatRecord[] = [
    { version: 1, kind: 'thread', id: CHAT_FIXTURE_THREAD, createdAt: started, agentId: CHAT_FIXTURE_AGENT, agentName: 'Google Gemini' },
    request,
    ...(kind === 'unknown' || kind === 'not-sent' ? [{ version: 1, kind, id: request.id, threadId: CHAT_FIXTURE_THREAD, createdAt: started + 1000 } satisfies ChatRecord] : [result]),
  ]
  if (kind === 'conflict') records.push(
    { ...request, id: 'fork-one', parentId: request.id, text: 'A message from the first device.', createdAt: now - 2000 },
    { ...request, id: 'fork-two', parentId: request.id, text: 'A message from the second device.', createdAt: now - 1000 },
  )
  return Object.fromEntries(records.map((record) => [chatRecordKey(record), record]))
}
