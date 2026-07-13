#!/usr/bin/env tsx
import { readFile } from 'node:fs/promises'
import { sendAgentReportEmail } from './lib/agentReportEmail'
import { getEmailSendReadiness } from './lib/email'
import { loadRuntimeEnvironment } from './lib/runtimeEnv'

const args = parseArgs(process.argv.slice(2))
loadRuntimeEnvironment({ emailEnvPath: args.values['email-env'] })

if (args.flags.has('check-config')) {
  const send = args.flags.has('send')
  const readiness = getEmailSendReadiness({}, { dryRun: !send, enabled: send })
  console.log(JSON.stringify(readiness, null, 2))
  if (args.flags.has('require-send') && !readiness.readyToSend) process.exitCode = 78
} else {
  const subject = requiredValue(args.values, 'subject')
  const markdown = args.values['input-md']
    ? await readFile(args.values['input-md'], 'utf8')
    : requiredValue(args.values, 'body-md')
  const send = args.flags.has('send')
  const result = await sendAgentReportEmail(
    { markdown, subject },
    {
      dryRun: !send,
      enabled: send,
      outboxDir: args.values['outbox-dir'],
      subjectPrefix: args.values['subject-prefix'],
    },
  )
  console.log(JSON.stringify(result, null, 2))
}

function requiredValue(values: Record<string, string>, key: string) {
  const value = values[key]
  if (!value) throw new Error(`Missing --${key} <value>.`)
  return value
}

function parseArgs(argv: string[]) {
  const flags = new Set<string>()
  const values: Record<string, string> = {}
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (!token.startsWith('--')) continue
    const key = token.slice(2)
    const value = argv[index + 1]
    if (value && !value.startsWith('--')) {
      values[key] = value
      index += 1
    } else {
      flags.add(key)
    }
  }
  return { flags, values }
}
