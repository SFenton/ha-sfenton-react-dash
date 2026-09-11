import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { GlobalQuickLinksAction } from './GlobalQuickLinksAction'
import { mockState, resetMockHass, setMockUser } from '../../test/mocks/hakitCoreState'
import { mockChatMessages, mockChatServer } from '../../test/mocks/chatServer'
import { chatFixtureRecords } from '../../test/fixtures/chat'
import {
  CHAT_STORAGE_PREFIX, chatRecordKey,
  type ChatRecord, type ChatRequestRecord, type ChatResultRecord, type ChatThreadRecord,
} from '../hass/chat/chatRecords'

// @covers src/components/hass/chat/ChatHeaderActions.tsx
// @covers src/components/hass/chat/ChatPanel.tsx
// @covers src/components/hass/chat/useDashboardChat.ts
// @covers src/components/shell/GlobalQuickLinksAction.tsx
// @covers src/i18n/index.ts
// @covers src/i18n/resources.ts
// @covers src/i18n/locales/en/modals/chat.json
// @covers src/test/fixtures/chat.ts
// @covers src/test/mocks/hakitCoreState.ts
const nativeCalls = () => mockChatServer.calls.filter((call) => call.message.type === 'conversation/process')
const reply = (text: string) => ({
  conversation_id: 'native-chat-test',
  response: { response_type: 'query_answer', speech: { plain: { speech: text } } },
})

async function openChat() {
  fireEvent.click(screen.getByRole('button', { name: 'Open Chat and Quick Links' }))
  const dialog = await screen.findByRole('dialog', { name: 'Home Assistant' })
  await waitFor(() => expect(within(dialog).getByRole('textbox', { name: 'Chat Message' })).toBeEnabled())
  return dialog
}

describe('global chat UX', () => {
  beforeEach(() => { resetMockHass() })
  afterEach(() => {
    delete window.__homeMcpUrl
    vi.unstubAllGlobals()
  })

  it('is inert before opening and defaults to Home Assistant with bottommost ordered tabs', async () => {
    render(<GlobalQuickLinksAction onNavigate={() => undefined} />)
    expect(mockChatMessages).toEqual([])
    const dialog = await openChat()
    const tabs = within(dialog).getAllByRole('tab')
    expect(tabs.map((tab) => tab.getAttribute('aria-label'))).toEqual(['Home Assistant', 'Quick Links'])
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true')
    const dock = dialog.querySelector('[data-modal-sheet-navigation="true"]')!
    const composer = dock.querySelector('[data-chat-composer="true"]')!
    const tablist = within(dialog).getByRole('tablist')
    expect(composer.compareDocumentPosition(tablist) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(dialog.querySelector('[data-modal-sheet-footer]')).toBeNull()
    const headerActions = dialog.querySelector('[data-modal-sheet-header-actions]')!
    expect(headerActions).toContainElement(within(dialog).getByRole('button', { name: 'View History' }))
    expect(headerActions).toContainElement(within(dialog).getByRole('button', { name: 'Open Chat Settings' }))
    expect(headerActions).toContainElement(within(dialog).getByRole('button', { name: 'Start New Chat' }))
    expect(dialog.querySelector('[data-modal-sheet-body]')).not.toContainElement(headerActions)
    expect(nativeCalls()).toHaveLength(0)
  })

  it('uses the requested invitation without a single-agent name or storage disclaimer', async () => {
    mockChatServer.agents = [{ id: 'conversation.mock_gemini', name: 'Google AI Conversation' }]
    render(<GlobalQuickLinksAction onNavigate={() => undefined} />)
    const dialog = await openChat()
    expect(within(dialog).getByRole('heading', { name: 'Home Assistant Agent' })).toBeVisible()
    expect(within(dialog).getByText('Ask a question or give a command to Home Assistant.')).toBeVisible()
    expect(within(dialog).queryByText('Google AI Conversation')).not.toBeInTheDocument()
    expect(within(dialog).queryByText(/Chats are shared with other devices/)).not.toBeInTheDocument()
    expect(within(dialog).queryByText('conversation.mock_gemini')).not.toBeInTheDocument()
  })

  it('opens instrumented Chat Settings in the same sheet', async () => {
    window.__homeMcpUrl = '/api/sfenton_home_mcp'
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      result: {
        structuredContent: {
          chatModel: 'Gemini 3.1 Flash Lite',
          mcpVersion: '0.2.0',
          supportedTools: ['lights'],
          queue: { enabled: true, autoPublish: true, pending: 0, processing: false, lastError: null },
          improvements: [{
            version: '0.2.0',
            publishedAt: '2026-09-10T14:00:00.000Z',
            summary: ['Learns from completed light conversations one at a time.'],
          }],
        },
      },
    }), { status: 200, headers: { 'content-type': 'application/json' } })))
    render(<GlobalQuickLinksAction onNavigate={() => undefined} />)
    const dialog = await openChat()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Open Chat Settings' }))

    expect(await screen.findByRole('dialog', { name: 'Chat Settings' })).toBe(dialog)
    expect(within(dialog).getByText('Gemini 3.1 Flash Lite')).toBeVisible()
    expect(within(dialog).getByText('1.0.0')).toBeVisible()
    expect(within(dialog).getByText('0.2.0')).toBeVisible()
    expect(within(dialog).getByText('Queue · Idle • 0 Waiting')).toBeVisible()
    expect(within(dialog).queryByRole('textbox', { name: 'Chat Message' })).not.toBeInTheDocument()
  })

  it('submits only an explicit IME-safe action and preserves pending work through tabs and close', async () => {
    let finish!: (value: unknown) => void
    mockChatServer.process = () => new Promise((resolve) => { finish = resolve })
    render(<GlobalQuickLinksAction onNavigate={() => undefined} />)
    const dialog = await openChat()
    const input = within(dialog).getByRole('textbox', { name: 'Chat Message' })
    fireEvent.change(input, { target: { value: 'A focused question\nWith another line' } })
    expect(input).toHaveAttribute('aria-keyshortcuts', 'Enter')
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true })
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true })
    fireEvent.keyDown(input, { key: 'Enter', keyCode: 229 })
    fireEvent.keyDown(input, { key: 'Enter', repeat: true })
    fireEvent.compositionStart(input)
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(nativeCalls()).toHaveLength(0)
    fireEvent.compositionEnd(input)
    fireEvent.keyDown(input, { key: 'Enter' })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(nativeCalls()).toHaveLength(1))
    const thinking = await within(dialog).findByRole('status', { name: 'Waiting for the Assistant to Reply…' })
    expect(thinking.querySelectorAll('[aria-hidden="true"]')).toHaveLength(3)
    expect(within(dialog).getAllByRole('status')).toHaveLength(1)
    expect(dialog.querySelector('[data-chat-role="user"]')).toHaveTextContent('A focused question')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Send Chat Message' }))
    expect(nativeCalls()).toHaveLength(1)
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    fireEvent.click(within(dialog).getByRole('tab', { name: 'Quick Links' }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }))
    expect(dialog).toHaveAttribute('data-closing', 'true')
    await act(async () => { finish(reply('The actual mocked assistant response.')) })
    fireEvent.click(screen.getByRole('button', { name: 'Open Chat and Quick Links' }))
    const reopened = await screen.findByRole('dialog', { name: 'Quick Links' })
    expect(within(reopened).getByRole('tab', { name: 'Quick Links' })).toHaveAttribute('aria-selected', 'true')
    fireEvent.click(within(reopened).getByRole('tab', { name: 'Home Assistant' }))
    expect(await screen.findByText('The actual mocked assistant response.')).toBeInTheDocument()
    expect(reopened.querySelector('[data-chat-thinking]')).toBeNull()
    expect(within(reopened).getByRole('article', { name: 'You' })).toHaveTextContent('A focused question')
    expect(within(reopened).getByRole('article', { name: 'Google Gemini' })).toHaveTextContent('The actual mocked assistant response.')
    expect(within(reopened).queryByText('You', { exact: true })).not.toBeInTheDocument()
    expect(within(reopened).queryByText('Google Gemini', { exact: true })).not.toBeInTheDocument()
    expect(nativeCalls()).toHaveLength(1)
  })

  it('opens custom color in the same sheet and retains the chosen RGB value on Back', async () => {
    mockChatServer.seed(mockState.user!.id, chatFixtureRecords('light-color-control', Date.now()))
    render(<GlobalQuickLinksAction onNavigate={() => undefined} />)
    const dialog = await openChat()
    fireEvent.click(within(dialog).getByRole('button', { name: 'View History' }))
    fireEvent.click(within(dialog).getByRole('button', { name: /Change the Music Room lights/ }))
    const custom = within(dialog).getByRole('button', { name: 'Custom' })
    fireEvent.click(custom)
    expect(await screen.findByRole('dialog', { name: 'Custom' })).toBe(dialog)
    fireEvent.change(within(dialog).getByRole('spinbutton', { name: 'R channel' }), { target: { value: '12' } })
    fireEvent.change(within(dialog).getByRole('spinbutton', { name: 'G channel' }), { target: { value: '34' } })
    fireEvent.change(within(dialog).getByRole('spinbutton', { name: 'B channel' }), { target: { value: '56' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Back', exact: true }))
    expect(await screen.findByRole('dialog', { name: 'Home Assistant' })).toBe(dialog)
    const retainedCustom = within(dialog).getByRole('button', { name: 'Custom' })
    expect(retainedCustom).toHaveAttribute('aria-pressed', 'true')
    expect(retainedCustom.style.getPropertyValue('--chat-custom-color')).toBe('rgb(12 34 56)')
  })

  it('opens history in the same sheet without sending and starts a genuinely empty new chat', async () => {
    render(<GlobalQuickLinksAction onNavigate={() => undefined} />)
    const dialog = await openChat()
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'History question' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Send Chat Message' }))
    await within(dialog).findByText('What would you like to explore next?')
    fireEvent.click(within(dialog).getByRole('button', { name: 'View History' }))
    expect(await screen.findByRole('dialog', { name: 'Chat History' })).toBe(dialog)
    fireEvent.click(within(dialog).getByRole('button', { name: /History question/ }))
    expect(await screen.findByRole('dialog', { name: 'Home Assistant' })).toBe(dialog)
    expect(nativeCalls()).toHaveLength(1)
    fireEvent.click(within(dialog).getByRole('button', { name: 'Start New Chat' }))
    expect(within(dialog).getByRole('textbox')).toHaveValue('')
    expect(dialog.querySelector('[data-chat-role]')).toBeNull()
    expect(nativeCalls()).toHaveLength(1)
  })

  it('hides conversations older than fourteen days while retaining their stored records', async () => {
    const now = Date.now()
    const records = (id: string, ageDays: number, text: string): ChatRecord[] => {
      const createdAt = now - ageDays * 24 * 60 * 60_000
      const thread: ChatThreadRecord = { version: 1, kind: 'thread', id, agentId: 'conversation.mock_gemini', agentName: 'Google Gemini', createdAt }
      const request: ChatRequestRecord = { version: 1, kind: 'request', id: `${id}-turn`, threadId: id, parentId: null, clientId: 'seed', text, conversationId: null, createdAt }
      const result: ChatResultRecord = { version: 1, kind: 'result', id: request.id, threadId: id, text: `${text} reply`, conversationId: `native-${id}`, response: 'answer', contextReset: false, createdAt: createdAt + 1000 }
      return [thread, request, result]
    }
    const stored = [...records('recent-chat', 13, 'Recent retained chat'), ...records('old-chat', 15, 'Old retained chat')]
    mockChatServer.seed(mockState.user!.id, Object.fromEntries(stored.map((record) => [chatRecordKey(record), record])))
    render(<GlobalQuickLinksAction onNavigate={() => undefined} />)
    const dialog = await openChat()
    fireEvent.click(within(dialog).getByRole('button', { name: 'View History' }))

    expect(within(dialog).getByRole('button', { name: /Recent retained chat/ })).toBeVisible()
    expect(within(dialog).queryByRole('button', { name: /Old retained chat/ })).not.toBeInTheDocument()
    expect(Object.keys(mockChatServer.data(mockState.user!.id)).filter((key) => key.startsWith(CHAT_STORAGE_PREFIX))).toHaveLength(6)
  })

  it('restores the header history trigger and transcript scroll position on Back', async () => {
    render(<GlobalQuickLinksAction onNavigate={() => undefined} />)
    const dialog = await openChat()
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'A saved reading position' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Send Chat Message' }))
    await within(dialog).findByText('What would you like to explore next?')
    const body = dialog.querySelector<HTMLElement>('[data-modal-sheet-body]')!
    body.scrollTop = 240
    fireEvent.click(within(dialog).getByRole('button', { name: 'View History' }))
    expect(await screen.findByRole('dialog', { name: 'Chat History' })).toBe(dialog)
    expect(body.scrollTop).toBe(0)
    fireEvent.click(within(dialog).getByRole('button', { name: 'Back', exact: true }))
    expect(await screen.findByRole('dialog', { name: 'Home Assistant', exact: true })).toBe(dialog)
    expect(body.scrollTop).toBe(240)
    expect(within(dialog).getByRole('button', { name: 'View History' })).toHaveFocus()
  })

  it('explains a not-sent thread and offers a fresh chat without replaying its draft', async () => {
    let failRequest = true
    mockChatServer.beforeWrite = async ({ message }) => {
      if ((message.value as { kind: string }).kind === 'request' && failRequest) throw new Error('Save failed')
    }
    render(<GlobalQuickLinksAction onNavigate={() => undefined} />)
    const dialog = await openChat()
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'An unsent request' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Send Chat Message' }))
    expect(await within(dialog).findByText('The displayed message was not submitted to the assistant.', { exact: false })).toBeVisible()
    failRequest = false
    fireEvent.click(within(dialog).getByRole('button', { name: 'Retry Saving Chat History' }))
    await waitFor(() => expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument())
    expect(within(dialog).getByRole('textbox')).toBeDisabled()
    expect(within(dialog).getByText('Earlier messages will not be replayed.', { exact: false })).toBeVisible()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Start New Chat' }))
    expect(within(dialog).getByRole('textbox')).toBeEnabled()
    expect(within(dialog).getByRole('textbox')).toHaveValue('')
    expect(nativeCalls()).toHaveLength(0)
  })

  it('retains ordinary native agent selection without model controls or metadata requests', async () => {
    mockChatServer.agents.push({ id: 'conversation.second_gemini', name: 'Second Assistant' })
    mockChatServer.platforms['conversation.second_gemini'] = 'google_generative_ai_conversation'
    render(<GlobalQuickLinksAction onNavigate={() => undefined} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open Chat and Quick Links' }))
    const dialog = await screen.findByRole('dialog', { name: 'Home Assistant' })
    const choice = await within(dialog).findByRole('combobox')
    expect(within(dialog).getByRole('textbox')).toBeDisabled()
    expect(within(dialog).queryByRole('button', { name: 'Models' })).not.toBeInTheDocument()
    expect(within(dialog).queryByText(/Currently selected model:/)).not.toBeInTheDocument()
    fireEvent.change(choice, { target: { value: 'conversation.second_gemini' } })
    expect(within(dialog).getByRole('textbox')).toBeEnabled()
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'A focused question' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Send Chat Message' }))
    await within(dialog).findByText('What would you like to explore next?')
    expect(within(dialog).queryByText(/Model changed to/)).not.toBeInTheDocument()
    expect(dialog.querySelector('[data-chat-models]')).toBeNull()
    expect(mockChatServer.calls.some((call) => String(call.message.type).includes('device_registry'))).toBe(false)
    expect(nativeCalls()).toHaveLength(1)
    expect(nativeCalls()[0].message.agent_id).toBe('conversation.second_gemini')
  })

  it('keeps the entire oversized reply readable with an explicit session-only warning after reload', async () => {
    const received = 'x'.repeat(64001)
    mockChatServer.process = async () => reply(received)
    render(<GlobalQuickLinksAction onNavigate={() => undefined} />)
    const dialog = await openChat()
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'A small request' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Send Chat Message' }))
    await waitFor(() => expect(within(dialog).getByRole('alert')).toHaveTextContent('refreshing or closing the browser loses the unsaved reply'))
    expect(dialog.querySelector('[data-chat-role="assistant"] > div')?.textContent === received).toBe(true)
    expect(within(dialog).getByText('Reply History Save Unconfirmed')).toBeVisible()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Retry Loading Chat' }))
    await waitFor(() => expect(within(dialog).getByRole('alert')).toHaveTextContent('unavailable on other devices'))
    expect(dialog.querySelector('[data-chat-role="assistant"] > div')?.textContent === received).toBe(true)
    expect(nativeCalls()).toHaveLength(1)
  })

  it('does not present failed or unknown-version history as an empty successful load', async () => {
    mockChatServer.seed(mockState.user!.id, { [`${CHAT_STORAGE_PREFIX}v9.future`]: { version: 9 } })
    mockChatServer.beforeRead = async () => { throw new Error('Read failure') }
    render(<GlobalQuickLinksAction onNavigate={() => undefined} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open Chat and Quick Links' }))
    const dialog = await screen.findByRole('dialog', { name: 'Home Assistant' })
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Chat could not be loaded')
    fireEvent.click(within(dialog).getByRole('button', { name: 'View History' }))
    expect(within(dialog).queryByText('No Stored Chats for This Account')).not.toBeInTheDocument()
    mockChatServer.beforeRead = undefined
    mockChatServer.seed(mockState.user!.id, { [`${CHAT_STORAGE_PREFIX}v9.future`]: { version: 9 } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Retry Loading Chat' }))
    await waitFor(() => expect(within(dialog).getByRole('alert')).toHaveTextContent('unreadable format'))
    expect(within(dialog).queryByText('No Stored Chats for This Account')).not.toBeInTheDocument()
    mockChatServer.users.set(mockState.user!.id, {})
    fireEvent.click(within(dialog).getByRole('button', { name: 'Retry Loading Chat' }))
    await within(dialog).findByText('No Stored Chats for This Account')
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument()
    expect(nativeCalls()).toHaveLength(0)
  })

  it('purges private messages even during the mounted close frame when the account changes', async () => {
    render(<GlobalQuickLinksAction onNavigate={() => undefined} />)
    const dialog = await openChat()
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'Private account message' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Send Chat Message' }))
    await within(dialog).findByText('What would you like to explore next?')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }))
    act(() => setMockUser({ id: 'another-account', name: 'Another account' }))
    expect(screen.queryByText('Private account message')).not.toBeInTheDocument()
    expect(screen.queryByText('What would you like to explore next?')).not.toBeInTheDocument()
    expect(mockChatServer.data('another-account')).toEqual({})
  })

  it('renders user and agent markup as plain text and surfaces oversized draft input', async () => {
    mockChatServer.process = async () => reply('<script>unsafe()</script>\nA long_token_' + 'x'.repeat(200))
    render(<GlobalQuickLinksAction onNavigate={() => undefined} />)
    const dialog = await openChat()
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: '<img src="external"> is just message text' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Send Chat Message' }))
    await waitFor(() => expect(dialog.querySelector('[data-chat-role="assistant"]')).not.toBeNull())
    expect(dialog.querySelector('[data-chat-transcript] script, [data-chat-transcript] img')).toBeNull()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Start New Chat' }))
    const oversized = 'x'.repeat(4001)
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: oversized } })
    expect(within(dialog).getByRole('textbox')).toHaveValue(oversized)
    expect(within(dialog).getByRole('alert')).toHaveTextContent('at most 180 characters')
    expect(within(dialog).getByRole('button', { name: 'Send Chat Message' })).toBeDisabled()
  })
})
