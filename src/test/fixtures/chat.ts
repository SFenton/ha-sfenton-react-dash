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
  'not-sent', 'oversized-reply', 'multiple-agents', 'unreadable', 'limit', 'history-retained',
  'light-room-control', 'light-color-control', 'light-custom-color-control', 'light-brightness-control',
  'settings',
] as const

export function chatFixtureRecords(kind: 'conversation' | 'archive' | 'unknown' | 'conflict' | 'long' | 'reset' | 'empty-reply' | 'agent-error' | 'not-sent' | 'limit' | 'history-retained' | 'light-room-control' | 'light-color-control' | 'light-custom-color-control' | 'light-brightness-control', now: number): Record<string, ChatRecord> {
  if (kind === 'limit') return Object.fromEntries(Array.from({ length: CHAT_THREAD_LIMIT + 1 }, (_, index) => {
    const record = {
      version: 1, kind: 'thread', id: `layout-reservation-${index}`, createdAt: now,
      agentId: CHAT_FIXTURE_AGENT, agentName: 'Google Gemini',
    } satisfies ChatRecord
    return [chatRecordKey(record), record]
  }))
  if (kind === 'history-retained') {
    const recent: Record<string, ChatRecord> = chatFixtureRecords('conversation', now)
    const oldStarted = now - 15 * 24 * 60 * 60_000
    const oldThread = { version: 1, kind: 'thread', id: 'layout-chat-retained', createdAt: oldStarted, agentId: CHAT_FIXTURE_AGENT, agentName: 'Google Gemini' } satisfies ChatRecord
    const oldRequest = {
      version: 1, kind: 'request', id: 'layout-turn-retained', threadId: oldThread.id, clientId: 'another-device',
      parentId: null, conversationId: null, createdAt: oldStarted, text: 'Retained conversation outside the visible history window.',
    } satisfies ChatRequestRecord
    const oldResult = {
      version: 1, kind: 'result', id: oldRequest.id, threadId: oldThread.id, createdAt: oldStarted + 1000,
      text: 'This retained reply should remain stored but hidden.', conversationId: '01LAYOUTRETAINEDCONTEXT0000',
      response: 'answer', contextReset: false,
    } satisfies ChatResultRecord
    return { ...recent, ...Object.fromEntries([oldThread, oldRequest, oldResult].map((record) => [chatRecordKey(record), record])) }
  }
  const started = kind === 'archive' ? now - 10 * 60_000 : now - 10_000
  const request: ChatRequestRecord = {
    version: 1, kind: 'request', id: 'layout-turn', threadId: CHAT_FIXTURE_THREAD, clientId: 'another-device',
    parentId: null, conversationId: null, createdAt: started,
    text: kind === 'long' ? `${CHAT_FIXTURE_PROMPT}\n\n${'A long, specific detail to keep in view. '.repeat(25)}\n${'unbroken_'.repeat(70)}`
      : kind === 'light-room-control' ? 'Turn on the lights'
        : kind === 'light-color-control' || kind === 'light-custom-color-control' ? 'Change the Music Room lights'
          : kind === 'light-brightness-control' ? 'Turn the Music Room lights to 40%'
            : CHAT_FIXTURE_PROMPT,
  }
  const result: ChatResultRecord = {
    version: 1, kind: 'result', id: request.id, threadId: CHAT_FIXTURE_THREAD, createdAt: started + 1000,
    text: kind === 'long' ? `${CHAT_FIXTURE_REPLY}\n\n${'Here is another detail in this longer reply. '.repeat(60)}\n${'long_token_'.repeat(90)}`
      : kind === 'empty-reply' ? null : kind === 'agent-error' ? 'The test assistant could not complete this reply.'
        : kind === 'light-room-control' ? 'Which room?'
          : kind === 'light-color-control' || kind === 'light-custom-color-control' ? 'What color would you like to change the Music Room lights to?'
            : kind === 'light-brightness-control' ? 'I turned the Music Room lights to 40%.' : CHAT_FIXTURE_REPLY,
    conversationId: '01LAYOUTNATIVECONTEXT000000',
    response: kind === 'empty-reply' ? 'empty' : kind === 'agent-error' ? 'error' : 'answer',
    contextReset: kind === 'reset',
    controls: kind === 'light-room-control' ? [{
      id: 'layout-light-room', kind: 'room-picker',
      options: [
        { label: 'Living Room', value: 'Living Room', message: 'Turn on the Living Room lights.' },
        { label: 'Kitchen', value: 'Kitchen', message: 'Turn on the Kitchen lights.' },
        { label: 'Music Room', value: 'Music Room', message: 'Turn on the Music Room lights.' },
      ],
    }] : kind === 'light-color-control' || kind === 'light-custom-color-control' ? [{
      id: 'layout-light-color', kind: 'color-picker', room: 'Music Room', rooms: ['Music Room'],
      palette: ['warm white', 'red', 'blue', 'purple'], supportsCustomRgb: true, colorMode: 'rgb',
      entityIds: ['light.hue_color_downlight_1_3'], currentRgb: [255, 70, 170], minTemperatureKelvin: 2000, maxTemperatureKelvin: 6500,
    }] : kind === 'light-brightness-control' ? [{
      id: 'layout-light-brightness', kind: 'brightness-slider', room: 'Music Room', value: 40, min: 0, max: 100, step: 1,
    }, {
      id: 'layout-light-suggestions', kind: 'suggestions',
      options: [{ label: 'Are They On?', message: 'Are the Music Room lights on?' }, { label: 'Why?', message: 'Why did the Music Room lights turn on?' }],
    }] : [],
    skillContext: kind.startsWith('light-') ? { domain: 'lights', roomId: kind === 'light-room-control' ? null : 'music-room', entityIds: [], lightNames: [] } : null,
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
