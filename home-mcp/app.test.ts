import type { AddressInfo } from 'node:net'
import { request as httpRequest } from 'node:http'
import { createHomeMcpServer, validateLightPlanForExecution } from './app'
import { HassAuthenticationError, type AuthenticatedHassUser } from './hass-auth'
import { HOUSE_LIGHT_ROOMS } from './lights-config'
import { buildLightPlan } from './light-skill'
import metadata from './metadata.json' with { type: 'json' }

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
  respond?: (input: string, init?: RequestInit) => unknown,
  options: {
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
        params: { name: 'home_lights', arguments: { action: 'state', room: 'Living Room 💡' } },
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

  it('rejects a forged bearer token before any tool can run', async () => {
    const app = await startServer(undefined, {
      authenticateUser: async () => { throw new HassAuthenticationError('invalid', 'rejected') },
    })
    try {
      const response = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 101, method: 'tools/call',
        params: { name: 'home_lights', arguments: { action: 'off', room: 'Kitchen' } },
      }, 'forged-token')
      expect(response.status).toBe(401)
      expect(app.calls).toHaveLength(0)
    } finally {
      await app.close()
    }
  })

  it('lists the version and device tools without chat tools', async () => {
    const app = await startServer()
    try {
      const response = await rpc(app.baseUrl, { jsonrpc: '2.0', id: 1, method: 'tools/list' })
      const payload = await response.json() as {
        result: { tools: Array<{ name: string; inputSchema?: { properties?: { operations?: { maxItems?: number } } } }> }
      }
      expect(payload.result.tools.map((tool) => tool.name)).toEqual([
        'home_info', 'home_state', 'home_history', 'home_lights',
      ])
      expect(payload.result.tools.find((tool) => tool.name === 'home_lights')
        ?.inputSchema?.properties?.operations?.maxItems).toBe(HOUSE_LIGHT_ROOMS.length)
    } finally {
      await app.close()
    }
  })

  it('rejects retired chat and feedback tools without touching Home Assistant', async () => {
    const app = await startServer()
    try {
      const health = await fetch(`${app.baseUrl}/health`)
      expect(health.status).toBe(200)
      const healthPayload = await health.json() as { version: string; tools: string[] }
      expect(healthPayload.version).toBe(metadata.serverVersion)
      expect(healthPayload.tools).toEqual([
        'home_info', 'home_state', 'home_history', 'home_lights',
      ])
      const retired = [
        { name: 'home_chat', arguments: { text: 'Turn on the Kitchen lights.' } },
        { name: 'home_chat_end', arguments: { thread_id: 'old-thread' } },
        { name: 'home_chat_review', arguments: { conversation: { threadId: 'old-thread', turns: [] } } },
      ]
      for (const [index, params] of retired.entries()) {
        const response = await rpc(app.baseUrl, { jsonrpc: '2.0', id: index + 20, method: 'tools/call', params })
        const payload = await response.json() as { error: { message: string } }
        expect(payload.error.message).toBe('Unknown Home MCP tool')
      }
      expect(app.calls).toHaveLength(0)
    } finally {
      await app.close()
    }
  })

  it('rejects chat-shaped light requests instead of falling back to a conversation agent', async () => {
    const app = await startServer()
    try {
      for (const [index, extra] of [
        { text: 'Turn off the Kitchen lights.' },
        { conversation_id: 'old-chat' },
        { context: { domain: 'lights', roomId: 'kitchen' } },
      ].entries()) {
        const response = await rpc(app.baseUrl, {
          jsonrpc: '2.0', id: index + 30, method: 'tools/call',
          params: { name: 'home_lights', arguments: { action: 'off', room: 'Kitchen', ...extra } },
        })
        const payload = await response.json() as { result: { structuredContent: { status: string; text: string } } }
        expect(payload.result.structuredContent).toMatchObject({
          status: 'failed',
          text: expect.stringContaining('Unknown light request field:'),
        })
      }
      expect(app.calls).toHaveLength(0)
    } finally {
      await app.close()
    }
  })

  it('keeps authenticated version checks available without chat or queue metadata', async () => {
    const app = await startServer()
    try {
      const response = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 22, method: 'tools/call',
        params: { name: 'home_info', arguments: {} },
      })
      expect(response.status).toBe(200)
      const payload = await response.json() as { result: { structuredContent: unknown } }
      expect(payload.result.structuredContent).toEqual({
        mcpVersion: metadata.serverVersion,
        supportedTools: ['lights'],
      })
      expect(app.calls).toHaveLength(0)
    } finally {
      await app.close()
    }

    const unauthorized = await startServer(undefined, {
      authenticateUser: async () => { throw new HassAuthenticationError('invalid', 'rejected') },
    })
    try {
      const response = await rpc(unauthorized.baseUrl, {
        jsonrpc: '2.0', id: 23, method: 'tools/call',
        params: { name: 'home_info', arguments: {} },
      }, 'forged-token')
      expect(response.status).toBe(401)
      expect(unauthorized.calls).toHaveLength(0)
    } finally {
      await unauthorized.close()
    }
  })

  it('returns a structured room picker without calling Home Assistant for an incomplete light command', async () => {
    const app = await startServer()
    try {
      const response = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 5, method: 'tools/call',
        params: { name: 'home_lights', arguments: { action: 'on' } },
      })
      const payload = await response.json() as { result: { structuredContent: { status: string; text: string; controls: Array<{ kind: string }> } } }
      expect(payload.result.structuredContent).toMatchObject({ status: 'clarify', text: 'Which room?' })
      expect(payload.result.structuredContent.controls[0].kind).toBe('room-picker')
      expect(app.calls).toHaveLength(0)
    } finally {
      await app.close()
    }
  })

  it('computes relative brightness from current state with a ten-point clamp', async () => {
    const app = await startServer((path) => path.includes('/api/states/')
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
    const app = await startServer((path) => {
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
          name: 'home_lights',
          arguments: {
            action: 'down',
            room: 'Living Room',
            light_names: ['Front Left', 'Back Right'],
            brightness_pct: 50,
          },
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

  it('routes Entryway operations through the switch domain and rejects brightness', async () => {
    const app = await startServer((path) => path.includes('/api/states/')
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
    const app = await startServer((path) => {
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
    const app = await startServer((path) => path.includes('/api/states/')
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
    const app = await startServer((path) => path.includes('back_right')
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
    const app = await startServer((path) => path.includes('/api/states/')
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

  it('answers typed count, list, brightness, color, and multi-room reads without services', async () => {
    const app = await startServer((path) => {
      if (!path.includes('/api/states/')) return []
      const entityId = decodeURIComponent(path.split('/').at(-1) ?? '')
      const on = entityId.includes('front_left') || entityId.includes('hallway')
      return { entity_id: entityId, state: on ? 'on' : 'off', attributes: on ? { brightness: 128, rgb_color: [255, 100, 20] } : {} }
    })
    try {
      const ask = async (id: number, args: Record<string, unknown>) => {
        const response = await rpc(app.baseUrl, { jsonrpc: '2.0', id, method: 'tools/call', params: { name: 'home_lights', arguments: args } })
        return (await response.json() as { result: { structuredContent: { text: string } } }).result.structuredContent
      }
      const count = await ask(60, { action: 'count', room: 'Living Room' })
      expect(count.text).toContain('1 of 4')
      const list = await ask(61, { action: 'list', room: 'Living Room' })
      expect(list.text).toContain('Front Left is on')
      const brightness = await ask(62, { action: 'brightness-state', room: 'Living Room' })
      expect(brightness.text).toContain('Front Left is at 50%')
      const color = await ask(63, { action: 'color-state', room: 'Living Room' })
      expect(color.text).toContain('Front Left is rgb(255, 100, 20)')
      const multi = await ask(64, { operations: [
        { action: 'state', room: 'Hallway' },
        { action: 'state', room: 'Guest Bathroom' },
      ] })
      expect(multi.text).toContain('Hallway')
      expect(multi.text).toContain('Guest Bathroom')
      expect(app.calls.some((call) => call.input.includes('/api/services/'))).toBe(false)
    } finally {
      await app.close()
    }
  })

  it('lists only configured lights for a whole-home on query', async () => {
    const app = await startServer((path) => {
      if (!path.includes('/api/states/')) return []
      const entityId = decodeURIComponent(path.split('/').at(-1) ?? '')
      const on = entityId === 'light.living_room_front_left_light' || entityId === 'light.kitchen_sink_light'
      return { entity_id: entityId, state: on ? 'on' : 'off', attributes: {} }
    })
    try {
      const directResponse = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 121, method: 'tools/call',
        params: {
          name: 'home_lights',
          arguments: { action: 'lights-on' },
        },
      })
      const directPayload = await directResponse.json() as {
        result: { structuredContent: { status: string; text: string; context: { lastAction?: string } } }
      }
      expect(directPayload.result.structuredContent).toMatchObject({
        status: 'answer',
        text: 'Front Left is on in the Living Room. Sink Light is on in the Kitchen.',
        context: { lastAction: 'lights-on' },
      })
      expect(directPayload.result.structuredContent.text).not.toMatch(/Christmas|transit|Line/)
      expect(app.calls.some((call) => call.input.includes('/api/services/'))).toBe(false)
    } finally {
      await app.close()
    }
  })

  it('qualifies rooms-on results when unreadable fixtures prevent a definitive room answer', async () => {
    const app = await startServer((path) => {
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
        params: { name: 'home_lights', arguments: { action: 'rooms-on' } },
      })
      const payload = await response.json() as {
        result: { structuredContent: { status: string; text: string; data: { rooms: string[]; uncertainRooms: string[] } } }
      }
      expect(payload.result.structuredContent).toMatchObject({
        status: 'answer',
        text: 'Kitchen has lights on. Living Room could not be fully checked because some light states could not be read. Try again.',
        data: { rooms: ['Kitchen'], uncertainRooms: ['Living Room'] },
      })
      expect(app.calls.some((call) => call.input.includes('/api/services/'))).toBe(false)
    } finally {
      await app.close()
    }
  })

  it('lists configured lights across multiple rooms with neutral context', async () => {
    const app = await startServer((path) => {
      if (!path.includes('/api/states/')) return []
      const entityId = decodeURIComponent(path.split('/').at(-1) ?? '')
      const on = entityId === 'light.hallway_entry_light'
      return { entity_id: entityId, state: on ? 'on' : 'off', attributes: {} }
    })
    try {
      const response = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 123, method: 'tools/call',
        params: { name: 'home_lights', arguments: { operations: [
          { action: 'list', room: 'Hallway' },
          { action: 'list', room: 'Guest Bathroom' },
        ] } },
      })
      const payload = await response.json() as {
        result: { structuredContent: { status: string; text: string; context: Record<string, unknown> } }
      }
      expect(payload.result.structuredContent).toMatchObject({
        status: 'answer',
        text: 'Entry Light is on in the Hallway. No Guest Bathroom lights are on.',
        context: { roomId: null, entityIds: [], lightNames: [], lastAction: 'list' },
      })

      expect(app.calls.some((call) => call.input.includes('/api/services/'))).toBe(false)
    } finally {
      await app.close()
    }
  })

  it('qualifies multi-room list negatives when a fixture is unreadable', async () => {
    const app = await startServer((path) => {
      if (!path.includes('/api/states/')) return []
      const entityId = decodeURIComponent(path.split('/').at(-1) ?? '')
      const state = entityId === 'light.hallway_gym_light' ? 'unknown' : 'off'
      return { entity_id: entityId, state, attributes: {} }
    })
    try {
      const response = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 127, method: 'tools/call',
        params: { name: 'home_lights', arguments: { operations: [
          { action: 'list', room: 'Hallway' },
          { action: 'list', room: 'Guest Bathroom' },
        ] } },
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
    const app = await startServer((path) => path.includes('/api/states/')
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
      const payload = await response.json() as { result: { structuredContent: { text: string } } }
      expect(payload.result.structuredContent.text).toBe(
        'The Door Light in the Kitchen is off. The Door Light in the Master Bedroom is off.',
      )
    } finally {
      await app.close()
    }
  })

  it('answers fixture state polarity against only the requested light', async () => {
    const app = await startServer((path) => path.includes('/api/states/')
      ? { entity_id: decodeURIComponent(path.split('/').at(-1) ?? ''), state: 'off', attributes: {} }
      : [])
    try {
      const response = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 116, method: 'tools/call',
        params: { name: 'home_lights', arguments: {
          action: 'state', room: 'Living Room', light_names: ['Front Left'], target_state: 'off',
        } },
      })
      const payload = await response.json() as { result: { structuredContent: { text: string } } }
      expect(payload.result.structuredContent.text).toBe('Yes, the Front Left in the Living Room is off.')
      expect(app.calls.filter((call) => call.input.includes('/api/states/')).map((call) => call.input))
        .toEqual(['http://ha.test/api/states/light.living_room_front_left_light'])
    } finally {
      await app.close()
    }
  })

  it('keeps fixture-scoped list negatives narrower than the room', async () => {
    const app = await startServer((path) => {
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
    const app = await startServer(() => {
      throw new Error('HA unavailable')
    })
    try {
      const ask = async (id: number, args: Record<string, unknown>) => {
        const response = await rpc(app.baseUrl, {
          jsonrpc: '2.0', id, method: 'tools/call',
          params: { name: 'home_lights', arguments: args },
        })
        return (await response.json() as { result: { structuredContent: { text: string } } }).result.structuredContent.text
      }
      expect(await ask(105, { action: 'state', room: 'Living Room' })).toContain('could not read')
      expect(await ask(106, { action: 'color-state', room: 'Living Room' })).toContain('could not read')
      expect(await ask(107, { action: 'pbl', room: 'Living Room' })).toContain('could not read')
    } finally {
      await app.close()
    }
  })

  it('treats unknown states as unreadable and does not apply relative brightness', async () => {
    const app = await startServer((path) => path.includes('/api/states/')
      ? { entity_id: decodeURIComponent(path.split('/').at(-1) ?? ''), state: 'unknown', attributes: {} }
      : [])
    try {
      const ask = async (id: number, args: Record<string, unknown>) => {
        const response = await rpc(app.baseUrl, {
          jsonrpc: '2.0', id, method: 'tools/call',
          params: { name: 'home_lights', arguments: args },
        })
        return (await response.json() as { result: { structuredContent: { status: string; text: string } } }).result.structuredContent
      }
      expect((await ask(112, { action: 'state', room: 'Living Room' })).text).toContain('could not read')
      expect((await ask(113, { action: 'pbl', room: 'Living Room' })).text).toContain('could not read')
      expect(await ask(114, { action: 'up', room: 'Living Room' })).toMatchObject({ status: 'failed' })
      expect(app.calls.some((call) => call.input.includes('/api/services/'))).toBe(false)
    } finally {
      await app.close()
    }
  })

  it('rejects untrusted operations outside the canonical light map', () => {
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
    const global = buildLightPlan({ action: 'lights-on' })
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
    } finally {
      await app.close()
    }
  })

  it('preserves fixture targets in brightness and retry continuations', async () => {
    const app = await startServer((path) => path.includes('/api/states/')
      ? { entity_id: decodeURIComponent(path.split('/').at(-1) ?? ''), state: 'on', attributes: { brightness: 128 } }
      : [])
    try {
      const brightness = await rpc(app.baseUrl, {
        jsonrpc: '2.0', id: 108, method: 'tools/call',
        params: { name: 'home_lights', arguments: {
          action: 'set', room: 'Living Room', light_names: ['Front Left'], brightness_pct: 30,
        } },
      })
      const brightnessPayload = await brightness.json() as { result: { structuredContent: { controls: Array<{ subject?: string }> } } }
      expect(brightnessPayload.result.structuredContent.controls[0].subject).toBe('Front Left in the Living Room')
    } finally {
      await app.close()
    }

    const failedApp = await startServer((path) => path.includes('/api/states/')
      ? { entity_id: decodeURIComponent(path.split('/').at(-1) ?? ''), state: 'on', attributes: {} }
      : path.includes('/api/services/')
        ? (() => { throw new Error('service failed') })()
        : [])
    try {
      const failed = await rpc(failedApp.baseUrl, {
        jsonrpc: '2.0', id: 109, method: 'tools/call',
        params: { name: 'home_lights', arguments: {
          action: 'off', room: 'Living Room', light_names: ['Front Left'],
        } },
      })
      const failedPayload = await failed.json() as { result: { structuredContent: { controls: Array<{ options: Array<{ message: string }> }> } } }
      expect(failedPayload.result.structuredContent.controls[0].options[0].message).toBe('Turn off the Front Left in the Living Room.')
    } finally {
      await failedApp.close()
    }
  })

  it('preserves every failed operation and ordered brightness value in retry controls', async () => {
    const app = await startServer((path) => path.includes('/api/states/')
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
    const app = await startServer((path) => {
      if (!path.includes('/api/states/')) return []
      const entityId = decodeURIComponent(path.split('/').at(-1) ?? '')
      const on = entityId.includes('living_room') || entityId.includes('music_room')
      return { entity_id: entityId, state: on ? 'on' : 'off', attributes: {} }
    })
    try {
      const response = await rpc(app.baseUrl, { jsonrpc: '2.0', id: 70, method: 'tools/call', params: { name: 'home_lights', arguments: { operations: [
        { action: 'state', room: 'Living Room' },
        { action: 'state', room: 'Music Room' },
        { action: 'state', room: 'Theater Room' },
      ] } } })
      const payload = await response.json() as { result: { structuredContent: { text: string } } }
      expect(payload.result.structuredContent.text).toBe('Living Room lights and Music Room lights are on, and Theater Room lights are off.')

    } finally {
      await app.close()
    }

    const offApp = await startServer((path) => {
      if (!path.includes('/api/states/')) return []
      const entityId = decodeURIComponent(path.split('/').at(-1) ?? '')
      return { entity_id: entityId, state: 'off', attributes: {} }
    })
    try {
      const bothOff = await rpc(offApp.baseUrl, { jsonrpc: '2.0', id: 71, method: 'tools/call', params: { name: 'home_lights', arguments: { operations: [
        { action: 'state', room: 'Music Room' },
        { action: 'state', room: 'Theater Room' },
      ] } } })
      const bothOffPayload = await bothOff.json() as { result: { structuredContent: { text: string } } }
      expect(bothOffPayload.result.structuredContent.text).toBe('Music Room lights and Theater Room lights are both off.')
    } finally {
      await offApp.close()
    }
  })

  it('answers PBL, history, and cause queries from Home Assistant evidence', async () => {
    const app = await startServer((path) => {
      if (path.includes('/api/states/switch.living_room_presence')) return { entity_id: 'switch.living_room_presence_living_room_lights_presence_allowed', state: 'on', attributes: {} }
      if (path.includes('/api/history/period/')) return [[{ state: 'off', last_changed: '2026-09-08T12:00:00Z' }]]
      if (path.includes('/api/logbook/')) return [{ state: 'on', name: 'Living Room Presence-Based Lighting' }]
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
      expect(reasonPayload.result.structuredContent.text).toContain('latest Home Assistant record links')
      expect(reasonPayload.result.structuredContent.data.causalClaim).toBe(false)
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

  it('rejects over-limit and invalid state/history reads before Home Assistant access', async () => {
    const app = await startServer()
    try {
      const invalid = [
        { name: 'home_state', arguments: { entity_ids: Array(51).fill('light.kitchen') }, message: '1-50' },
        { name: 'home_state', arguments: { entity_ids: ['invalid'] }, message: '1-50' },
        { name: 'home_history', arguments: { entity_ids: Array(21).fill('light.kitchen') }, message: '1-20' },
        { name: 'home_history', arguments: { entity_ids: ['light.kitchen'], hours: 169 }, message: 'between 0 and 168' },
      ]
      for (const [index, params] of invalid.entries()) {
        const response = await rpc(app.baseUrl, {
          jsonrpc: '2.0', id: index + 40, method: 'tools/call',
          params: { name: params.name, arguments: params.arguments },
        })
        const payload = await response.json() as { error: { message: string } }
        expect(payload.error.message).toContain(params.message)
      }
      expect(app.calls).toHaveLength(0)
    } finally {
      await app.close()
    }
  })
})
