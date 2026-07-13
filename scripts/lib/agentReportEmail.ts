import type { EmailMessage, EmailSendOptions, EmailSendResult } from './email'
import { sendEmailMessage } from './email'

export interface AgentReportEmailInput {
  html?: string
  markdown?: string
  subject: string
  text?: string
}

export function renderAgentReportEmailMessage(input: AgentReportEmailInput): EmailMessage {
  const subject = input.subject.trim()
  if (!subject) throw new Error('Agent report email subject is required.')

  const body = input.markdown?.trim() || input.text?.trim() || input.html?.trim()
  if (!body) throw new Error('Agent report email body is required.')

  const reportHtml = input.html?.trim() || markdownToHtml(input.markdown ?? input.text ?? '')
  return {
    html: wrapReportHtml(subject, reportHtml),
    subject,
    text: input.text ?? input.markdown ?? stripHtml(input.html ?? ''),
  }
}

export async function sendAgentReportEmail(
  input: AgentReportEmailInput,
  options: EmailSendOptions = {},
): Promise<EmailSendResult> {
  return sendEmailMessage(renderAgentReportEmailMessage(input), options)
}

function wrapReportHtml(subject: string, reportHtml: string) {
  const bodyTitle = reportBodyTitle(subject)
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
      body { margin: 0; padding: 24px; background: #10151d; color: #ecf3fb; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: 19px; line-height: 1.55; }
      .report { max-width: 900px; margin: 0 auto; background: #171f2b; border: 1px solid #354356; border-radius: 18px; padding: 28px; }
      h1 { margin: 0 0 24px; font-size: 34px; line-height: 1.2; }
      h2 { margin: 30px 0 14px; font-size: 27px; line-height: 1.25; }
      h3 { margin: 26px 0 12px; font-size: 23px; line-height: 1.25; }
      h4, h5, h6 { margin: 22px 0 10px; font-size: 20px; line-height: 1.25; }
      p { margin: 0 0 16px; }
      ul, ol { margin: 0 0 20px 28px; padding: 0; }
      li { margin: 8px 0; }
      code { background: #0d1219; border-radius: 6px; padding: 2px 6px; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 0.9em; }
      pre { background: #0d1219; border: 1px solid #354356; border-radius: 10px; overflow-x: auto; padding: 16px; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 16px; line-height: 1.4; }
      blockquote { margin: 18px 0; padding: 10px 18px; border-left: 5px solid #7aa2d6; color: #c4d0dd; }
      .table-row { margin: 16px 0; padding: 14px 16px; border: 1px solid #354356; border-radius: 10px; background: #111923; }
      @media (max-width: 600px) {
        body { padding: 12px; font-size: 17px; }
        .report { padding: 20px; border-radius: 14px; }
        h1 { font-size: 29px; }
        h2 { font-size: 24px; }
      }
    </style>
  </head>
  <body>
    <main class="report">
      <h1>${inlineMarkdown(bodyTitle)}</h1>
      ${reportHtml}
    </main>
  </body>
</html>`
}

function markdownToHtml(markdown: string) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  const html: string[] = []
  let paragraph: string[] = []
  let inFence = false
  let fenceLines: string[] = []
  type ListState = { indent: number; openItem: boolean; type: 'ol' | 'ul' }
  const lists: ListState[] = []

  const flushParagraph = () => {
    if (paragraph.length === 0) return
    html.push(`<p>${inlineMarkdown(paragraph.join(' '))}</p>`)
    paragraph = []
  }
  const closeList = () => {
    const current = lists.pop()
    if (!current) return
    if (current.openItem) html.push('</li>')
    html.push(`</${current.type}>`)
  }
  const closeLists = () => {
    while (lists.length > 0) closeList()
  }
  const openList = (type: 'ol' | 'ul', indent: number) => {
    html.push(`<${type}>`)
    lists.push({ indent, openItem: false, type })
  }
  const addListItem = (type: 'ol' | 'ul', indent: number, value: string) => {
    flushParagraph()
    if (lists.length === 0) openList(type, indent)
    while (lists.length > 0 && indent < lists.at(-1)!.indent) closeList()

    let current = lists.at(-1)!
    if (indent > current.indent) {
      openList(type, indent)
      current = lists.at(-1)!
    } else if (current.type !== type) {
      closeList()
      openList(type, indent)
      current = lists.at(-1)!
    }
    if (current.openItem) html.push('</li>')
    html.push(`<li>${inlineMarkdown(value)}`)
    current.openItem = true
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const trimmed = line.trim()

    if (trimmed.startsWith('```')) {
      if (inFence) {
        html.push(`<pre><code>${escapeHtml(fenceLines.join('\n'))}</code></pre>`)
        fenceLines = []
        inFence = false
      } else {
        flushParagraph()
        closeLists()
        inFence = true
      }
      continue
    }
    if (inFence) {
      fenceLines.push(line)
      continue
    }
    if (!trimmed) {
      flushParagraph()
      closeLists()
      continue
    }
    if (isTableStart(lines, index)) {
      flushParagraph()
      closeLists()
      const table = parseTable(lines, index)
      html.push(table.html)
      index = table.endIndex
      continue
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(trimmed)
    if (heading) {
      flushParagraph()
      closeLists()
      const level = Math.min(heading[1].length + 1, 6)
      html.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`)
      continue
    }

    const unordered = /^(\s*)[-*]\s+(.+)$/.exec(line)
    if (unordered) {
      addListItem('ul', indentWidth(unordered[1]), unordered[2].trim())
      continue
    }
    const ordered = /^(\s*)\d+\.\s+(.+)$/.exec(line)
    if (ordered) {
      addListItem('ol', indentWidth(ordered[1]), ordered[2].trim())
      continue
    }
    if (trimmed.startsWith('>')) {
      flushParagraph()
      closeLists()
      html.push(`<blockquote>${inlineMarkdown(trimmed.replace(/^>\s?/, ''))}</blockquote>`)
      continue
    }

    closeLists()
    paragraph.push(trimmed)
  }

  if (inFence) html.push(`<pre><code>${escapeHtml(fenceLines.join('\n'))}</code></pre>`)
  flushParagraph()
  closeLists()
  return html.join('\n')
}

function isTableStart(lines: string[], index: number) {
  const current = lines[index]?.trim()
  const next = lines[index + 1]?.trim()
  return Boolean(current?.includes('|') && next && /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(next))
}

function parseTable(lines: string[], startIndex: number) {
  const headers = splitTableRow(lines[startIndex])
  const rows: string[][] = []
  let index = startIndex + 2
  for (; index < lines.length; index += 1) {
    const line = lines[index].trim()
    if (!line || !line.includes('|')) break
    rows.push(splitTableRow(line))
  }

  const titleIndex = tableTitleIndex(headers)
  const html = rows.map((row, rowIndex) => {
    const title = row[titleIndex]?.trim() || `Row ${rowIndex + 1}`
    const bullets = headers.map((header, cellIndex) => ({ header, value: row[cellIndex] ?? '' }))
      .filter(({ value }) => value.trim())
      .map(({ header, value }) => `<li><strong>${inlineMarkdown(header)}</strong>: ${inlineMarkdown(value)}</li>`)
      .join('')
    return `<section class="table-row"><h4>${inlineMarkdown(title)}</h4><ul>${bullets}</ul></section>`
  }).join('')

  return { endIndex: index - 1, html }
}

function tableTitleIndex(headers: string[]) {
  const preferred = ['task', 'work item', 'subject', 'metric', 'file', 'phase']
  const normalized = headers.map((header) => header.trim().toLowerCase())
  for (const name of preferred) {
    const index = normalized.findIndex((header) => header === name || header.includes(name))
    if (index >= 0) return index
  }
  return 0
}

function splitTableRow(row: string) {
  return row.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim())
}

function inlineMarkdown(value: string) {
  let escaped = escapeHtml(value)
  const code: string[] = []
  escaped = escaped.replace(/`([^`]+)`/g, (_match, content: string) => {
    const token = `@@CODE${code.length}@@`
    code.push(`<code>${content}</code>`)
    return token
  })
  escaped = escaped
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\b_([^_]+)_\b/g, '<em>$1</em>')
  code.forEach((content, index) => {
    escaped = escaped.replace(`@@CODE${index}@@`, content)
  })
  return escaped
}

function reportBodyTitle(subject: string) {
  return subject
    .replace(/^HASS Admin Autonomous Agent:\s*/i, '')
    .replace(/\s+[·•]\s+(Accepted|Rejected|Blocked|Needs Attention)$/i, '')
    .trim()
}

function indentWidth(value: string) {
  return value.replace(/\t/g, '    ').length
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function stripHtml(value: string) {
  return value
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
