import { createHomeMcpClient, HomeMcpRequestRejected, parseHomeMcpInfo } from './homeMcpClient'

describe('Home MCP client', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('marks proxy authorization and origin rejections as definitely not sent', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('Forbidden', {
      status: 403,
      headers: { 'content-type': 'text/plain' },
    })))
    const client = createHomeMcpClient('/__home-mcp', () => 'test-token')

    await expect(client.request('Are the Living Room lights on?', null, null))
      .rejects.toBeInstanceOf(HomeMcpRequestRejected)
  })

  it('keeps ambiguous upstream failures distinct from definite proxy rejection', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: { message: 'upstream failed' } }), {
      status: 502,
      headers: { 'content-type': 'application/json' },
    })))
    const client = createHomeMcpClient('/__home-mcp', () => 'test-token')

    await expect(client.request('Are the Living Room lights on?', null, null))
      .rejects.not.toBeInstanceOf(HomeMcpRequestRejected)
  })

  it('sends thread metadata, conversation completion, and info requests through distinct tools', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body)) as { params: { name: string; arguments: Record<string, unknown> } }
      const content = request.params.name === 'home_info'
        ? {
            chatModel: 'Gemini 3.1 Flash Lite',
            mcpVersion: '0.2.0',
            supportedTools: ['lights'],
            queue: { enabled: true, autoPublish: true, pending: 0, processing: false, lastError: null },
            improvements: [],
          }
        : request.params
      return new Response(JSON.stringify({ result: { structuredContent: content } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    })
    vi.stubGlobal('fetch', fetchMock)
    const client = createHomeMcpClient('/__home-mcp', () => 'test-token')
    const conversation = {
      version: 1 as const,
      threadId: 'thread-one',
      createdAt: 1,
      updatedAt: 2,
      turns: [{
        id: 'turn-one',
        createdAt: 2,
        userText: 'Turn on the lights.',
        assistantText: 'Which room?',
        outcome: 'answer' as const,
        parsedAsLights: true,
        contextBefore: null,
        contextAfter: { domain: 'lights', roomId: null, entityIds: [], lightNames: [] },
      }],
    }

    await client.request('Turn on the lights.', null, null, {
      threadId: 'thread-one',
      turnId: 'turn-one',
      controlId: 'room-picker',
    })
    await client.endConversation?.(conversation.threadId)
    await client.info()

    const calls = fetchMock.mock.calls.map(([, init]) => JSON.parse(String(init?.body)))
    expect(calls[0].params).toMatchObject({
      name: 'home_chat',
      arguments: { thread_id: 'thread-one', turn_id: 'turn-one', control_id: 'room-picker' },
    })
    expect(calls[1].params).toMatchObject({ name: 'home_chat_end', arguments: { thread_id: 'thread-one' } })
    expect(calls[2].params).toEqual({ name: 'home_info', arguments: {} })
  })

  it('rejects malformed system information', () => {
    expect(() => parseHomeMcpInfo({ chatModel: 'Gemini' })).toThrow(/invalid system information/)
  })
})
