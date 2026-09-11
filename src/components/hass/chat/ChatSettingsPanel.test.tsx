import { render, screen } from '@testing-library/react'
import { ChatSettingsPanel, type ChatSystemInfoClient } from './ChatSettingsPanel'

// @covers src/components/hass/chat/chatVersion.ts
describe('ChatSettingsPanel', () => {
  it('shows instrumented versions, queue state, and recent nontechnical improvements', async () => {
    const client: ChatSystemInfoClient = {
      systemInfo: async () => ({
        chatModel: 'Gemini 3.1 Flash Lite',
        mcpVersion: '0.2.4',
        supportedTools: ['lights'],
        queue: { enabled: true, autoPublish: true, pending: 2, processing: false, lastError: null },
        improvements: [{
          version: '0.2.4',
          publishedAt: '2026-09-10T12:00:00.000Z',
          summary: ['Understands a new way to ask for grouped light changes.'],
        }],
      }),
    }

    render(<ChatSettingsPanel client={client} />)

    expect(await screen.findByText('Gemini 3.1 Flash Lite')).toBeVisible()
    expect(screen.getByText('1.0.0')).toBeVisible()
    expect(screen.getByText('0.2.4')).toBeVisible()
    expect(screen.getByText('Auto Review · 2 Conversations Waiting')).toBeVisible()
    expect(screen.getByText('Understands a new way to ask for grouped light changes.')).toBeVisible()
  })
})
