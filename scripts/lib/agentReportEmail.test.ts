import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { sendAgentReportEmail } from './agentReportEmail'
import { getEmailSendReadiness } from './email'

describe('autonomous Admin phase email', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('renders a mobile-readable dry-run report without SMTP traffic', async () => {
    const outbox = await mkdtemp(join(tmpdir(), 'hass-admin-email-'))
    vi.stubEnv('HASS_AUTONOMY_EMAIL_FROM', 'agent@example.com')
    vi.stubEnv('HASS_AUTONOMY_EMAIL_TO', 'operator@example.com')

    try {
      const result = await sendAgentReportEmail({
        markdown: '## Outcome\n\n- **Status:** Accepted\n- Completed safely.',
        subject: 'HASS Admin Autonomous Agent: Phase 1 - Example · Accepted',
      }, {
        dryRun: true,
        outboxDir: outbox,
      })

      expect(result).toMatchObject({ dryRun: true, sent: false })
      const html = await readFile(result.outboxHtmlPath!, 'utf8')
      expect(html).toContain('<h1>Phase 1 - Example</h1>')
      expect(html).toContain('<strong>Status:</strong> Accepted')
    } finally {
      await rm(outbox, { force: true, recursive: true })
    }
  })

  it('reports redacted SMTP readiness through the shared day-trader configuration fallback', () => {
    vi.stubEnv('DAY_TRADER_EMAIL_ENABLED', 'true')
    vi.stubEnv('DAY_TRADER_EMAIL_FROM', 'agent@example.com')
    vi.stubEnv('DAY_TRADER_EMAIL_TO', 'operator@example.com')
    vi.stubEnv('DAY_TRADER_EMAIL_SMTP_HOST', 'smtp.example.com')
    vi.stubEnv('DAY_TRADER_EMAIL_SMTP_PORT', '465')
    vi.stubEnv('DAY_TRADER_EMAIL_SMTP_USER', 'agent@example.com')
    vi.stubEnv('DAY_TRADER_EMAIL_SMTP_PASSWORD', 'secret')

    expect(getEmailSendReadiness({}, { dryRun: false, enabled: true })).toMatchObject({
      deliveryMode: 'smtp',
      readyToSend: true,
      recipientCount: 1,
      smtpPasswordPresent: true,
    })
  })
})
