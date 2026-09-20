import type { AddressInfo } from 'node:net'
import { request as httpRequest } from 'node:http'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHomeMcpServer, validateLightPlanForExecution } from './app'
import { ConversationImprovementStore } from './improvement/store'
import { HassAuthenticationError, type AuthenticatedHassUser } from './hass-auth'
import { HOUSE_LIGHT_ROOMS } from './lights-config'
import { parseLightUtterance } from './light-skill'
import metadata from './metadata.json' with { type: 'json' }

// @covers home-mcp/server.ts
interface UpstreamCall {
  input: string
  init?: RequestInit
}

function rpc(baseUrl: string, body: Record<string, unknown>, token = 'test-ha-token') {
  return fetch(`${baseUrl}/mcp`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

async function startServer(
  agentId?: string,
  respond?: (input: string, init?: RequestInit) => unknown,
  options: {
    improvementStore?: ConversationImprovementStore
    chatModel?: string
    authenticateUser?: (token: string) => Promise<AuthenticatedHassUser>
  } = {},
) {
  const calls: UpstreamCall[] = []
  const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const path = String(input)
    calls.push({ input: path, init })
    return new Response(JSON.stringify(respond?.(path, init) ?? { ok: true, path }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }) as typeof fetch
  const server = createHomeMcpServer({
    hassUrl: 'http://ha.test',
    agentId,
    fetchImpl,
    authenticateUser: async () => ({ id: 'test-user', isAdmin: true }),
    ...options,
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    calls,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  }
}

describe('Home MCP server', () => {
  it('requires inherited Home Assistant authorization', async () => {
    const app = await startServer()
    try {
      const response = await fetch(`${app.baseUrl}/mcp`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
      })
      expect(response.status).toBe(401)
      expect(app.calls).toHaveLength(0)
    } finally {
      await app.close()
    }
  })

  it('decodes a multi-byte JSON character split across request chunks', async () => {
    const app = await startServer()
    try {
      const body = Buffer.from(JSON.stringify({
        jsonrpc: '2.0',
        id: 100,
        method: 'tools/call',
        params: { name: 'home_chat', arguments: { text: 'Are the Living Room lights on? 💡' } },
      }))
      const marker = Buffer.from('💡')
      const split = body.indexOf(marker) + 1
      const status = await new Promise<number>((resolve, reject) => {
        const request = httpRequest(`${app.baseUrl}/mcp`, {
          method: 'POST',
          headers: { authorization: 'Bearer test-ha-token', 'content-type': 'application/json' },
        }, (response) => {
          response.resume()
          response.on('end', () => resolve(response.statusCode ?? 0))
        })
        request.on('error', reject)
        request.write(body.subarray(0, split))
        request.end(body.subarray(split))
      })
      expect(status).toBe(200)
    } finally {
      await app.close()
    }
  })

  it('rejects a forged bearer token before a queue or tool call can run', async () => {
    const root = await mkdtemp(join(tmpdir(), 'home-mcp-auth-'))
    const improvementStore = new ConversationImprovementStore({ root, enabled: true, autoPublish: true })
    const app = await startServer(undefined, undefined, {
      improvementStore,
      authenticateUser: async () => { throw new HassAuthenticationError('invalid', 'rejected') },
    })
    try {
      const response = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 101, method: 'tools/call',
        params: { name: 'home_chat_review', arguments: { conversation: { threadId: 'forged', turns: [] } } },
      }, 'forged-token')
      expect(response.status).toBe(401)
      expect((await improvementStore.info('Gemini')).queue.pending).toBe(0)
    } finally {
      await app.close()
    }
  })

  it('requires a Home Assistant administrator for retained-history review', async () => {
    const app = await startServer(undefined, undefined, {
      authenticateUser: async () => ({ id: 'ordinary-user', isAdmin: false }),
    })
    try {
      const response = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 102, method: 'tools/call',
        params: { name: 'home_chat_review', arguments: { conversation: { threadId: 'history', turns: [] } } },
      })
      const payload = await response.json() as { error: { message: string } }
      expect(payload.error.message).toContain('administrator')
    } finally {
      await app.close()
    }
  })

  it('lists the curated chat, state, and history tools', async () => {
    const app = await startServer()
    try {
      const response = await rpc(app.baseUrl, { jsonrpc: '2.0', id: 1, method: 'tools/list' })
      const payload = await response.json() as {
        result: { tools: Array<{ name: string; inputSchema?: { properties?: { operations?: { maxItems?: number } } } }> }
      }
      expect(payload.result.tools.map((tool) => tool.name)).toEqual([
        'home_chat', 'home_chat_end', 'home_chat_review', 'home_info', 'home_state', 'home_history', 'home_lights',
      ])
      expect(payload.result.tools.find((tool) => tool.name === 'home_lights')
        ?.inputSchema?.properties?.operations?.maxItems).toBe(HOUSE_LIGHT_ROOMS.length)
    } finally {
      await app.close()
    }
  })

  it('queues completed supported-light chats and reports instrumented server details', async () => {
    const root = await mkdtemp(join(tmpdir(), 'home-mcp-app-'))
    const improvementStore = new ConversationImprovementStore({ root, enabled: true, autoPublish: true })
    const app = await startServer(undefined, undefined, { improvementStore, chatModel: 'Gemini 3.1 Flash Lite' })
    try {
      await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 20, method: 'tools/call',
        params: { name: 'home_chat', arguments: { text: 'Turn on the lights', thread_id: 'thread-one', turn_id: 'turn-one' } },
      })
      const ended = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 21, method: 'tools/call',
        params: { name: 'home_chat_end', arguments: { thread_id: 'thread-one' } },
      })

      const endedPayload = await ended.json() as { result: { structuredContent: { status: string } } }
      expect(endedPayload.result.structuredContent.status).toBe('queued')

      const info = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 22, method: 'tools/call',
        params: { name: 'home_info', arguments: {} },
      })
      const infoPayload = await info.json() as { result: { structuredContent: { chatModel: string; mcpVersion: string; queue: { pending: number; autoPublish: boolean } } } }
      expect(infoPayload.result.structuredContent).toMatchObject({
        chatModel: 'Gemini 3.1 Flash Lite',
        mcpVersion: metadata.serverVersion,
        queue: { pending: 1, autoPublish: true },
      })
    } finally {
      await app.close()
    }
  })

  it('does not turn an answered chat request into an unknown outcome when improvement recording fails', async () => {
    const root = await mkdtemp(join(tmpdir(), 'home-mcp-app-'))
    const improvementStore = new ConversationImprovementStore({ root, enabled: true })
    vi.spyOn(improvementStore, 'beginConversationActivity').mockResolvedValue({
      recordTurn: async () => { throw new Error('disk unavailable') },
      release: () => {},
    })
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const app = await startServer(undefined, (path) => path.includes('/api/states/')
      ? { entity_id: 'light.living_room', state: 'off', attributes: {} }
      : [], { improvementStore })
    try {
      const response = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 112, method: 'tools/call',
        params: { name: 'home_chat', arguments: { text: 'Are the Living Room lights on?', thread_id: 'thread-one', turn_id: 'turn-one' } },
      })
      const payload = await response.json() as { result: { structuredContent: { status: string; text: string } } }
      expect(payload.result.structuredContent).toMatchObject({ status: 'answer', text: 'No, the Living Room lights are off.' })
      expect(consoleError).toHaveBeenCalled()
    } finally {
      consoleError.mockRestore()
      await app.close()
    }
  })

  it('continues chat when improvement activity initialization fails', async () => {
    const root = await mkdtemp(join(tmpdir(), 'home-mcp-app-'))
    const improvementStore = new ConversationImprovementStore({ root, enabled: true })
    vi.spyOn(improvementStore, 'beginConversationActivity').mockRejectedValue(new Error('read-only filesystem'))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const app = await startServer(undefined, (path) => path.includes('/api/states/')
      ? { entity_id: decodeURIComponent(path.split('/').at(-1) ?? ''), state: 'off', attributes: {} }
      : [], { improvementStore })
    try {
      const response = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 130, method: 'tools/call',
        params: { name: 'home_chat', arguments: { text: 'Are the Living Room lights on?', thread_id: 'thread-one' } },
      })
      const payload = await response.json() as { result: { structuredContent: { status: string; text: string } } }
      expect(payload.result.structuredContent).toMatchObject({ status: 'answer', text: 'No, the Living Room lights are off.' })
      expect(consoleError).toHaveBeenCalledWith(
        'Home MCP could not initialize conversation improvement recording:',
        'read-only filesystem',
      )
    } finally {
      consoleError.mockRestore()
      await app.close()
    }
  })

  it('routes chat through HA using the user token and configured agent', async () => {
    const app = await startServer('conversation.household')
    try {
      const response = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 2, method: 'tools/call',
        params: { name: 'home_chat', arguments: { text: 'What is the weather?', conversation_id: 'thread-1' } },
      })
      expect(response.status).toBe(200)
      expect(app.calls).toHaveLength(1)
      expect(app.calls[0].input).toBe('http://ha.test/api/conversation/process')
      expect(new Headers(app.calls[0].init?.headers).get('authorization')).toBe('Bearer test-ha-token')
      expect(JSON.parse(String(app.calls[0].init?.body))).toEqual({
        text: 'What is the weather?', agent_id: 'conversation.household', conversation_id: 'thread-1',
      })
      const payload = await response.json() as { result: { structuredContent: { handled_by_home_mcp?: boolean } } }
      expect(payload.result.structuredContent.handled_by_home_mcp).toBe(false)
    } finally {
      await app.close()
    }
  })

  it('preserves compact light context across unrelated delegated conversation turns', async () => {
    const app = await startServer('conversation.household', () => ({
      conversation_id: 'thread-continued',
      response: { response_type: 'query_answer', speech: { plain: { speech: 'The weather is calm.' } } },
    }))
    try {
      const context = {
        domain: 'lights', roomId: 'living-room',
        entityIds: ['light.living_room_front_left_light'], lightNames: ['Front Left'],
      }
      const response = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 4, method: 'tools/call',
        params: { name: 'home_chat', arguments: { text: 'What is the weather?', conversation_id: 'thread-1', context } },
      })
      const payload = await response.json() as {
        result: { structuredContent: { context: unknown; handled_by_home_mcp?: boolean } }
      }
      expect(payload.result.structuredContent.context).toEqual(context)
      expect(payload.result.structuredContent.handled_by_home_mcp).toBe(false)
      expect(app.calls[0].input).toBe('http://ha.test/api/conversation/process')
    } finally {
      await app.close()
    }
  })

  it('does not reuse an aggregate room-detail affirmative after an unrelated turn', async () => {
    const app = await startServer('conversation.household', () => ({
      conversation_id: 'thread-continued',
      response: { response_type: 'query_answer', speech: { plain: { speech: 'Delegated reply.' } } },
    }))
    try {
      const weather = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 153, method: 'tools/call',
        params: {
          name: 'home_chat',
          arguments: {
            text: 'What is the weather?',
            conversation_id: 'thread-1',
            context: {
              domain: 'lights',
              roomId: null,
              entityIds: [],
              lightNames: [],
              roomIds: ['living-room'],
              roomLightNames: { 'living-room': ['Front Left'] },
              lastAction: 'lights-on',
            },
          },
        },
      })
      const weatherPayload = await weather.json() as {
        result: { structuredContent: { context: Record<string, unknown> } }
      }
      expect(weatherPayload.result.structuredContent.context).not.toHaveProperty('lastAction')

      const affirmative = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 154, method: 'tools/call',
        params: {
          name: 'home_chat',
          arguments: {
            text: 'Yes',
            conversation_id: 'thread-continued',
            context: weatherPayload.result.structuredContent.context,
          },
        },
      })
      const affirmativePayload = await affirmative.json() as {
        result: { structuredContent: { handled_by_home_mcp: boolean } }
      }
      expect(affirmativePayload.result.structuredContent.handled_by_home_mcp).toBe(false)
      expect(app.calls.filter((call) => call.input.endsWith('/api/conversation/process'))).toHaveLength(2)
      expect(app.calls.some((call) => call.input.includes('/api/states/'))).toBe(false)
    } finally {
      await app.close()
    }
  })

  it('does not delegate non-light follow-ups from light controls to the general HA agent', async () => {
    const app = await startServer('conversation.test')
    try {
      const response = await rpc(app.baseUrl, {
        jsonrpc: '2.0',
        id: 44,
        method: 'tools/call',
        params: {
          name: 'home_chat',
          arguments: {
            text: 'Disarm the alarm.',
            control_id: 'malicious-control',
            context: { domain: 'lights', roomId: 'living-room', entityIds: [], lightNames: [], lastAction: 'color' },
          },
        },
      })
      const payload = await response.json() as {
        result: { structuredContent: { status: string; text: string; handled_by_home_mcp?: boolean } }
      }
      expect(payload.result.structuredContent).toMatchObject({
        status: 'unsupported',
        text: 'That follow-up is not a supported light request.',
        handled_by_home_mcp: true,
      })
      expect(app.calls).toHaveLength(0)
    } finally {
      await app.close()
    }
  })

  it('rejects untrusted light context without leaking or widening its targets', async () => {
    const app = await startServer('conversation.test')
    try {
      const response = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 129, method: 'tools/call',
        params: {
          name: 'home_chat',
          arguments: {
            text: 'Turn it off.',
            context: {
              domain: 'lights',
              roomId: 'living-room',
              entityIds: ['switch.garage_door'],
              lightNames: ['password=SecretValue123456789'],
              historyBefore: 'private medical appointment',
            },
          },
        },
      })
      const payload = await response.json() as { result: { structuredContent: { status: string; text: string } } }
      expect(payload.result.structuredContent).toEqual(expect.objectContaining({
        status: 'unsupported',
        text: 'The earlier light context is no longer valid. Name the light or room again.',
      }))
      expect(JSON.stringify(payload)).not.toContain('SecretValue123456789')
      expect(app.calls).toHaveLength(0)
    } finally {
      await app.close()
    }
  })

  it('never actuates modal-negated or permission-question light phrases', async () => {
    const app = await startServer('conversation.household')
    try {
      const negated = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 45, method: 'tools/call',
        params: { name: 'home_chat', arguments: { text: 'Could you not turn on the Living Room lights?' } },
      })
      const question = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 46, method: 'tools/call',
        params: { name: 'home_chat', arguments: { text: 'Should I turn on the Kitchen lights?' } },
      })
      const contracted = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 47, method: 'tools/call',
        params: { name: 'home_chat', arguments: { text: "Shouldn't I turn on the Kitchen lights?" } },
      })
      const permission = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 48, method: 'tools/call',
        params: { name: 'home_chat', arguments: { text: 'Would it be okay if I turn on the Kitchen lights?' } },
      })
      await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 49, method: 'tools/call',
        params: { name: 'home_chat', arguments: { text: 'Please explain how to turn on the Kitchen lights.' } },
      })
      await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 50, method: 'tools/call',
        params: { name: 'home_chat', arguments: { text: 'Turn on the Kitchen lights, not the Living Room lights.' } },
      })
      for (const [index, text] of [
        'Turn on the Kitchen lights without the Sink Light.',
        'Turn on all lights but the Kitchen lights.',
        'Turn off all lights apart from the Kitchen lights.',
        'Tell me how I can turn on the Kitchen lights.',
        'Can you explain how I would dim the Kitchen lights?',
        'I wonder if I should turn off the Kitchen lights.',
        'Tell me how I can enable the Kitchen lights.',
        'Can you explain how I would disable the Kitchen lights?',
        'Please tell me whether I should turn off the Sink Light.',
        'Please tell me whether to turn off the Sink Light.',
        'Please advise whether to turn off the Kitchen lights.',
        'Maybe turn off the Kitchen lights.',
        'I wonder if I should enable the Kitchen lights.',
        "Don't color the Music Room lights red.",
        'I wonder if the Music Room lights should be red.',
        'Turn on the Sink Light in the basement.',
        'Set the Fireplace Light in the basement to 30%.',
        'In the basement, turn on the Sink Light.',
        'Turn off the Sink Light, in the basement.',
        'Set the Fireplace Light (in the basement) to 30%.',
        'Turn off the Sink Light - in the basement.',
        'Turn off the Sink Light. It is in the basement.',
        'Basement, turn off the Sink Light.',
        'Turn on the Sink Light if it gets dark.',
        'Turn on the basement Sink Light.',
        'Turn off the Sink Light and Pantry Light.',
        'Please, how do I turn off the Sink Light?',
        'Please, what if you set the Sink Light to 30%?',
        'Hey, do I need to turn on the Sink Light?',
        'Turn the Kitchen lights on, then the Living Room lights off.',
        'Turn off the Kitchen lights, then turn on the Chandelier Light in the Living Room.',
        'Turn on the Door Light, then turn off the Sink Light in the Kitchen.',
        'Turn off the Couch Light on the Back Deck and the TV Light on the Music Room.',
        'Turn on the lights because the Guest Room Light is dark.',
        'Turn on the Kitchen lights, then turn the Office lights before they switch off.',
        'Turn on the Kitchen lights and then off the Office lights.',
        'Turn off the Kitchen lights and then on the Office lights.',
        'Turn on the Kitchen lights and check whether the Office lights are off.',
        'Turn on the Kitchen lights and then quickly off the Office lights.',
        "Turn the Kitchen lights on and the Office lights aren't off.",
        'Set the Kitchen lights to 20%, are the Office lights on?',
        'Turn off the Kitchen lights and the Office lights will be on.',
        'Turn on the Kitchen lights, the Office lights are off.',
        'Turn the Kitchen lights on, the Office lighting will be off.',
        'Turn off the Sink Light in the Kitchen. Turn off the garage door.',
        'Turn off the Door Light in the Kitchen. Leave the Sink Light in the Kitchen alone.',
        'Turn on the Kitchen lights. Should I turn off the Office lights?',
        'Turn the Kitchen lights on before the Office lights turn off.',
        'Turn on the Kitchen lights before turning off the Office lights.',
        'Turn on the Kitchen lights while the Office lights are going off.',
        'Turn off the Kitchen lights, then set a reminder to turn on the Living Room lights.',
        'Turn on the Kitchen lights, then turn off the fan beside the Office lights.',
      ].entries()) {
        await rpc(app.baseUrl, {
          jsonrpc: '2.0', id: 51 + index, method: 'tools/call',
          params: { name: 'home_chat', arguments: { text } },
        })
      }
      expect((await negated.json() as { result: { structuredContent: { status: string } } }).result.structuredContent.status).toBe('unsupported')
      expect((await question.json() as { result: { structuredContent: unknown } }).result.structuredContent).toBeDefined()
      expect((await contracted.json() as { result: { structuredContent: { status: string } } }).result.structuredContent.status).toBe('unsupported')
      expect((await permission.json() as { result: { structuredContent: unknown } }).result.structuredContent).toBeDefined()
      expect(app.calls.some((call) => call.input.includes('/api/services/'))).toBe(false)
      expect(app.calls.some((call) => call.input.includes('/api/conversation/process'))).toBe(false)
    } finally {
      await app.close()
    }
  })

  it('returns a structured room picker without calling Home Assistant for an ambiguous light request', async () => {
    const app = await startServer()
    try {
      const response = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 5, method: 'tools/call',
        params: { name: 'home_chat', arguments: { text: 'Turn on the lights', conversation_id: null } },
      })
      const payload = await response.json() as { result: { structuredContent: { status: string; text: string; controls: Array<{ kind: string }> } } }
      expect(payload.result.structuredContent).toMatchObject({ status: 'clarify', text: 'Which room?' })
      expect(payload.result.structuredContent.controls[0].kind).toBe('room-picker')
      expect(app.calls).toHaveLength(0)
    } finally {
      await app.close()
    }
  })

  it('seeds custom color controls from current HA state without changing lights', async () => {
    const app = await startServer(undefined, (path) => path.includes('/api/states/')
      ? {
          entity_id: decodeURIComponent(path.split('/').at(-1) ?? ''),
          state: 'on',
          attributes: {
            rgb_color: [12, 34, 56],
            color_temp_kelvin: 4100,
            supported_color_modes: ['rgb', 'color_temp'],
            min_color_temp_kelvin: 2202,
            max_color_temp_kelvin: 6535,
          },
        }
      : [])
    try {
      const response = await rpc(app.baseUrl, { jsonrpc: '2.0', id: 50, method: 'tools/call', params: { name: 'home_chat', arguments: { text: 'Change the Music Room lights' } } })
      const payload = await response.json() as { result: { structuredContent: { controls: Array<Record<string, unknown>> } } }
      expect(payload.result.structuredContent.controls[0]).toMatchObject({
        colorMode: 'rgb',
        currentRgb: [12, 34, 56],
        currentTemperatureKelvin: 4100,
        minTemperatureKelvin: 2202,
        maxTemperatureKelvin: 6535,
      })
      expect(payload.result.structuredContent.controls[0].palette).not.toContain('warm white')
      expect(app.calls.some((call) => call.input.includes('/api/services/'))).toBe(false)
    } finally {
      await app.close()
    }
  })

  it('executes postfix on phrasing instead of asking for a room', async () => {
    const app = await startServer(undefined, (path) => path.includes('/api/states/')
      ? { entity_id: path.split('/').at(-1), state: 'off', attributes: {} }
      : [])
    try {
      const response = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 51, method: 'tools/call',
        params: { name: 'home_chat', arguments: { text: 'Turn the front left living room light on', conversation_id: null } },
      })
      const payload = await response.json() as { result: { structuredContent: { status: string; text: string; controls: unknown[] } } }
      expect(payload.result.structuredContent).toMatchObject({
        status: 'success', text: 'I turned on the Front Left in the Living Room.', controls: [],
      })
      const service = app.calls.find((call) => call.input.endsWith('/api/services/light/turn_on'))
      expect(JSON.parse(String(service?.init?.body))).toEqual({ entity_id: 'light.living_room_front_left_light' })
    } finally {
      await app.close()
    }
  })

  it('executes exact living-room subsets and reports confirmed semantics', async () => {
    const app = await startServer(undefined, (path) => path.includes('/api/states/')
      ? { entity_id: path.split('/').at(-1), state: 'on', attributes: { brightness: 128 } }
      : [])
    try {
      const response = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 6, method: 'tools/call',
        params: { name: 'home_chat', arguments: { text: 'Turn off the front two lights in the living room', conversation_id: 'lights-1' } },
      })
      const payload = await response.json() as { result: { structuredContent: { status: string; text: string } } }
      expect(payload.result.structuredContent).toMatchObject({
        status: 'success',
        text: 'I turned off the Front Left and Front Right in the Living Room.',
      })
      const service = app.calls.find((call) => call.input.endsWith('/api/services/light/turn_off'))
      expect(JSON.parse(String(service?.init?.body))).toEqual({
        entity_id: ['light.living_room_front_left_light', 'light.living_room_front_right_light'],
      })
    } finally {
      await app.close()
    }
  })

  it('keeps every fixture in an unscoped postfix confirmation', async () => {
    const app = await startServer('conversation.household')
    try {
      const response = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 61, method: 'tools/call',
        params: { name: 'home_chat', arguments: { text: 'Turn the Sink Light and Table Light off.' } },
      })
      const payload = await response.json() as { result: { structuredContent: { status: string; controls: Array<{ options: Array<{ message: string }> }> } } }
      expect(payload.result.structuredContent).toMatchObject({
        status: 'clarify',
        controls: [{ options: [{ message: 'Turn off the Sink Light and Table Light in the Kitchen.' }] }],
      })
      expect(app.calls).toHaveLength(0)
    } finally {
      await app.close()
    }
  })

  it('keeps opposite actions separated across then-style compounds', async () => {
    const app = await startServer(undefined, (path) => path.includes('/api/states/')
      ? { entity_id: path.split('/').at(-1), state: 'off', attributes: {} }
      : [])
    try {
      const response = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 63, method: 'tools/call',
        params: {
          name: 'home_chat',
          arguments: { text: 'Turn on the Sink Light in the Kitchen and then turn off the Table Light in the Kitchen.' },
        },
      })
      const payload = await response.json() as { result: { structuredContent: { status: string } } }
      expect(payload.result.structuredContent.status).toBe('success')
      const services = app.calls.filter((call) => call.input.includes('/api/services/light/'))
        .map((call) => ({
          path: call.input,
          body: JSON.parse(String(call.init?.body)) as { entity_id: string },
        }))
      expect(services).toEqual([
        expect.objectContaining({
          path: expect.stringContaining('/api/services/light/turn_on'),
          body: { entity_id: 'light.kitchen_sink_light' },
        }),
        expect.objectContaining({
          path: expect.stringContaining('/api/services/light/turn_off'),
          body: { entity_id: 'light.kitchen_table_light' },
        }),
      ])

      app.calls.splice(0)
      await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 67, method: 'tools/call',
        params: {
          name: 'home_chat',
          arguments: { text: 'Turn the Sink Light in the Kitchen on and the Door Light in the Master Bedroom off.' },
        },
      })
      const scopedServices = app.calls.filter((call) => call.input.includes('/api/services/light/'))
        .map((call) => ({
          path: call.input,
          body: JSON.parse(String(call.init?.body)) as { entity_id: string },
        }))
      expect(scopedServices).toEqual([
        expect.objectContaining({
          path: expect.stringContaining('/api/services/light/turn_on'),
          body: { entity_id: 'light.kitchen_sink_light' },
        }),
        expect.objectContaining({
          path: expect.stringContaining('/api/services/light/turn_off'),
          body: { entity_id: 'light.master_bedroom_door_light' },
        }),
      ])

      app.calls.splice(0)
      await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 69, method: 'tools/call',
        params: {
          name: 'home_chat',
          arguments: { text: 'Turn on the Kitchen lights, then turn off the Living Room lights because the Office lights turned off.' },
        },
      })
      const causalTargets = app.calls.filter((call) => call.input.includes('/api/services/light/'))
        .map((call) => JSON.parse(String(call.init?.body)) as { entity_id: string })
      expect(causalTargets).toEqual([
        { entity_id: 'light.kitchen' },
        { entity_id: 'light.living_room' },
      ])

      app.calls.splice(0)
      const mixed = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 70, method: 'tools/call',
        params: {
          name: 'home_chat',
          arguments: { text: 'Turn off the Kitchen lights and turn the Music Room lights blue.' },
        },
      })
      const mixedPayload = await mixed.json() as {
        result: { structuredContent: { context: Record<string, unknown> } }
      }
      expect(mixedPayload.result.structuredContent.context).toMatchObject({
        roomId: 'music-room',
        lastAction: 'color',
      })
      expect(mixedPayload.result.structuredContent.context).not.toHaveProperty('lastState')
    } finally {
      await app.close()
    }
  })

  it('keeps compound pronouns scoped to the preceding fixture', async () => {
    const app = await startServer(undefined, (path) => path.includes('/api/states/')
      ? { entity_id: path.split('/').at(-1), state: 'on', attributes: { brightness: 51 } }
      : [])
    try {
      const response = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 64, method: 'tools/call',
        params: {
          name: 'home_chat',
          arguments: { text: 'Turn the Sink Light in the Kitchen to 20%, then turn it up by 10%.' },
        },
      })
      const payload = await response.json() as { result: { structuredContent: { status: string } } }
      expect(payload.result.structuredContent.status).toBe('success')
      const services = app.calls.filter((call) => call.input.endsWith('/api/services/light/turn_on'))
        .map((call) => JSON.parse(String(call.init?.body)) as { entity_id: string; brightness_pct: number })
      expect(services).toEqual([
        { entity_id: 'light.kitchen_sink_light', brightness_pct: 20 },
        { entity_id: 'light.kitchen_sink_light', brightness_pct: 30 },
      ])

      app.calls.splice(0)
      await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 66, method: 'tools/call',
        params: {
          name: 'home_chat',
          arguments: { text: 'Turn on the Sink Light in the Kitchen, then turn that one off.' },
        },
      })
      const targets = app.calls.filter((call) => call.input.includes('/api/services/light/'))
        .map((call) => JSON.parse(String(call.init?.body)) as { entity_id: string })
      expect(targets).toEqual([
        { entity_id: 'light.kitchen_sink_light' },
        { entity_id: 'light.kitchen_sink_light' },
      ])
    } finally {
      await app.close()
    }
  })

  it('rejects incomplete compound actions without calling Home Assistant', async () => {
    const app = await startServer('conversation.household')
    try {
      const response = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 62, method: 'tools/call',
        params: { name: 'home_chat', arguments: { text: 'Turn off the Kitchen lights and set the Living Room lights.' } },
      })
      const payload = await response.json() as { result: { structuredContent: { status: string } } }
      expect(payload.result.structuredContent.status).toBe('unsupported')
      expect(app.calls).toHaveLength(0)
    } finally {
      await app.close()
    }
  })

  it('rejects unresolved punctuation-separated actions without calling Home Assistant', async () => {
    const app = await startServer('conversation.household')
    try {
      const response = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 65, method: 'tools/call',
        params: {
          name: 'home_chat',
          arguments: { text: 'Turn off the Front Left in the Kitchen, turn on the Sink Light in the Kitchen.' },
        },
      })
      const payload = await response.json() as { result: { structuredContent: { status: string } } }
      expect(payload.result.structuredContent.status).toBe('unsupported')
      expect(app.calls).toHaveLength(0)
    } finally {
      await app.close()
    }
  })

  it('computes relative brightness from current state with a ten-point clamp', async () => {
    const app = await startServer(undefined, (path) => path.includes('/api/states/')
      ? { entity_id: decodeURIComponent(path.split('/').at(-1) ?? ''), state: 'on', attributes: { brightness: 230 } }
      : [])
    try {
      const response = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 7, method: 'tools/call',
        params: { name: 'home_lights', arguments: { action: 'up', room: 'Living Room' } },
      })

      const payload = await response.json() as { result: { structuredContent: { text: string } } }
      expect(payload.result.structuredContent.text).toContain('up to 100%')
      const services = app.calls.filter((call) => call.input.endsWith('/api/services/light/turn_on'))
        .map((call) => JSON.parse(String(call.init?.body)) as { entity_id: string; brightness_pct: number })
      expect(services).toHaveLength(4)
      expect(services.every((service) => service.brightness_pct === 100)).toBe(true)
      expect(services.map((service) => service.entity_id)).toEqual([
        'light.living_room_front_left_light',
        'light.living_room_front_right_light',
        'light.living_room_back_left_light',
        'light.living_room_back_right_light',
      ])
    } finally {
      await app.close()
    }
  })

  it('applies relative brightness independently to each selected light', async () => {
    const app = await startServer(undefined, (path) => {
      if (!path.includes('/api/states/')) return []
      const entityId = decodeURIComponent(path.split('/').at(-1) ?? '')
      return {
        entity_id: entityId,
        state: 'on',
        attributes: { brightness: entityId.includes('front_left') ? 51 : 204 },
      }
    })
    try {
      const response = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 71, method: 'tools/call',
        params: {
          name: 'home_lights',
          arguments: {
            action: 'up',
            room: 'Living Room',
            light_names: ['Front Left', 'Back Right'],
          },
        },
      })
      const brighten = app.calls.filter((call) => call.input.endsWith('/api/services/light/turn_on'))
        .map((call) => JSON.parse(String(call.init?.body)) as { entity_id: string; brightness_pct: number })
      expect(brighten).toEqual([
        { entity_id: 'light.living_room_front_left_light', brightness_pct: 30 },
        { entity_id: 'light.living_room_back_right_light', brightness_pct: 90 },
      ])
      const payload = await response.json() as { result: { structuredContent: { text: string; controls: unknown[] } } }
      expect(payload.result.structuredContent.text).toBe(
        'I turned the Front Left up to 30%, and Back Right up to 90%. You can ask me to set specific brightness and I can set them there as well.',
      )
      expect(payload.result.structuredContent.controls).toEqual([])

      app.calls.splice(0)
      await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 72, method: 'tools/call',
        params: {
          name: 'home_chat',
          arguments: { text: 'Dim the Front Left and Back Right lights in the Living Room by 50%.' },
        },
      })
      const dim = app.calls.filter((call) => call.input.endsWith('/api/services/light/turn_on'))
        .map((call) => JSON.parse(String(call.init?.body)) as { entity_id: string; brightness_pct: number })
      expect(dim).toEqual([
        { entity_id: 'light.living_room_front_left_light', brightness_pct: 0 },
        { entity_id: 'light.living_room_back_right_light', brightness_pct: 30 },
      ])
    } finally {
      await app.close()
    }
  })

  it('keeps new dashboard threads in independent Home Assistant conversation contexts', async () => {
    const app = await startServer()
    try {
      const first = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 103, method: 'tools/call',
        params: { name: 'home_chat', arguments: { text: 'Are the Living Room lights on?', thread_id: 'thread-one', turn_id: 'turn-one' } },
      })
      const second = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 104, method: 'tools/call',
        params: { name: 'home_chat', arguments: { text: 'Are the Living Room lights on?', thread_id: 'thread-two', turn_id: 'turn-two' } },
      })
      const firstPayload = await first.json() as { result: { structuredContent: { conversation_id: string } } }
      const secondPayload = await second.json() as { result: { structuredContent: { conversation_id: string } } }
      expect(firstPayload.result.structuredContent.conversation_id).toBe('home-mcp-lights:thread-one')
      expect(secondPayload.result.structuredContent.conversation_id).toBe('home-mcp-lights:thread-two')
    } finally {
      await app.close()
    }
  })

  it('routes Entryway operations through the switch domain and rejects brightness', async () => {
    const app = await startServer(undefined, (path) => path.includes('/api/states/')
      ? { entity_id: 'switch.upper_entryway_light_switch_top', state: 'off', attributes: {} }
      : [])
    try {
      await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 8, method: 'tools/call',
        params: { name: 'home_lights', arguments: { action: 'on', room: 'Entryway' } },
      })

      expect(app.calls.some((call) => call.input.endsWith('/api/services/switch/turn_on'))).toBe(true)
      const before = app.calls.length
      const response = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 9, method: 'tools/call',
        params: { name: 'home_lights', arguments: { action: 'set', room: 'Entryway', brightness_pct: 30 } },
      })
      const payload = await response.json() as { result: { structuredContent: { status: string } } }
      expect(payload.result.structuredContent.status).toBe('unsupported')
      expect(app.calls).toHaveLength(before)
    } finally {
      await app.close()
    }
  })

  it('rejects unconfigured targets and oversized operation arrays before HA access', async () => {
    const app = await startServer()
    try {
      const target = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 110, method: 'tools/call',
        params: { name: 'home_lights', arguments: { action: 'on', room: 'Living Room', entity_ids: ['switch.garage_door'] } },
      })
      const targetPayload = await target.json() as { result: { structuredContent: { status: string } } }
      expect(targetPayload.result.structuredContent.status).toBe('unsupported')

      const operations = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 111, method: 'tools/call',
        params: {
          name: 'home_lights',
          arguments: { operations: Array.from({ length: 13 }, () => ({ action: 'on', room: 'Living Room' })) },
        },
      })
      const operationsPayload = await operations.json() as { result: { structuredContent: { status: string } } }
      expect(operationsPayload.result.structuredContent.status).toBe('failed')
      const partialAggregate = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 112, method: 'tools/call',
        params: { name: 'home_lights', arguments: { operations: [{ action: 'lights-on', room: 'Living Room' }] } },
      })
      const partialPayload = await partialAggregate.json() as { result: { structuredContent: { status: string } } }
      expect(partialPayload.result.structuredContent.status).toBe('failed')
      const conflicting = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 113, method: 'tools/call',
        params: {
          name: 'home_lights',
          arguments: {
            action: 'lights-on',
            operations: [{ action: 'off', room: 'Kitchen' }],
          },
        },
      })
      const conflictingPayload = await conflicting.json() as { result: { structuredContent: { status: string } } }
      expect(conflictingPayload.result.structuredContent.status).toBe('failed')
      const misspelled = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 114, method: 'tools/call',
        params: {
          name: 'home_lights',
          arguments: { action: 'off', room: 'Living Room', fixture_names: ['Front Left'] },
        },
      })
      const misspelledPayload = await misspelled.json() as { result: { structuredContent: { status: string; text: string } } }
      expect(misspelledPayload.result.structuredContent).toMatchObject({
        status: 'failed',
        text: expect.stringContaining('fixture_names'),
      })
      expect(app.calls).toHaveLength(0)
    } finally {
      await app.close()
    }
  })

  it('sends concrete RGB and Kelvin payloads to Home Assistant', async () => {
    const app = await startServer(undefined, (path) => {
      if (!path.includes('/api/states/')) return []
      const entityId = decodeURIComponent(path.split('/').at(-1) ?? '')
      return {
        entity_id: entityId,
        state: 'on',
        attributes: entityId.includes('music_room')
          ? { supported_color_modes: ['rgb', 'color_temp'], min_color_temp_kelvin: 2000, max_color_temp_kelvin: 6500 }
          : { supported_color_modes: ['color_temp'], min_color_temp_kelvin: 2202, max_color_temp_kelvin: 6535 },
      }
    })
    try {
      await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 10, method: 'tools/call',
        params: { name: 'home_lights', arguments: { action: 'color', room: 'Music Room', color_name: 'purple' } },
      })
      await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 11, method: 'tools/call',
        params: { name: 'home_lights', arguments: { action: 'color', room: 'Living Room', color_name: 'white' } },
      })
      const serviceBodies = app.calls.filter((call) => call.input.endsWith('/api/services/light/turn_on'))
        .map((call) => JSON.parse(String(call.init?.body)) as Record<string, unknown>)
      expect(serviceBodies).toEqual(expect.arrayContaining([
        expect.objectContaining({ entity_id: 'light.music_room', rgb_color: [145, 65, 255] }),
        expect.objectContaining({ entity_id: 'light.living_room', color_temp_kelvin: 3000 }),
      ]))
      expect(serviceBodies.every((body) => !('color_name' in body))).toBe(true)
    } finally {
      await app.close()
    }
  })

  it('enforces live color modes and Kelvin bounds before calling Home Assistant', async () => {
    const app = await startServer(undefined, (path) => path.includes('/api/states/')
      ? {
          entity_id: decodeURIComponent(path.split('/').at(-1) ?? ''),
          state: 'on',
          attributes: { supported_color_modes: ['color_temp'], min_color_temp_kelvin: 3000, max_color_temp_kelvin: 6000 },
        }
      : [])
    try {
      const response = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 115, method: 'tools/call',
        params: { name: 'home_lights', arguments: { action: 'color', room: 'Garage', color_temperature_kelvin: 2500 } },
      })
      const payload = await response.json() as { result: { structuredContent: { status: string } } }
      expect(payload.result.structuredContent.status).toBe('failed')
      expect(app.calls.some((call) => call.input.includes('/api/services/'))).toBe(false)
    } finally {
      await app.close()
    }
  })

  it('preserves respectively ordered brightness when an earlier target is unavailable', async () => {
    const app = await startServer(undefined, (path) => path.includes('back_right')
      ? { entity_id: 'light.living_room_back_right_light', state: 'unavailable', attributes: {} }
      : path.includes('/api/states/')
        ? { entity_id: 'light.living_room_front_left_light', state: 'on', attributes: { brightness: 128 } }
        : [])
    try {
      const response = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 12, method: 'tools/call', params: { name: 'home_lights', arguments: {
          action: 'set', room: 'Living Room',
          light_names: ['Back Right', 'Front Left'], brightness_pct: [18, 33],
        } },
      })
      const payload = await response.json() as { result: { structuredContent: { status: string; text: string } } }
      expect(payload.result.structuredContent).toMatchObject({
        status: 'partial',
        text: 'Some requested light changes completed, but others did not. Would you like me to try again?',
      })
      const service = app.calls.find((call) => call.input.endsWith('/api/services/light/turn_on'))
      expect(JSON.parse(String(service?.init?.body))).toMatchObject({
        entity_id: 'light.living_room_front_left_light', brightness_pct: 33,
      })
      expect(payload.result.structuredContent.controls[0].options[0].message).toBe('Turn the Back Right in the Living Room to 18%.')
    } finally {
      await app.close()
    }
  })

  it('keeps respectively ordered names in successful confirmations', async () => {
    const app = await startServer(undefined, (path) => path.includes('/api/states/')
      ? { entity_id: decodeURIComponent(path.split('/').at(-1) ?? ''), state: 'on', attributes: { brightness: 128 } }
      : [])
    try {
      const response = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 13, method: 'tools/call', params: { name: 'home_lights', arguments: {
          action: 'set', room: 'Living Room',
          light_names: ['Back Right', 'Front Left'], brightness_pct: [18, 33],
        } },
      })
      const payload = await response.json() as { result: { structuredContent: { text: string } } }
      expect(payload.result.structuredContent.text).toBe('I turned the Back Right to 18%, and Front Left to 33%.')
    } finally {
      await app.close()
    }
  })

  it('answers count, list, brightness, color, and multi-room reads without services', async () => {
    const app = await startServer(undefined, (path) => {
      if (!path.includes('/api/states/')) return []
      const entityId = decodeURIComponent(path.split('/').at(-1) ?? '')
      const on = entityId.includes('front_left') || entityId.includes('hallway')
      return { entity_id: entityId, state: on ? 'on' : 'off', attributes: on ? { brightness: 128, rgb_color: [255, 100, 20] } : {} }
    })
    try {
      const ask = async (id: number, text: string, context?: Record<string, unknown>) => {
        const response = await rpc(app.baseUrl, { jsonrpc: '2.0', id, method: 'tools/call', params: { name: 'home_chat', arguments: { text, ...(context ? { context } : {}) } } })
        return (await response.json() as { result: { structuredContent: { text: string; context: Record<string, unknown> } } }).result.structuredContent
      }
      const count = await ask(60, 'How many lights are on in the Living Room?')
      expect(count.text).toContain('1 of 4')
      const list = await ask(61, 'Which ones?', count.context)
      expect(list.text).toContain('Front Left is on')
      const brightness = await ask(62, "What's their brightness?", list.context)
      expect(brightness.text).toContain('Front Left is at 50%')
      const color = await ask(63, 'What color are the Living Room lights?')
      expect(color.text).toContain('Front Left is rgb(255, 100, 20)')
      const multi = await ask(64, 'Are the Hallway or Guest Bathroom lights on?')
      expect(multi.text).toContain('Hallway')
      expect(multi.text).toContain('Guest Bathroom')
      expect(app.calls.some((call) => call.input.includes('/api/services/'))).toBe(false)
    } finally {
      await app.close()
    }
  })

  it('keeps exact fixture subjects in count and color-state answers', async () => {
    const app = await startServer(undefined, (path) => {
      if (!path.includes('/api/states/')) return []
      const entityId = decodeURIComponent(path.split('/').at(-1) ?? '')
      return {
        entity_id: entityId,
        state: entityId === 'light.kitchen_door_light' || entityId === 'light.kitchen_table_light' ? 'on' : 'off',
        attributes: entityId === 'light.kitchen_door_light' ? { color_temp_kelvin: 3000 } : {},
      }
    })
    try {
      const count = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 164, method: 'tools/call',
        params: {
          name: 'home_lights',
          arguments: {
            action: 'count',
            room: 'Kitchen',
            light_names: ['Door Light', 'Sink Light'],
          },
        },
      })
      const countPayload = await count.json() as { result: { structuredContent: { text: string } } }
      expect(countPayload.result.structuredContent.text).toBe('1 of 2 selected Kitchen lights is on.')

      const color = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 165, method: 'tools/call',
        params: {
          name: 'home_lights',
          arguments: {
            action: 'color-state',
            room: 'Kitchen',
            light_names: ['Sink Light'],
          },
        },
      })
      const colorPayload = await color.json() as { result: { structuredContent: { text: string } } }
      expect(colorPayload.result.structuredContent.text).toBe('The Sink Light in the Kitchen is off.')
      expect(app.calls.some((call) => call.input.includes('/api/services/'))).toBe(false)
    } finally {
      await app.close()
    }
  })

  it('lists only configured lights for a whole-home on query', async () => {
    const app = await startServer(undefined, (path) => {
      if (!path.includes('/api/states/')) return []
      const entityId = decodeURIComponent(path.split('/').at(-1) ?? '')
      const on = entityId === 'light.living_room_front_left_light' || entityId === 'light.kitchen_sink_light'
      return { entity_id: entityId, state: on ? 'on' : 'off', attributes: {} }
    })

    try {
      const response = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 120, method: 'tools/call',
        params: { name: 'home_chat', arguments: { text: 'What lights are on?' } },
      })
      const payload = await response.json() as {
        result: { structuredContent: { status: string; text: string; context: { lastAction?: string; roomIds?: string[]; roomLightNames?: Record<string, string[]> }; handled_by_home_mcp?: boolean } }
      }
      expect(payload.result.structuredContent).toMatchObject({
        status: 'answer',
        text: 'These rooms have lights on:\n• Living Room\n• Kitchen\n\nWould you like to know more about a particular room?',
        context: {
          lastAction: 'lights-on',
          roomIds: ['living-room', 'kitchen'],
        },
        handled_by_home_mcp: true,
      })
      expect(payload.result.structuredContent.text).not.toMatch(/Christmas|transit|Line/)
      const directResponse = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 121, method: 'tools/call',
        params: {
          name: 'home_lights',
          arguments: { action: 'lights-on' },
        },
      })
      const directPayload = await directResponse.json() as {
        result: { structuredContent: { status: string; text: string; context: { lastAction?: string; roomIds?: string[]; roomLightNames?: Record<string, string[]> } } }
      }
      expect(directPayload.result.structuredContent).toMatchObject({
        status: 'answer',
        text: 'These rooms have lights on:\n• Living Room\n• Kitchen\n\nWould you like to know more about a particular room?',
        context: {
          lastAction: 'lights-on',
          roomIds: ['living-room', 'kitchen'],
        },
      })
      expect(app.calls.some((call) => call.input.includes('/api/services/'))).toBe(false)
    } finally {
      await app.close()
    }
  })

  it('uses singular room copy when only one room has lights on', async () => {
    const app = await startServer(undefined, (path) => {
      if (!path.includes('/api/states/')) return []
      const entityId = decodeURIComponent(path.split('/').at(-1) ?? '')
      return {
        entity_id: entityId,
        state: entityId === 'light.living_room_front_left_light' ? 'on' : 'off',
        attributes: {},
      }
    })
    try {
      const response = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 136, method: 'tools/call',
        params: { name: 'home_chat', arguments: { text: 'What lights are on?' } },
      })
      const payload = await response.json() as {
        result: { structuredContent: { text: string; context: Record<string, unknown> } }
      }
      expect(payload.result.structuredContent).toMatchObject({
        text: 'The Living Room lights are on.\n\nWould you like to know more about the Living Room?',
        context: {
          roomIds: ['living-room'],
          lastAction: 'lights-on',
        },
      })
    } finally {
      await app.close()
    }
  })

  it('keeps a room-specific lights-on question scoped to the fixtures it lists', async () => {
    const app = await startServer(undefined, (path) => {
      if (!path.includes('/api/states/')) return []
      const entityId = decodeURIComponent(path.split('/').at(-1) ?? '')
      return {
        entity_id: entityId,
        state: entityId === 'light.kitchen_sink_light' ? 'on' : 'off',
        attributes: {},
      }
    })
    try {
      const overview = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 159, method: 'tools/call',
        params: { name: 'home_chat', arguments: { text: 'What lights are on?' } },
      })
      const overviewPayload = await overview.json() as {
        result: { structuredContent: { context: Record<string, unknown> } }
      }
      const detail = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 160, method: 'tools/call',
        params: {
          name: 'home_chat',
          arguments: {
            text: 'Which Kitchen lights are on?',
            context: overviewPayload.result.structuredContent.context,
          },
        },
      })
      const detailPayload = await detail.json() as {
        result: { structuredContent: { context: Record<string, unknown> } }
      }
      expect(detailPayload.result.structuredContent.context).toMatchObject({
        roomId: null,
        roomIds: ['kitchen'],
        roomLightNames: { kitchen: ['Sink Light'] },
        lastAction: 'list',
        lastState: 'on',
      })

      app.calls.splice(0)
      await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 161, method: 'tools/call',
        params: {
          name: 'home_chat',
          arguments: {
            text: 'Turn them off.',
            context: detailPayload.result.structuredContent.context,
          },
        },
      })
      expect(app.calls.filter((call) => call.input.endsWith('/api/services/light/turn_off'))
        .map((call) => JSON.parse(String(call.init?.body)))).toEqual([
        { entity_id: 'light.kitchen_sink_light' },
      ])
    } finally {
      await app.close()
    }
  })

  it('keeps an unreadable room list non-actionable', async () => {
    const app = await startServer(undefined, (path) => {
      if (path.includes('/api/states/')) throw new Error('state unavailable')
      return []
    })
    try {
      const detail = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 162, method: 'tools/call',
        params: {
          name: 'home_chat',
          arguments: {
            text: 'Which Kitchen lights are on?',
            context: {
              domain: 'lights',
              roomId: null,
              entityIds: [],
              lightNames: [],
              roomIds: ['kitchen'],
              lastAction: 'lights-on',
            },
          },
        },
      })
      const detailPayload = await detail.json() as {
        result: { structuredContent: { context: Record<string, unknown> } }
      }
      expect(detailPayload.result.structuredContent.context).toMatchObject({
        roomId: null,
        roomIds: ['kitchen'],
        lastAction: 'list',
        lastState: 'unavailable',
      })
      expect(detailPayload.result.structuredContent.context).not.toHaveProperty('roomLightNames')

      const followUp = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 163, method: 'tools/call',
        params: {
          name: 'home_chat',
          arguments: {
            text: 'Turn them off.',
            context: detailPayload.result.structuredContent.context,
          },
        },
      })
      const followUpPayload = await followUp.json() as { result: { structuredContent: { status: string } } }
      expect(followUpPayload.result.structuredContent.status).toBe('unsupported')
      expect(app.calls.some((call) => call.input.includes('/api/services/'))).toBe(false)
    } finally {
      await app.close()
    }
  })

  it('qualifies rooms-on results when unreadable fixtures prevent a definitive room answer', async () => {
    const app = await startServer(undefined, (path) => {
      if (!path.includes('/api/states/')) return []
      const entityId = decodeURIComponent(path.split('/').at(-1) ?? '')
      if (entityId === 'light.kitchen_sink_light') {
        return { entity_id: entityId, state: 'on', attributes: {} }
      }
      if (entityId === 'light.living_room_front_right_light') {
        return { entity_id: entityId, state: 'unknown', attributes: {} }
      }
      return { entity_id: entityId, state: 'off', attributes: {} }
    })
    try {
      const response = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 122, method: 'tools/call',
        params: { name: 'home_chat', arguments: { text: 'Which rooms have lights on?' } },
      })
      const payload = await response.json() as {
        result: { structuredContent: { status: string; text: string; data: { rooms: string[]; uncertainRooms: string[] } } }
      }
      expect(payload.result.structuredContent).toMatchObject({
        status: 'answer',
        text: 'The Kitchen lights are on.\n\nLiving Room could not be fully checked because some light states could not be read.\n\nWould you like to know more about the Kitchen?',
        context: {
          roomIds: ['kitchen'],
          lastAction: 'rooms-on',
        },
        data: { uncertainRooms: ['Living Room'] },
      })
      expect(app.calls.some((call) => call.input.includes('/api/services/'))).toBe(false)
    } finally {
      await app.close()
    }
  })

  it('continues a whole-home overview into one or more room details and exact fixture actions', async () => {
    const app = await startServer(undefined, (path) => {
      if (!path.includes('/api/states/')) return []
      const entityId = decodeURIComponent(path.split('/').at(-1) ?? '')
      const on = [
        'light.living_room_front_left_light',
        'light.living_room_back_right_light',
        'light.kitchen_sink_light',
      ].includes(entityId)
      return { entity_id: entityId, state: on ? 'on' : 'off', attributes: { brightness: 128 } }
    })
    try {
      const overview = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 132, method: 'tools/call',
        params: { name: 'home_chat', arguments: { text: 'What lights are on?' } },
      })
      const overviewPayload = await overview.json() as {
        result: { structuredContent: { context: Record<string, unknown> } }
      }
      const detail = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 133, method: 'tools/call',
        params: {
          name: 'home_chat',
          arguments: {
            text: 'Living Room and Kitchen',
            context: overviewPayload.result.structuredContent.context,
          },
        },
      })
      const detailPayload = await detail.json() as {
        result: { structuredContent: { status: string; text: string; context: Record<string, unknown> } }
      }
      expect(detailPayload.result.structuredContent).toMatchObject({
        status: 'answer',
        text: 'These lights are on in the Living Room:\n• Front Left\n• Back Right\n\nAnd these lights are on in the Kitchen:\n• Sink Light\n\nI can tell you when these lights last turned on, change their color, turn them off, or tell you why they are on. What would you like to do next?',
        context: {
          roomId: null,
          roomIds: ['living-room', 'kitchen'],
          roomLightNames: {
            'living-room': ['Front Left', 'Back Right'],
            kitchen: ['Sink Light'],
          },
          lastAction: 'list',
        },
      })

      const color = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 134, method: 'tools/call',
        params: {
          name: 'home_chat',
          arguments: {
            text: 'Change their color.',
            context: detailPayload.result.structuredContent.context,
          },
        },
      })
      const colorPayload = await color.json() as {
        result: { structuredContent: { status: string; controls: Array<{ kind: string; options?: Array<{ label: string; message: string }> }> } }
      }
      expect(colorPayload.result.structuredContent).toMatchObject({
        status: 'clarify',
        controls: [expect.objectContaining({
          kind: 'room-picker',
          options: [
            expect.objectContaining({ label: 'Living Room', message: 'Change the color of the Front Left and Back Right in the Living Room.' }),
            expect.objectContaining({ label: 'Kitchen', message: 'Change the color of the Sink Light in the Kitchen.' }),
          ],
        })],
      })

      app.calls.splice(0)
      const off = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 135, method: 'tools/call',
        params: {
          name: 'home_chat',
          arguments: {
            text: 'Turn them off.',
            context: detailPayload.result.structuredContent.context,
          },
        },
      })
      const offPayload = await off.json() as {
        result: { structuredContent: { status: string; context: Record<string, unknown> } }
      }
      expect(offPayload.result.structuredContent).toMatchObject({
        status: 'success',
        context: {
          roomIds: ['living-room', 'kitchen'],
          roomLightNames: {
            'living-room': ['Front Left', 'Back Right'],
            kitchen: ['Sink Light'],
          },
          lastAction: 'off',
          lastState: 'off',
        },
      })
      const services = app.calls.filter((call) => call.input.endsWith('/api/services/light/turn_off'))
        .map((call) => JSON.parse(String(call.init?.body)) as { entity_id: string | string[] })
      expect(services).toEqual([
        { entity_id: ['light.living_room_front_left_light', 'light.living_room_back_right_light'] },
        { entity_id: 'light.kitchen_sink_light' },
      ])

      app.calls.splice(0)
      const on = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 137, method: 'tools/call',
        params: {
          name: 'home_chat',
          arguments: {
            text: 'Turn them on.',
            context: offPayload.result.structuredContent.context,
          },
        },
      })
      const onPayload = await on.json() as {
        result: { structuredContent: { status: string; context: Record<string, unknown> } }
      }
      expect(onPayload.result.structuredContent).toMatchObject({
        status: 'success',
        context: { lastAction: 'on', lastState: 'on' },
      })
      expect(onPayload.result.structuredContent.context).not.toHaveProperty('targetState')
      expect(app.calls.filter((call) => call.input.endsWith('/api/services/light/turn_on'))
        .map((call) => JSON.parse(String(call.init?.body)) as { entity_id: string | string[] })).toEqual([
        { entity_id: ['light.living_room_front_left_light', 'light.living_room_back_right_light'] },
        { entity_id: 'light.kitchen_sink_light' },
      ])
    } finally {
      await app.close()
    }
  })

  it('clears aggregate state after only part of an exact multi-room toggle succeeds', async () => {
    const app = await startServer(undefined, (path, init) => {
      if (path.includes('/api/states/')) {
        return { entity_id: decodeURIComponent(path.split('/').at(-1) ?? ''), state: 'on', attributes: {} }
      }
      if (path.endsWith('/api/services/light/turn_off')
        && String(init?.body).includes('light.kitchen_sink_light')) throw new Error('simulated service failure')
      return []
    })
    try {
      const response = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 141, method: 'tools/call',
        params: {
          name: 'home_chat',
          arguments: {
            text: 'Turn them off.',
            context: {
              domain: 'lights',
              roomId: null,
              entityIds: [],
              lightNames: [],
              roomIds: ['living-room', 'kitchen'],
              roomLightNames: {
                'living-room': ['Front Left'],
                kitchen: ['Sink Light'],
              },
              lastAction: 'list',
              lastState: 'on',
            },
          },
        },
      })
      const payload = await response.json() as {
        result: { structuredContent: { status: string; context: Record<string, unknown> } }
      }
      expect(payload.result.structuredContent.status).toBe('partial')
      expect(payload.result.structuredContent.context).toMatchObject({
        lastAction: 'off',
        roomIds: ['living-room', 'kitchen'],
      })
      expect(payload.result.structuredContent.context).not.toHaveProperty('lastState')
    } finally {
      await app.close()
    }
  })

  it('warns when a room detail list is incomplete', async () => {
    const app = await startServer(undefined, (path) => {
      if (!path.includes('/api/states/')) return []
      const entityId = decodeURIComponent(path.split('/').at(-1) ?? '')
      if (entityId === 'light.living_room_front_left_light') {
        return { entity_id: entityId, state: 'on', attributes: {} }
      }
      if (entityId === 'light.living_room_front_right_light') {
        return { entity_id: entityId, state: 'unknown', attributes: {} }
      }
      return { entity_id: entityId, state: 'off', attributes: {} }
    })
    try {
      const response = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 138, method: 'tools/call',
        params: {
          name: 'home_chat',
          arguments: {
            text: 'Living Room',
            context: {
              domain: 'lights',
              roomId: null,
              entityIds: [],
              lightNames: [],
              roomIds: ['living-room'],
              lastAction: 'lights-on',
            },
          },
        },
      })
      const payload = await response.json() as {
        result: { structuredContent: { text: string; context: Record<string, unknown> } }
      }
      expect(payload.result.structuredContent.text).toContain(
        'I could not read 1 other light in the Living Room. This list may be incomplete.',
      )
      expect(payload.result.structuredContent.context).toMatchObject({
        roomId: null,
        roomIds: ['living-room'],
        roomLightNames: { 'living-room': ['Front Left'] },
        lastState: 'on',
      })
      const reason = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 158, method: 'tools/call',
        params: {
          name: 'home_chat',
          arguments: { text: 'Why?', context: payload.result.structuredContent.context },
        },
      })
      const reasonPayload = await reason.json() as { result: { structuredContent: { status: string } } }
      expect(reasonPayload.result.structuredContent.status).toBe('answer')
      expect(app.calls.some((call) =>
        call.input.includes('/api/history/period/') && call.input.includes('light.living_room_front_left_light'))).toBe(true)
    } finally {
      await app.close()
    }
  })

  it('retains the queried room scope when selected rooms no longer have lights on', async () => {
    const app = await startServer(undefined, (path) => path.includes('/api/states/')
      ? { entity_id: decodeURIComponent(path.split('/').at(-1) ?? ''), state: 'off', attributes: {} }
      : [])
    try {
      const detail = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 139, method: 'tools/call',
        params: {
          name: 'home_chat',
          arguments: {
            text: 'Living Room and Kitchen',
            context: {
              domain: 'lights',
              roomId: null,
              entityIds: [],
              lightNames: [],
              roomIds: ['living-room', 'kitchen'],
              roomLightNames: {
                'living-room': ['Front Left'],
                kitchen: ['Sink Light'],
              },
              lastAction: 'lights-on',
            },
          },
        },
      })
      const detailPayload = await detail.json() as {
        result: { structuredContent: { context: Record<string, unknown> } }
      }
      expect(detailPayload.result.structuredContent.context).toMatchObject({
        roomIds: ['living-room', 'kitchen'],
        lastAction: 'list',
        lastState: 'off',
      })
      expect(detailPayload.result.structuredContent.context).not.toHaveProperty('roomLightNames')

      const repeat = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 140, method: 'tools/call',
        params: {
          name: 'home_chat',
          arguments: {
            text: 'What about now?',
            context: detailPayload.result.structuredContent.context,
          },
        },
      })
      const repeatPayload = await repeat.json() as {
        result: { structuredContent: { controls: Array<{ kind: string; options?: Array<{ label: string }> }> } }
      }
      expect(repeatPayload.result.structuredContent.controls[0]).toMatchObject({
        kind: 'room-picker',
        options: [{ label: 'Living Room' }, { label: 'Kitchen' }],
      })

      const singleDetail = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 143, method: 'tools/call',
        params: {
          name: 'home_chat',
          arguments: {
            text: 'Living Room',
            context: {
              domain: 'lights',
              roomId: null,
              entityIds: [],
              lightNames: [],
              roomIds: ['living-room'],
              roomLightNames: { 'living-room': ['Front Left'] },
              lastAction: 'lights-on',
            },
          },
        },
      })
      const singlePayload = await singleDetail.json() as {
        result: { structuredContent: { context: Record<string, unknown> } }
      }
      expect(singlePayload.result.structuredContent.context).toMatchObject({
        roomId: null,
        roomIds: ['living-room'],
        lastAction: 'list',
        lastState: 'off',
      })
      expect(singlePayload.result.structuredContent.context).not.toHaveProperty('roomLightNames')
      const unsafeWrite = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 144, method: 'tools/call',
        params: {
          name: 'home_chat',
          arguments: { text: 'Turn them on.', context: singlePayload.result.structuredContent.context },
        },
      })
      const unsafePayload = await unsafeWrite.json() as { result: { structuredContent: { status: string } } }
      expect(unsafePayload.result.structuredContent.status).toBe('unsupported')
      expect(app.calls.some((call) => call.input.includes('/api/services/'))).toBe(false)
    } finally {
      await app.close()
    }
  })

  it('omits unavailable color actions from room detail guidance', async () => {
    const app = await startServer(undefined, (path) => path.includes('/api/states/')
      ? { entity_id: decodeURIComponent(path.split('/').at(-1) ?? ''), state: 'on', attributes: {} }
      : [])
    try {
      const response = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 142, method: 'tools/call',
        params: {
          name: 'home_chat',
          arguments: {
            text: 'Dining Room',
            context: {
              domain: 'lights',
              roomId: null,
              entityIds: [],
              lightNames: [],
              roomIds: ['dining-room'],
              roomLightNames: { 'dining-room': ['Dining Room Light'] },
              lastAction: 'lights-on',
            },
          },
        },
      })
      const payload = await response.json() as { result: { structuredContent: { text: string } } }
      expect(payload.result.structuredContent.text).toContain(
        'I can tell you when these lights last turned on, turn them off, or tell you why they are on.',
      )
      expect(payload.result.structuredContent.text).not.toContain('change their color')
    } finally {
      await app.close()
    }
  })

  it('lists configured lights across multiple rooms without anchoring follow-ups to one room', async () => {
    const app = await startServer(undefined, (path) => {
      if (!path.includes('/api/states/')) return []
      const entityId = decodeURIComponent(path.split('/').at(-1) ?? '')
      const on = entityId === 'light.hallway_entry_light'
      return { entity_id: entityId, state: on ? 'on' : 'off', attributes: {} }
    })
    try {
      const response = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 123, method: 'tools/call',
        params: { name: 'home_chat', arguments: { text: 'Which lights are on in the Hallway or Guest Bathroom?' } },
      })
      const payload = await response.json() as {
        result: { structuredContent: { status: string; text: string; context: Record<string, unknown> } }
      }
      expect(payload.result.structuredContent).toMatchObject({
        status: 'answer',
        text: 'Entry Light is on in the Hallway. No Guest Bathroom lights are on.',
        context: {
          roomId: null,
          entityIds: [],
          lightNames: [],
          roomIds: ['hallway', 'guest-bathroom'],
          lastAction: 'list',
        },
      })
      expect(payload.result.structuredContent.context).not.toHaveProperty('roomLightNames')

      const followUp = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 124, method: 'tools/call',
        params: {
          name: 'home_chat',
          arguments: { text: 'Turn them off.', context: payload.result.structuredContent.context },
        },
      })
      const followUpPayload = await followUp.json() as { result: { structuredContent: { status: string } } }
      expect(followUpPayload.result.structuredContent).toMatchObject({
        status: 'unsupported',
      })
      expect(app.calls.some((call) => call.input.includes('/api/services/'))).toBe(false)
    } finally {
      await app.close()
    }
  })

  it('keeps multi-room state context neutral so pronoun commands must clarify', async () => {
    const app = await startServer(undefined, (path) => path.includes('/api/states/')
      ? { entity_id: decodeURIComponent(path.split('/').at(-1) ?? ''), state: 'off', attributes: {} }
      : [])
    try {
      const response = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 125, method: 'tools/call',
        params: { name: 'home_chat', arguments: { text: 'Are the Hallway or Guest Bathroom lights off?' } },
      })
      const payload = await response.json() as {
        result: { structuredContent: { status: string; context: Record<string, unknown> } }
      }
      expect(payload.result.structuredContent).toMatchObject({
        status: 'answer',
        context: {
          roomId: null,
          entityIds: [],
          lightNames: [],
          roomIds: ['hallway', 'guest-bathroom'],
          lastAction: 'state',
          targetState: 'off',
        },
      })
      const repeat = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 126, method: 'tools/call',
        params: {
          name: 'home_chat',
          arguments: { text: 'What about now?', context: payload.result.structuredContent.context },
        },
      })
      const repeatPayload = await repeat.json() as {
        result: { structuredContent: { controls: Array<{ kind: string; options?: Array<{ message: string }> }> } }
      }
      expect(repeatPayload.result.structuredContent.controls[0]).toMatchObject({
        kind: 'room-picker',
        options: [
          expect.objectContaining({ message: 'Are the Hallway lights off?' }),
          expect.objectContaining({ message: 'Are the Guest Bathroom lights off?' }),
        ],
      })
      const followUp = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 127, method: 'tools/call',
        params: {
          name: 'home_chat',
          arguments: { text: 'Turn them off.', context: payload.result.structuredContent.context },
        },
      })
      const followUpPayload = await followUp.json() as { result: { structuredContent: { status: string; text: string } } }
      expect(followUpPayload.result.structuredContent).toMatchObject({
        status: 'unsupported',
        text: 'Choose a room to see which lights are on before changing them.',
      })
      expect(app.calls.some((call) => call.input.includes('/api/services/'))).toBe(false)
    } finally {
      await app.close()
    }
  })

  it('describes and retains exact fixtures in multi-room state reads', async () => {
    const app = await startServer(undefined, (path) => path.includes('/api/states/')
      ? { entity_id: decodeURIComponent(path.split('/').at(-1) ?? ''), state: 'off', attributes: {} }
      : [])
    try {
      const response = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 145, method: 'tools/call',
        params: {
          name: 'home_chat',
          arguments: {
            text: 'Are they still on in the Living Room and Kitchen?',
            context: {
              domain: 'lights',
              roomId: null,
              entityIds: [],
              lightNames: [],
              roomIds: ['living-room', 'kitchen'],
              roomLightNames: {
                'living-room': ['Front Left'],
                kitchen: ['Sink Light'],
              },
              lastAction: 'list',
              lastState: 'on',
            },
          },
        },
      })
      const payload = await response.json() as {
        result: { structuredContent: { text: string; context: Record<string, unknown> } }
      }
      expect(payload.result.structuredContent).toMatchObject({
        text: 'Front Left in the Living Room is off; Sink Light in the Kitchen is off.',
        context: {
          roomIds: ['living-room', 'kitchen'],
          roomLightNames: {
            'living-room': ['Front Left'],
            kitchen: ['Sink Light'],
          },
          lastAction: 'state',
          lastState: 'off',
          targetState: 'on',
        },
      })
      const reason = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 146, method: 'tools/call',
        params: {
          name: 'home_chat',
          arguments: { text: 'Why?', context: payload.result.structuredContent.context },
        },
      })
      const reasonPayload = await reason.json() as {
        result: { structuredContent: { controls: Array<{ kind: string; options?: Array<{ message: string }> }> } }
      }
      expect(reasonPayload.result.structuredContent.controls[0]).toMatchObject({
        kind: 'room-picker',
        options: [
          expect.objectContaining({ message: 'Why did the Front Left in the Living Room turn off?' }),
          expect.objectContaining({ message: 'Why did the Sink Light in the Kitchen turn off?' }),
        ],
      })
    } finally {
      await app.close()
    }
  })

  it('reports readable and unavailable fixtures separately in scoped state reads', async () => {
    const app = await startServer(undefined, (path) => {
      if (!path.includes('/api/states/')) return []
      const entityId = decodeURIComponent(path.split('/').at(-1) ?? '')
      return {
        entity_id: entityId,
        state: entityId === 'light.living_room_back_right_light' ? 'unknown' : 'off',
        attributes: {},
      }
    })
    try {
      const response = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 150, method: 'tools/call',
        params: {
          name: 'home_chat',
          arguments: {
            text: 'Are they still on in the Living Room and Kitchen?',
            context: {
              domain: 'lights',
              roomId: null,
              entityIds: [],
              lightNames: [],
              roomIds: ['living-room', 'kitchen'],
              roomLightNames: {
                'living-room': ['Front Left', 'Back Right'],
                kitchen: ['Sink Light'],
              },
              lastAction: 'list',
              lastState: 'on',
            },
          },
        },
      })
      const payload = await response.json() as { result: { structuredContent: { text: string } } }
      expect(payload.result.structuredContent.text).toBe(
        'Front Left in the Living Room is off; Back Right in the Living Room is unavailable; Sink Light in the Kitchen is off.',
      )
    } finally {
      await app.close()
    }
  })

  it('keeps mixed whole-room and fixture state reads non-actionable', async () => {
    const app = await startServer(undefined, (path) => path.includes('/api/states/')
      ? { entity_id: decodeURIComponent(path.split('/').at(-1) ?? ''), state: 'off', attributes: {} }
      : [])
    try {
      const response = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 147, method: 'tools/call',
        params: {
          name: 'home_chat',
          arguments: {
            text: 'Are the Hallway lights and the Sink Light in the Kitchen on?',
          },
        },
      })
      const payload = await response.json() as {
        result: { structuredContent: { context: Record<string, unknown> } }
      }
      expect(payload.result.structuredContent.context).toMatchObject({
        roomIds: ['hallway', 'kitchen'],
        lastAction: 'state',
        lastState: 'off',
      })
      expect(payload.result.structuredContent.context).not.toHaveProperty('roomLightNames')

      const followUp = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 148, method: 'tools/call',
        params: {
          name: 'home_chat',
          arguments: { text: 'Turn them off.', context: payload.result.structuredContent.context },
        },
      })
      const followUpPayload = await followUp.json() as { result: { structuredContent: { status: string } } }
      expect(followUpPayload.result.structuredContent.status).toBe('unsupported')
      expect(app.calls.some((call) => call.input.includes('/api/services/'))).toBe(false)
    } finally {
      await app.close()
    }
  })

  it('qualifies multi-room list negatives when a fixture is unreadable', async () => {
    const app = await startServer(undefined, (path) => {
      if (!path.includes('/api/states/')) return []
      const entityId = decodeURIComponent(path.split('/').at(-1) ?? '')
      const state = entityId === 'light.hallway_gym_light' ? 'unknown' : 'off'
      return { entity_id: entityId, state, attributes: {} }
    })
    try {
      const response = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 127, method: 'tools/call',
        params: { name: 'home_chat', arguments: { text: 'Which lights are on in the Hallway or Guest Bathroom?' } },
      })
      const payload = await response.json() as { result: { structuredContent: { text: string } } }
      expect(payload.result.structuredContent.text).toBe(
        'No readable Hallway lights are on. I could not read 1 other light. No Guest Bathroom lights are on.',
      )
    } finally {
      await app.close()
    }
  })

  it('scopes narrowed multi-room list copy to the requested fixtures', async () => {
    const app = await startServer(undefined, (path) => path.includes('/api/states/')
      ? { entity_id: decodeURIComponent(path.split('/').at(-1) ?? ''), state: 'off', attributes: {} }
      : [])
    try {
      const response = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 131, method: 'tools/call',
        params: { name: 'home_lights', arguments: { operations: [
          { action: 'list', room: 'Kitchen', light_names: ['Door Light'] },
          { action: 'list', room: 'Master Bedroom', light_names: ['Door Light'] },
        ] } },
      })
      const payload = await response.json() as {
        result: { structuredContent: { text: string; context: Record<string, unknown> } }
      }
      expect(payload.result.structuredContent.text).toBe(
        'The Door Light in the Kitchen is off. The Door Light in the Master Bedroom is off.',
      )
      expect(payload.result.structuredContent.context).toMatchObject({
        roomIds: ['kitchen', 'master-bedroom'],
        roomLightNames: {
          kitchen: ['Door Light'],
          'master-bedroom': ['Door Light'],
        },
        lastAction: 'list',
        lastState: 'off',
      })
      const repeat = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 155, method: 'tools/call',
        params: {
          name: 'home_chat',
          arguments: { text: 'What about now?', context: payload.result.structuredContent.context },
        },
      })
      const repeatPayload = await repeat.json() as {
        result: { structuredContent: { controls: Array<{ kind: string; options?: Array<{ message: string }> }> } }
      }
      expect(repeatPayload.result.structuredContent.controls[0]).toMatchObject({
        kind: 'room-picker',
        options: [
          expect.objectContaining({ message: 'Which selected Kitchen lights are on?' }),
          expect.objectContaining({ message: 'Which selected Master Bedroom lights are on?' }),
        ],
      })
    } finally {
      await app.close()
    }
  })

  it('marks mixed exact-list results without inventing a shared reason polarity', async () => {
    const app = await startServer(undefined, (path) => {
      if (!path.includes('/api/states/')) return []
      const entityId = decodeURIComponent(path.split('/').at(-1) ?? '')
      return {
        entity_id: entityId,
        state: entityId === 'light.kitchen_door_light' ? 'on' : 'off',
        attributes: {},
      }
    })
    try {
      const response = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 156, method: 'tools/call',
        params: { name: 'home_lights', arguments: { operations: [
          { action: 'list', room: 'Kitchen', light_names: ['Door Light'] },
          { action: 'list', room: 'Master Bedroom', light_names: ['Door Light'] },
        ] } },
      })
      const payload = await response.json() as {
        result: { structuredContent: { context: Record<string, unknown> } }
      }
      expect(payload.result.structuredContent.context).toMatchObject({
        roomLightNames: {
          kitchen: ['Door Light'],
          'master-bedroom': ['Door Light'],
        },
        lastAction: 'list',
        lastState: 'mixed',
      })
      const reason = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 157, method: 'tools/call',
        params: {
          name: 'home_chat',
          arguments: { text: 'Why?', context: payload.result.structuredContent.context },
        },
      })
      const reasonPayload = await reason.json() as { result: { structuredContent: { status: string } } }
      expect(reasonPayload.result.structuredContent.status).toBe('unsupported')
    } finally {
      await app.close()
    }
  })

  it('answers fixture state polarity against only the requested light', async () => {
    const app = await startServer(undefined, (path) => path.includes('/api/states/')
      ? { entity_id: decodeURIComponent(path.split('/').at(-1) ?? ''), state: 'off', attributes: {} }
      : [])
    try {
      const response = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 116, method: 'tools/call',
        params: { name: 'home_chat', arguments: { text: 'Is the Front Left light in the Living Room off?' } },
      })
      const payload = await response.json() as { result: { structuredContent: { text: string } } }
      expect(payload.result.structuredContent.text).toBe('Yes, the Front Left in the Living Room is off.')
      expect(app.calls.filter((call) => call.input.includes('/api/states/')).map((call) => call.input))
        .toEqual(['http://ha.test/api/states/light.living_room_front_left_light'])
    } finally {
      await app.close()
    }
  })

  it('reports mixed fixture readability within one room without widening the subject', async () => {
    const app = await startServer(undefined, (path) => {
      if (!path.includes('/api/states/')) return []
      const entityId = decodeURIComponent(path.split('/').at(-1) ?? '')
      return {
        entity_id: entityId,
        state: entityId === 'light.living_room_back_right_light' ? 'unknown' : 'off',
        attributes: {},
      }
    })
    try {
      const response = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 151, method: 'tools/call',
        params: {
          name: 'home_lights',
          arguments: {
            action: 'state',
            room: 'Living Room',
            light_names: ['Front Left', 'Back Right'],
            target_state: 'on',
          },
        },
      })
      const payload = await response.json() as { result: { structuredContent: { text: string } } }
      expect(payload.result.structuredContent.text).toBe(
        'Front Left in the Living Room is off; Back Right in the Living Room is unavailable.',
      )
    } finally {
      await app.close()
    }
  })

  it('keeps fixture-scoped list negatives narrower than the room', async () => {
    const app = await startServer(undefined, (path) => {
      if (!path.includes('/api/states/')) return []
      const entityId = decodeURIComponent(path.split('/').at(-1) ?? '')
      return {
        entity_id: entityId,
        state: entityId === 'light.living_room_front_right_light' ? 'on' : 'off',
        attributes: {},
      }
    })
    try {
      const response = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 68, method: 'tools/call',
        params: {
          name: 'home_lights',
          arguments: {
            action: 'list',
            room: 'Living Room',
            light_names: ['Front Left', 'Back Right'],
          },
        },
      })
      const payload = await response.json() as { result: { structuredContent: { text: string } } }
      expect(payload.result.structuredContent.text).toBe('Front Left and Back Right in the Living Room are off.')
    } finally {
      await app.close()
    }
  })

  it('reports unavailable reads instead of claiming lights are off or PBL is inactive', async () => {
    const app = await startServer(undefined, () => {
      throw new Error('HA unavailable')
    })
    try {
      const ask = async (id: number, text: string) => {
        const response = await rpc(app.baseUrl, {
          jsonrpc: '2.0', id, method: 'tools/call',
          params: { name: 'home_chat', arguments: { text } },
        })
        return (await response.json() as { result: { structuredContent: { text: string } } }).result.structuredContent.text
      }
      expect(await ask(105, 'Are the Living Room lights on?')).toContain('could not read')
      expect(await ask(106, 'What color are the Living Room lights?')).toContain('could not read')
      expect(await ask(107, 'Is Presence-Based Lighting active in the Living Room?')).toContain('could not read')
    } finally {
      await app.close()
    }
  })

  it('treats unknown states as unreadable and does not apply relative brightness', async () => {
    const app = await startServer(undefined, (path) => path.includes('/api/states/')
      ? { entity_id: decodeURIComponent(path.split('/').at(-1) ?? ''), state: 'unknown', attributes: {} }
      : [])
    try {
      const ask = async (id: number, text: string) => {
        const response = await rpc(app.baseUrl, {
          jsonrpc: '2.0', id, method: 'tools/call',
          params: { name: 'home_chat', arguments: { text } },
        })
        return (await response.json() as { result: { structuredContent: { status: string; text: string } } }).result.structuredContent
      }
      expect((await ask(112, 'Are the Living Room lights on?')).text).toContain('could not read')
      expect((await ask(113, 'Is Presence-Based Lighting active in the Living Room?')).text).toContain('could not read')
      expect(await ask(114, 'Turn up the Living Room lights.')).toMatchObject({ status: 'failed' })
      expect(app.calls.some((call) => call.input.includes('/api/services/'))).toBe(false)
    } finally {
      await app.close()
    }
  })

  it('rejects parser-produced operations outside the canonical light map', () => {
    const response = validateLightPlanForExecution({
      status: 'ready',
      text: 'Ready.',
      response: 'Ready.',
      controls: [],
      context: null,
      operations: [{
        action: 'on',
        room: {
          id: 'living-room',
          name: 'Living Room',
          aliases: ['living room'],
          groupEntityId: 'switch.unrelated_target',
          color: 'rgb',
          lights: [],
        },
        entityIds: ['switch.unrelated_target'],
        lightNames: ['Unrelated Target'],
        brightnessPct: null,
        rgbColor: null,
        colorName: null,
        colorTemperatureKelvin: null,
        historyBefore: null,
        targetState: null,
      }],
    })
    expect(response.status).toBe('unsupported')
    expect(response.operations).toBeUndefined()
    const global = parseLightUtterance('What lights are on?')!
    const partialGlobal = validateLightPlanForExecution({
      ...global,
      operations: global.operations!.slice(0, 1),
    })
    expect(partialGlobal).toMatchObject({
      status: 'unsupported',
      text: expect.stringContaining('every configured room'),
    })
    const conflictingColor = validateLightPlanForExecution({
      status: 'ready',
      text: 'Ready.',
      response: 'Ready.',
      controls: [],
      context: null,
      operations: [{
        action: 'color',
        room: HOUSE_LIGHT_ROOMS.find((room) => room.id === 'music-room')!,
        entityIds: [],
        lightNames: [],
        brightnessPct: 5,
        rgbColor: [255, 0, 0],
        colorName: 'red',
        colorTemperatureKelvin: null,
        historyBefore: null,
        targetState: null,
      }],
    })
    expect(conflictingColor.status).toBe('unsupported')
    const pendingOff = validateLightPlanForExecution(parseLightUtterance('Turn them off.', {
      domain: 'lights',
      roomId: null,
      entityIds: [],
      lightNames: [],
      roomIds: ['living-room', 'kitchen'],
      roomLightNames: {
        'living-room': ['Front Left'],
        kitchen: ['Sink Light'],
      },
      lastAction: 'list',
      lastState: 'on',
    })!)
    expect(pendingOff.context).toMatchObject({ lastState: 'on' })
    const colorPrompt = parseLightUtterance('Change the Living Room and Music Room light colors.')!
    const colorControl = colorPrompt.controls[0]
    expect(colorControl).toMatchObject({ kind: 'color-picker' })
    if (colorControl?.kind === 'color-picker') {
      const colorPlan = parseLightUtterance(`Turn the ${colorControl.subject} to warm white.`, colorPrompt.context)!
      const validatedColor = validateLightPlanForExecution(colorPlan)
      expect(validatedColor.context).toMatchObject({
        roomId: null,
        roomIds: ['living-room', 'music-room'],
        roomLightNames: {
          'living-room': HOUSE_LIGHT_ROOMS.find((room) => room.id === 'living-room')!.lights.map((light) => light.name),
          'music-room': HOUSE_LIGHT_ROOMS.find((room) => room.id === 'music-room')!.lights.map((light) => light.name),
        },
      })
      expect(parseLightUtterance('Turn them off.', validatedColor.context)?.operations?.map((operation) => operation.room.id))
        .toEqual(['living-room', 'music-room'])
    }
  })

  it('rejects mixed read and write operation arrays before any HA request', async () => {
    const app = await startServer()
    try {
      const response = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 119, method: 'tools/call',
        params: { name: 'home_lights', arguments: { operations: [
          { action: 'state', room: 'Kitchen' },
          { action: 'off', room: 'Living Room' },
        ] } },
      })
      const payload = await response.json() as { result: { structuredContent: { status: string; text: string } } }
      expect(payload.result.structuredContent).toMatchObject({
        status: 'unsupported',
        text: 'Read and control requests must be sent as separate light requests.',
      })
      expect(app.calls).toHaveLength(0)
    } finally {
      await app.close()
    }
  })

  it('rejects unsupported multi-room read arrays before any HA request', async () => {
    const app = await startServer()
    try {
      const response = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 128, method: 'tools/call',
        params: { name: 'home_lights', arguments: { operations: [
          { action: 'count', room: 'Kitchen' },
          { action: 'count', room: 'Living Room' },
        ] } },
      })
      const payload = await response.json() as { result: { structuredContent: { status: string; text: string } } }
      expect(payload.result.structuredContent).toMatchObject({
        status: 'unsupported',
        text: 'Detailed light queries support one room. Ask about one room at a time.',
      })
      expect(app.calls).toHaveLength(0)

      const duplicateRoom = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 149, method: 'tools/call',
        params: { name: 'home_lights', arguments: { operations: [
          { action: 'state', room: 'Living Room', light_names: ['Front Left'] },
          { action: 'state', room: 'Living Room', light_names: ['Back Right'] },
        ] } },
      })
      const duplicatePayload = await duplicateRoom.json() as { result: { structuredContent: { status: string; text: string } } }
      expect(duplicatePayload.result.structuredContent).toMatchObject({
        status: 'unsupported',
        text: 'Combine fixtures from the same room into one light query.',
      })
      expect(app.calls).toHaveLength(0)
    } finally {
      await app.close()
    }
  })

  it('preserves fixture targets in brightness and retry continuations', async () => {
    const app = await startServer(undefined, (path) => path.includes('/api/states/')
      ? { entity_id: decodeURIComponent(path.split('/').at(-1) ?? ''), state: 'on', attributes: { brightness: 128 } }
      : [])
    try {
      const brightness = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 108, method: 'tools/call',
        params: { name: 'home_chat', arguments: { text: 'Turn the Front Left light in the Living Room to 30%.' } },
      })
      const brightnessPayload = await brightness.json() as { result: { structuredContent: { controls: Array<{ subject?: string }> } } }
      expect(brightnessPayload.result.structuredContent.controls[0].subject).toBe('Front Left in the Living Room')
    } finally {
      await app.close()
    }

    const failedApp = await startServer(undefined, (path) => path.includes('/api/states/')
      ? { entity_id: decodeURIComponent(path.split('/').at(-1) ?? ''), state: 'on', attributes: {} }
      : path.includes('/api/services/')
        ? (() => { throw new Error('service failed') })()
        : [])
    try {
      const failed = await rpc(failedApp.baseUrl, {
        jsonrpc: '2.0', id: 109, method: 'tools/call',
        params: { name: 'home_chat', arguments: { text: 'Turn off the Front Left light in the Living Room.' } },
      })
      const failedPayload = await failed.json() as { result: { structuredContent: { controls: Array<{ options: Array<{ message: string }> }> } } }
      expect(failedPayload.result.structuredContent.controls[0].options[0].message).toBe('Turn off the Front Left in the Living Room.')
    } finally {
      await failedApp.close()
    }
  })

  it('preserves every failed operation and ordered brightness value in retry controls', async () => {
    const app = await startServer(undefined, (path) => path.includes('/api/states/')
      ? { entity_id: decodeURIComponent(path.split('/').at(-1) ?? ''), state: 'on', attributes: { brightness: 128 } }
      : path.includes('/api/services/')
        ? (() => { throw new Error('service failed') })()
        : [])
    try {
      const respectively = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 117, method: 'tools/call',
        params: { name: 'home_lights', arguments: {
          action: 'set',
          room: 'Living Room',
          light_names: ['Back Right', 'Front Left'],
          brightness_pct: [18, 33],
        } },
      })
      const respectivelyPayload = await respectively.json() as {
        result: { structuredContent: { controls: Array<{ options: Array<{ message: string }> }> } }
      }
      expect(respectivelyPayload.result.structuredContent.controls[0].options[0].message)
        .toBe('Turn the Back Right in the Living Room to 18% and Turn the Front Left in the Living Room to 33%.')

      const compound = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 118, method: 'tools/call',
        params: { name: 'home_lights', arguments: { operations: [
          { action: 'on', room: 'Kitchen' },
          { action: 'off', room: 'Living Room' },
        ] } },
      })
      const compoundPayload = await compound.json() as {
        result: { structuredContent: { controls: Array<{ options: Array<{ message: string }> }> } }
      }
      expect(compoundPayload.result.structuredContent.controls[0].options[0].message)
        .toBe('Turn on the Kitchen lights and Turn off the Living Room lights.')

      const relative = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 120, method: 'tools/call',
        params: { name: 'home_lights', arguments: {
          action: 'up',
          room: 'Living Room',
          light_names: ['Front Left'],
          brightness_pct: 25,
        } },
      })
      const relativePayload = await relative.json() as {
        result: { structuredContent: { controls: Array<{ options: Array<{ message: string }> }> } }
      }
      expect(relativePayload.result.structuredContent.controls[0].options[0].message)
        .toBe('Turn the Front Left in the Living Room up by 25%.')
    } finally {
      await app.close()
    }
  })

  it('uses plural room-light grammar for grouped state answers', async () => {
    const app = await startServer(undefined, (path) => {
      if (!path.includes('/api/states/')) return []
      const entityId = decodeURIComponent(path.split('/').at(-1) ?? '')
      const on = entityId.includes('living_room') || entityId.includes('music_room')
      return { entity_id: entityId, state: on ? 'on' : 'off', attributes: {} }
    })
    try {
      const response = await rpc(app.baseUrl, { jsonrpc: '2.0', id: 70, method: 'tools/call', params: { name: 'home_chat', arguments: { text: 'Are the Living Room, Music Room, and Theater Room lights on?' } } })
      const payload = await response.json() as { result: { structuredContent: { text: string } } }
      expect(payload.result.structuredContent.text).toBe('Living Room lights and Music Room lights are on, and Theater Room lights are off.')

    } finally {
      await app.close()
    }

    const offApp = await startServer(undefined, (path) => {
      if (!path.includes('/api/states/')) return []
      const entityId = decodeURIComponent(path.split('/').at(-1) ?? '')
      return { entity_id: entityId, state: 'off', attributes: {} }
    })
    try {
      const bothOff = await rpc(offApp.baseUrl, { jsonrpc: '2.0', id: 71, method: 'tools/call', params: { name: 'home_chat', arguments: { text: 'Are the Music Room and Theater Room lights on?' } } })
      const bothOffPayload = await bothOff.json() as { result: { structuredContent: { text: string } } }
      expect(bothOffPayload.result.structuredContent.text).toBe('Music Room lights and Theater Room lights are both off.')
    } finally {
      await offApp.close()
    }
  })

  it('answers PBL, history, and cause queries from Home Assistant evidence', async () => {
    const app = await startServer(undefined, (path) => {
      if (path.includes('/api/states/switch.living_room_presence')) return { entity_id: 'switch.living_room_presence_living_room_lights_presence_allowed', state: 'on', attributes: {} }
      if (path.includes('/api/history/period/') && path.includes('front_left')) return [
        [{ entity_id: 'light.living_room_front_left_light', state: 'on', last_changed: '2026-09-08T12:00:00Z' }],
        [{ entity_id: 'light.living_room_back_right_light', state: 'on', last_changed: '2026-09-08T13:00:00Z' }],
      ]
      if (path.includes('/api/history/period/')) return [[{ state: 'off', last_changed: '2026-09-08T12:00:00Z' }]]
      if (path.includes('/api/logbook/') && path.includes('front_left')) return [
        { entity_id: 'light.living_room_front_left_light', state: 'on', context_name: 'Old Scene', when: '2026-09-08T11:00:00Z' },
        { entity_id: 'light.living_room_front_left_light', state: 'on', context_name: 'Movie Scene', when: '2026-09-08T13:00:00Z' },
        { entity_id: 'light.living_room_front_left_light', state: 'on', name: 'Front Left', when: '2026-09-08T14:00:00Z' },
        { entity_id: 'light.living_room_back_right_light', state: 'on', context_entity_id: 'automation.private_bedtime_routine', when: '2026-09-08T12:30:00Z' },
      ]
      if (path.includes('/api/logbook/')) return [{
        state: 'on',
        context_name: 'Living Room Presence-Based Lighting',
        when: '2026-09-08T12:00:00Z',
      }]
      return []
    })
    try {
      const pbl = await rpc(app.baseUrl, { jsonrpc: '2.0', id: 13, method: 'tools/call', params: { name: 'home_lights', arguments: { action: 'pbl', room: 'Living Room' } } })
      const pblPayload = await pbl.json() as { result: { structuredContent: { text: string; controls: Array<{ kind: string }> } } }
      expect(pblPayload.result.structuredContent.text).toBe('Presence-Based Lighting is active in the Living Room.')
      expect(pblPayload.result.structuredContent.controls).toEqual([])

      const history = await rpc(app.baseUrl, { jsonrpc: '2.0', id: 14, method: 'tools/call', params: { name: 'home_lights', arguments: { action: 'history', room: 'Living Room' } } })
      const historyPayload = await history.json() as { result: { structuredContent: { text: string } } }
      expect(historyPayload.result.structuredContent.text).toContain('last turned off')

      const reason = await rpc(app.baseUrl, { jsonrpc: '2.0', id: 15, method: 'tools/call', params: { name: 'home_lights', arguments: { action: 'reason', room: 'Living Room' } } })
      const reasonPayload = await reason.json() as { result: { structuredContent: { text: string; data: { causalClaim: boolean } } } }
      expect(reasonPayload.result.structuredContent.text).toContain('Home Assistant record links')
      expect(reasonPayload.result.structuredContent.data.causalClaim).toBe(false)

      const multiHistory = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 16, method: 'tools/call',
        params: {
          name: 'home_lights',
          arguments: {
            action: 'history',
            room: 'Living Room',
            light_names: ['Front Left', 'Back Right'],
            target_state: 'on',
          },
        },
      })
      const multiHistoryPayload = await multiHistory.json() as { result: { structuredContent: { text: string } } }
      expect(multiHistoryPayload.result.structuredContent.text).toContain('• Front Left:')
      expect(multiHistoryPayload.result.structuredContent.text).toContain('• Back Right:')

      const multiReason = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 17, method: 'tools/call',
        params: {
          name: 'home_lights',
          arguments: {
            action: 'reason',
            room: 'Living Room',
            light_names: ['Front Left', 'Back Right'],
            target_state: 'on',
          },
        },
      })
      const multiReasonPayload = await multiReason.json() as { result: { structuredContent: { text: string } } }
      expect(multiReasonPayload.result.structuredContent.text).toContain('• Front Left: Movie Scene')
      expect(multiReasonPayload.result.structuredContent.text).toContain('• Back Right: a Home Assistant automation')
      expect(multiReasonPayload.result.structuredContent.text).not.toContain('automation.private_bedtime_routine')
    } finally {
      await app.close()
    }
  })

  it('reports unavailable cause evidence separately from an empty logbook', async () => {
    const app = await startServer(undefined, (path) => {
      if (path.includes('/api/history/period/')) {
        return [[{
          entity_id: 'light.living_room_front_left_light',
          state: 'on',
          last_changed: '2026-09-08T12:00:00Z',
        }]]
      }
      if (path.includes('/api/logbook/')) throw new Error('logbook unavailable')
      return []
    })
    try {
      const response = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 152, method: 'tools/call',
        params: {
          name: 'home_lights',
          arguments: {
            action: 'reason',
            room: 'Living Room',
            light_names: ['Front Left'],
            target_state: 'on',
          },
        },
      })
      const payload = await response.json() as {
        result: { structuredContent: { text: string; data: { logbookAvailable: boolean } } }
      }
      expect(payload.result.structuredContent.text).toContain('I could not check Home Assistant’s cause records.')
      expect(payload.result.structuredContent.data.logbookAvailable).toBe(false)
    } finally {
      await app.close()
    }
  })

  it('enforces the 180-character boundary at the Home MCP ingress', async () => {
    const app = await startServer('conversation.household')
    try {
      const accepted = 'x'.repeat(180)
      await rpc(app.baseUrl, { jsonrpc: '2.0', id: 16, method: 'tools/call', params: { name: 'home_chat', arguments: { text: accepted } } })
      expect(app.calls).toHaveLength(1)
      const rejected = await rpc(app.baseUrl, { jsonrpc: '2.0', id: 17, method: 'tools/call', params: { name: 'home_chat', arguments: { text: 'x'.repeat(181) } } })
      const payload = await rejected.json() as { error?: { message?: string } }
      expect(payload.error?.message).toContain('180')
      expect(app.calls).toHaveLength(1)
    } finally {
      await app.close()
    }
  })

  it('exposes bounded current state and recorder history reads', async () => {
    const app = await startServer()
    try {
      await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 3, method: 'tools/call',
        params: { name: 'home_state', arguments: { entity_ids: ['light.kitchen', 'sensor.temperature'] } },
      })
      await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 4, method: 'tools/call',
        params: { name: 'home_history', arguments: { entity_ids: ['binary_sensor.front_door'], hours: 6 } },
      })
      expect(app.calls.slice(0, 2).map((call) => call.input)).toEqual([
        'http://ha.test/api/states/light.kitchen',
        'http://ha.test/api/states/sensor.temperature',
      ])
      expect(app.calls[2].input).toContain('/api/history/period/')
      expect(app.calls[2].input).toContain('filter_entity_id=binary_sensor.front_door')
      expect(app.calls[2].input).toContain('minimal_response=')
    } finally {
      await app.close()
    }
  })
})
