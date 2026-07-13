import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import nodemailer from 'nodemailer'

export type EmailAddress = string | string[]

export interface EmailMessage {
  from?: string
  html: string
  subject: string
  text?: string
  to?: EmailAddress
}

export interface EmailSendOptions {
  dryRun?: boolean
  enabled?: boolean
  outboxDir?: string
  subjectPrefix?: string
}

export interface EmailSendResult {
  dryRun: boolean
  messageId?: string
  outboxHtmlPath?: string
  outboxJsonPath?: string
  reason?: string
  recipientCount: number
  sent: boolean
  subject: string
}

export interface EmailSendReadiness {
  deliveryMode: 'disabled' | 'outbox' | 'smtp'
  dryRun: boolean
  enabled: boolean
  missing: string[]
  outboxDir: string
  readyToSend: boolean
  recipientCount: number
  smtpHostPresent: boolean
  smtpPasswordPresent: boolean
  smtpPort: number
  smtpSecure: boolean
  smtpUserPresent: boolean
}

interface ResolvedEmailMessage {
  from: string
  html: string
  subject: string
  text: string
  to: string[]
}

export function getEmailSendReadiness(
  message: Pick<EmailMessage, 'from' | 'to'> = {},
  options: EmailSendOptions = {},
): EmailSendReadiness {
  const from = message.from?.trim() || emailEnv('FROM')
  const recipients = parseRecipients(message.to ?? emailEnv('TO') ?? '')
  const dryRun = options.dryRun ?? emailEnv('DRY_RUN') !== 'false'
  const enabled = options.enabled ?? emailEnv('ENABLED') === 'true'
  const smtpHost = emailEnv('SMTP_HOST')
  const smtpPort = Number(emailEnv('SMTP_PORT') ?? 465)
  const smtpUser = emailEnv('SMTP_USER') || from
  const smtpPassword = emailEnv('SMTP_PASSWORD')
  const missing: string[] = []

  if (!from) missing.push('sender')
  if (recipients.length === 0) missing.push('recipient')
  if (!dryRun) {
    if (!enabled) missing.push('HASS_AUTONOMY_EMAIL_ENABLED=true')
    if (!smtpHost) missing.push('SMTP host')
    if (!Number.isInteger(smtpPort) || smtpPort <= 0) missing.push('valid SMTP port')
    if (!smtpUser) missing.push('SMTP user')
    if (!smtpPassword) missing.push('SMTP password')
  }

  const readyToSend = !dryRun && missing.length === 0
  return {
    deliveryMode: readyToSend ? 'smtp' : dryRun ? 'outbox' : 'disabled',
    dryRun,
    enabled,
    missing,
    outboxDir: resolveOutboxDir(options.outboxDir),
    readyToSend,
    recipientCount: recipients.length,
    smtpHostPresent: Boolean(smtpHost),
    smtpPasswordPresent: Boolean(smtpPassword),
    smtpPort,
    smtpSecure: emailEnv('SMTP_SECURE') !== 'false',
    smtpUserPresent: Boolean(smtpUser),
  }
}

export async function sendEmailMessage(
  message: EmailMessage,
  options: EmailSendOptions = {},
): Promise<EmailSendResult> {
  const resolved = resolveEmailMessage(message, options.subjectPrefix)
  const dryRun = options.dryRun ?? emailEnv('DRY_RUN') !== 'false'
  if (dryRun) {
    const outbox = await writeDryRunEmail(resolved, options.outboxDir)
    return {
      dryRun: true,
      recipientCount: resolved.to.length,
      sent: false,
      subject: resolved.subject,
      ...outbox,
      reason: 'dry_run',
    }
  }

  const enabled = options.enabled ?? emailEnv('ENABLED') === 'true'
  if (!enabled) throw new Error('HASS_AUTONOMY_EMAIL_ENABLED is not true; refusing SMTP delivery.')

  const host = emailEnv('SMTP_HOST')
  const port = Number(emailEnv('SMTP_PORT') ?? 465)
  const user = emailEnv('SMTP_USER') || resolved.from
  const password = emailEnv('SMTP_PASSWORD')
  if (!host) throw new Error('SMTP host is required.')
  if (!Number.isInteger(port) || port <= 0) throw new Error('SMTP port must be a positive integer.')
  if (!user) throw new Error('SMTP user is required.')
  if (!password) throw new Error('SMTP password is required.')

  const transport = nodemailer.createTransport({
    auth: { pass: password, user },
    host,
    port,
    secure: emailEnv('SMTP_SECURE') !== 'false',
  })
  const result = await transport.sendMail({
    from: resolved.from,
    html: resolved.html,
    subject: resolved.subject,
    text: resolved.text,
    to: resolved.to,
  })

  return {
    dryRun: false,
    messageId: result.messageId,
    recipientCount: resolved.to.length,
    sent: true,
    subject: resolved.subject,
  }
}

function resolveEmailMessage(message: EmailMessage, subjectPrefix?: string): ResolvedEmailMessage {
  const from = message.from?.trim() || emailEnv('FROM')
  const to = parseRecipients(message.to ?? emailEnv('TO') ?? '')
  const subject = prefixSubject(message.subject.trim(), subjectPrefix)
  if (!from) throw new Error('Email sender is required.')
  if (to.length === 0) throw new Error('Email recipient is required.')
  if (!subject) throw new Error('Email subject is required.')
  if (!message.html.trim()) throw new Error('Email HTML body is required.')
  return {
    from,
    html: message.html,
    subject,
    text: message.text ?? htmlToText(message.html),
    to,
  }
}

async function writeDryRunEmail(
  message: ResolvedEmailMessage,
  outboxDir?: string,
): Promise<Pick<EmailSendResult, 'outboxHtmlPath' | 'outboxJsonPath'>> {
  const dir = resolveOutboxDir(outboxDir)
  await mkdir(dir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const basename = `${stamp}-${slug(message.subject)}`
  const outboxHtmlPath = path.join(dir, `${basename}.html`)
  const outboxJsonPath = path.join(dir, `${basename}.json`)
  await Promise.all([
    writeFile(outboxHtmlPath, message.html, 'utf8'),
    writeFile(outboxJsonPath, JSON.stringify({
      htmlPath: outboxHtmlPath,
      recipientCount: message.to.length,
      subject: message.subject,
      text: message.text,
    }, null, 2), 'utf8'),
  ])
  return { outboxHtmlPath, outboxJsonPath }
}

function emailEnv(suffix: string) {
  return process.env[`HASS_AUTONOMY_EMAIL_${suffix}`]?.trim()
    || process.env[`DAY_TRADER_EMAIL_${suffix}`]?.trim()
}

function parseRecipients(input: EmailAddress) {
  const values = Array.isArray(input) ? input : input.split(',')
  return values.map((value) => value.trim()).filter(Boolean)
}

function prefixSubject(subject: string, prefix?: string) {
  const normalizedPrefix = prefix?.trim()
  if (!normalizedPrefix || subject.startsWith(normalizedPrefix)) return subject
  return `${normalizedPrefix} ${subject}`
}

function resolveOutboxDir(outboxDir?: string) {
  return outboxDir ?? emailEnv('OUTBOX_DIR') ?? path.join(process.cwd(), '.autonomous/outbox')
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'email'
}

function htmlToText(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
