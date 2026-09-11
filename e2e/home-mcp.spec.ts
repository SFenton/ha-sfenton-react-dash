import { test, expect } from './layout/fixture'
import { bindChatServer, openChat } from './chat-fixture'
import { MockChatServer } from '../src/test/mocks/chatServer'

// @covers src/components/hass/LightColorPicker.module.css
// @covers src/components/hass/LightColorPicker.tsx
// @covers src/components/hass/LightMoreInfoSheet.module.css
// @covers src/components/hass/chat/Chat.module.css
// @covers src/components/hass/chat/ChatColorEditor.module.css
// @covers src/components/hass/chat/ChatSettingsPanel.module.css
// @covers src/pages/ControlShowcasePage.module.css
// @covers src/pages/DashboardViewPage.tsx
// @covers src/styles/tokens.css
test('renders one-send Home MCP light controls inside assistant messages', async ({ page, context }) => {
  const server = new MockChatServer()
  const requests: string[] = []
  await bindChatServer(context, server, 'home-mcp-controls')
  await page.addInitScript(() => { window.__homeMcpUrl = '/api/sfenton_home_mcp' })
  await page.route('**/api/sfenton_home_mcp', async (route) => {
    const body = JSON.parse(route.request().postData() ?? '{}') as { id?: number; params?: { name?: string; arguments?: { text?: string } } }
    if (body.params?.name === 'home_chat_end') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ jsonrpc: '2.0', id: body.id, result: { structuredContent: { status: 'queued' } } }) })
      return
    }
    const text = body.params?.arguments?.text ?? ''
    requests.push(text)
    const room = text.includes('Living Room') ? 'Living Room' : 'Kitchen'
    const structuredContent = text === 'Turn on the lights' ? {
      conversation_id: 'home-mcp-light-controls', status: 'clarification', text: 'Which room?',
      controls: [{
        id: 'room-turn-on', kind: 'room-picker', options: [
          { label: 'Living Room', value: 'Living Room', message: 'Turn on the Living Room lights.' },
          { label: 'Kitchen', value: 'Kitchen', message: 'Turn on the Kitchen lights.' },
        ],
      }],
      context: { domain: 'lights', roomId: null, entityIds: [], lightNames: [] },
    } : {
      conversation_id: 'home-mcp-light-controls', status: 'success', text: `I turned on the ${room} lights.`,
      controls: [], context: { domain: 'lights', roomId: room.toLowerCase().replace(' ', '-'), entityIds: [], lightNames: [] },
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ jsonrpc: '2.0', id: body.id, result: { structuredContent } }) })
  })

  const dialog = await openChat(page, 'home-mcp-controls')
  await dialog.getByRole('textbox', { name: 'Chat Message', exact: true }).fill('Turn on the lights')
  await dialog.getByRole('button', { name: 'Send Chat Message', exact: true }).click()
  await expect(dialog.getByText('Which room?', { exact: true })).toBeVisible()
  await dialog.getByRole('option', { name: 'Kitchen', exact: true }).click()
  await dialog.getByRole('button', { name: 'Send Selection', exact: true }).click()
  await expect(dialog.getByText('I turned on the Kitchen lights.', { exact: true })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Already Sent', exact: true })).toBeDisabled()
  expect(requests).toEqual(['Turn on the lights', 'Turn on the Kitchen lights.'])

  await dialog.getByRole('option', { name: 'Living Room', exact: true }).click()
  await expect(dialog.getByRole('option', { name: 'Living Room', exact: true })).toHaveAttribute('aria-selected', 'true')
  await dialog.getByRole('button', { name: 'View History', exact: true }).click()
  await dialog.locator('[data-chat-history-thread]').first().click()
  await expect(dialog.getByRole('button', { name: 'Already Sent', exact: true })).toBeDisabled()
  expect(requests).toHaveLength(2)

  await dialog.getByRole('button', { name: 'Start New Chat', exact: true }).click()
  await dialog.getByRole('textbox', { name: 'Chat Message', exact: true }).fill('Turn on the lights')
  await dialog.getByRole('button', { name: 'Send Chat Message', exact: true }).click()
  await expect(dialog.getByText('Which room?', { exact: true })).toBeVisible()
  await dialog.getByRole('option', { name: 'Living Room', exact: true }).click()
  await expect(dialog.getByRole('button', { name: 'Send Selection', exact: true })).toBeEnabled()
  await dialog.getByRole('button', { name: 'Send Selection', exact: true }).click()
  await expect(dialog.getByText('I turned on the Living Room lights.', { exact: true })).toBeVisible()
  expect(requests).toEqual([
    'Turn on the lights', 'Turn on the Kitchen lights.',
    'Turn on the lights', 'Turn on the Living Room lights.',
  ])
})

test('shows model, version, queue, and improvement history in Chat Settings', async ({ page, context }) => {
  const server = new MockChatServer()
  const tools: string[] = []
  await bindChatServer(context, server, 'home-mcp-settings')
  await page.addInitScript(() => { window.__homeMcpUrl = '/api/sfenton_home_mcp' })
  await page.route('**/api/sfenton_home_mcp', async (route) => {
    const body = JSON.parse(route.request().postData() ?? '{}') as { id?: number; params?: { name?: string } }
    tools.push(body.params?.name ?? '')
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: body.id,
        result: { structuredContent: {
          chatModel: 'Gemini 3.1 Flash Lite',
          mcpVersion: '0.2.0',
          supportedTools: ['lights'],
          queue: { enabled: true, autoPublish: true, pending: 1, processing: false, lastError: null },
          improvements: [{
            version: '0.2.0',
            publishedAt: '2026-09-10T14:00:00.000Z',
            summary: ['Learns from completed light conversations one at a time.'],
          }],
        } },
      }),
    })
  })

  const dialog = await openChat(page, 'home-mcp-settings')
  await dialog.getByRole('button', { name: 'Open Chat Settings', exact: true }).click()

  await expect(dialog).toHaveAccessibleName('Chat Settings')
  await expect(dialog.getByText('Gemini 3.1 Flash Lite', { exact: true })).toBeVisible()
  await expect(dialog.getByText('1.0.0', { exact: true })).toBeVisible()
  await expect(dialog.getByText('0.2.0', { exact: true })).toBeVisible()
  await expect(dialog.getByText('Auto Review · 1 Conversation Waiting', { exact: true })).toBeVisible()
  await expect(dialog.getByText('Learns from completed light conversations one at a time.', { exact: true })).toBeVisible()
  expect(tools).toEqual(['home_info'])
})

test('stages a capability-safe custom color in the same chat sheet before sending once', async ({ page, context }) => {
  const server = new MockChatServer()
  const requests: string[] = []
  await bindChatServer(context, server, 'home-mcp-custom-color')
  await page.addInitScript(() => { window.__homeMcpUrl = '/api/sfenton_home_mcp' })
  await page.route('**/api/sfenton_home_mcp', async (route) => {
    const body = JSON.parse(route.request().postData() ?? '{}') as { id?: number; params?: { arguments?: { text?: string } } }
    const text = body.params?.arguments?.text ?? ''
    requests.push(text)
    const structuredContent = requests.length === 1 ? {
      conversation_id: 'home-mcp-custom-color', status: 'clarification', text: 'What color would you like to set the Office light to?',
      controls: [{
        id: 'office-color', kind: 'color-picker', room: 'Office', rooms: ['Office'], subject: 'Office light',
        palette: ['warm white', 'cool white'], supportsCustomRgb: false, colorMode: 'temperature', entityIds: ['light.office'],
        currentTemperatureKelvin: 4100, minTemperatureKelvin: 2200, maxTemperatureKelvin: 6500,
      }],
      context: { domain: 'lights', roomId: 'office', entityIds: ['light.office'], lightNames: ['Office light'], lastAction: 'color' },
    } : {
      conversation_id: 'home-mcp-custom-color', status: 'success', text: 'I turned the Office light to 5000K.',
      controls: [], context: { domain: 'lights', roomId: 'office', entityIds: ['light.office'], lightNames: ['Office light'], lastAction: 'color' },
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ jsonrpc: '2.0', id: body.id, result: { structuredContent } }) })
  })

  const dialog = await openChat(page, 'home-mcp-custom-color')
  await dialog.getByRole('textbox', { name: 'Chat Message', exact: true }).fill('I want to change the Office light color')
  await dialog.getByRole('button', { name: 'Send Chat Message', exact: true }).click()
  await expect(dialog.getByText('What color would you like to set the Office light to?', { exact: true })).toBeVisible()
  await dialog.getByRole('button', { name: 'Custom', exact: true }).click()
  await expect(dialog.locator('[data-light-temperature-picker="true"]')).toBeVisible()
  await expect(dialog.getByRole('slider', { name: 'Color Temperature', exact: true })).toHaveAttribute('aria-valuenow', '4100')
  await dialog.getByRole('spinbutton', { name: 'Color Temperature', exact: true }).fill('5000')
  await dialog.getByRole('button', { name: 'Back', exact: true }).click()
  await expect(dialog.getByRole('button', { name: 'Custom', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await dialog.getByRole('button', { name: 'Send Color', exact: true }).click()
  await expect(dialog.getByText('I turned the Office light to 5000K.', { exact: true })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Already Sent', exact: true })).toBeDisabled()
  expect(requests).toEqual(['I want to change the Office light color', 'Turn the Office light to 5000K.'])
})

test('reuses the exterior-light wheel and RGB editor for chat custom colors', async ({ page, context }) => {
  const server = new MockChatServer()
  await bindChatServer(context, server, 'home-mcp-rgb-color')
  await page.addInitScript(() => { window.__homeMcpUrl = '/api/sfenton_home_mcp' })
  await page.route('**/api/sfenton_home_mcp', async (route) => {
    const body = JSON.parse(route.request().postData() ?? '{}') as { id?: number }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        jsonrpc: '2.0', id: body.id, result: { structuredContent: {
          conversation_id: 'home-mcp-rgb-color', status: 'clarification', text: 'What color would you like to set the Music Room lights to?',
          controls: [{
            id: 'music-room-color', kind: 'color-picker', room: 'Music Room', rooms: ['Music Room'],
            palette: ['red', 'blue'], supportsCustomRgb: true, colorMode: 'rgb', entityIds: ['light.music_room'],
            currentRgb: [10, 20, 30], minTemperatureKelvin: 2000, maxTemperatureKelvin: 6500,
          }],
          context: { domain: 'lights', roomId: 'music-room', entityIds: ['light.music_room'], lightNames: ['Music Room lights'], lastAction: 'color' },
        } },
      }),
    })
  })

  const dialog = await openChat(page, 'home-mcp-rgb-color')
  await dialog.getByRole('textbox', { name: 'Chat Message', exact: true }).fill('Change the Music Room light color')
  await dialog.getByRole('button', { name: 'Send Chat Message', exact: true }).click()
  await dialog.getByRole('button', { name: 'Custom', exact: true }).click()
  const picker = dialog.locator('[data-light-color-picker="true"]')
  await expect(picker).toBeVisible()
  await expect(picker.getByTestId('color-picker')).toHaveAttribute('data-entity', 'light.music_room')
  await expect(picker.getByRole('slider', { name: 'Custom', exact: true })).toHaveAttribute('aria-valuetext', 'RGB 10, 20, 30')
  await picker.getByRole('spinbutton', { name: 'R channel', exact: true }).fill('255')
  await expect(picker.getByRole('spinbutton', { name: 'R channel', exact: true })).toHaveValue('255')
})

test('reports a definite Home MCP proxy rejection as not sent', async ({ page, context }) => {
  const server = new MockChatServer()
  await bindChatServer(context, server, 'home-mcp-rejected')
  await page.addInitScript(() => { window.__homeMcpUrl = '/api/sfenton_home_mcp' })
  await page.route('**/api/sfenton_home_mcp', async (route) => {
    await route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'origin-not-allowed' }),
    })
  })

  const dialog = await openChat(page, 'home-mcp-rejected')
  await dialog.getByRole('textbox', { name: 'Chat Message', exact: true }).fill('Are the Living Room lights on?')
  await dialog.getByRole('button', { name: 'Send Chat Message', exact: true }).click()

  await expect(dialog.getByText('Not Sent to Assistant', { exact: true })).toBeVisible()
  await expect(dialog.getByText('The reply outcome is unknown', { exact: false })).toHaveCount(0)
})

test('routes app chat through the household Home MCP server', async ({ page, context }) => {
  const server = new MockChatServer()
  await bindChatServer(context, server, 'home-mcp-account')
  await page.addInitScript(() => { window.__homeMcpUrl = '/api/sfenton_home_mcp' })
  await page.route('**/api/sfenton_home_mcp', async (route) => {
    const request = route.request()
    expect(request.headers().authorization).toBe('Bearer mock-ha-access-token')
    const body = JSON.parse(request.postData() ?? '{}') as { id?: number; params?: { arguments?: { text?: string; conversation_id?: string | null } } }
    const text = body.params?.arguments?.text ?? ''
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        jsonrpc: '2.0', id: body.id,
        result: { structuredContent: {
          conversation_id: body.params?.arguments?.conversation_id || 'home-mcp-conversation',
          response: { response_type: 'query_answer', speech: { plain: { speech: `Home MCP answered: ${text}` } } },
        } },
      }),
    })
  })
  const dialog = await openChat(page, 'home-mcp-account')
  await dialog.getByRole('textbox', { name: 'Chat Message', exact: true }).fill('What happened at home?')
  await dialog.getByRole('button', { name: 'Send Chat Message', exact: true }).click()
  await expect(dialog.getByText('Home MCP answered: What happened at home?', { exact: true })).toBeVisible()
  expect(server.calls.some((call) => call.message.type === 'conversation/agent/list')).toBe(false)
  expect(server.calls.some((call) => call.message.type === 'conversation/process')).toBe(false)
})
