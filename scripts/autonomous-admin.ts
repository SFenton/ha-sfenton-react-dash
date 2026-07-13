#!/usr/bin/env tsx
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import {
  auditAutonomousAdminRoadmap,
  transitionAutonomousAdminTask,
  validateAutonomousAdminTodoCoverage,
  type AutonomousAdminStatus,
} from './lib/autonomousAdminRoadmap'
import { HassAdminTodoClient } from './lib/hassAdminTodo'
import { loadRuntimeEnvironment } from './lib/runtimeEnv'

const args = parseArgs(process.argv.slice(2))
const command = args.positionals[0] ?? 'audit'
const roadmapPath = resolve(args.values.roadmap ?? 'docs/autonomous-admin-roadmap.md')

if (command === 'audit' || command === 'next') {
  const audit = auditAutonomousAdminRoadmap(await readFile(roadmapPath, 'utf8'))
  console.log(JSON.stringify({
    command,
    counts: audit.counts,
    errors: audit.errors,
    nextTask: audit.nextTask,
    planHash: audit.planHash,
    profile: audit.profile,
    roadmapPath,
    taskCount: audit.tasks.length,
  }, null, 2))
  if (audit.errors.length > 0) process.exitCode = 2
  else if (command === 'next' && !audit.nextTask) process.exitCode = 3
} else if (command === 'transition') {
  const markdown = await readFile(roadmapPath, 'utf8')
  const updated = transitionAutonomousAdminTask(
    markdown,
    requiredValue(args.values, 'task-id'),
    statusValue(requiredValue(args.values, 'status')),
    requiredValue(args.values, 'expect-plan-hash'),
  )
  await writeFile(roadmapPath, updated, 'utf8')
  const audit = auditAutonomousAdminRoadmap(updated)
  console.log(JSON.stringify({
    command,
    nextTask: audit.nextTask,
    planHash: audit.planHash,
    reason: args.values.reason,
    taskId: args.values['task-id'],
  }, null, 2))
} else if (command === 'verify-hass' || command === 'sync-descriptions') {
  loadRuntimeEnvironment({ emailEnvPath: args.values['email-env'] })
  const audit = auditAutonomousAdminRoadmap(await readFile(roadmapPath, 'utf8'))
  if (!audit.profile || audit.errors.length > 0) {
    throw new Error(`Roadmap audit failed:\n- ${audit.errors.join('\n- ')}`)
  }
  const client = new HassAdminTodoClient()
  const items = await client.getItems(audit.profile.todoEntityId)
  const openItems = items.filter((item) => item.status === 'needs_action')
  const coverageErrors = validateAutonomousAdminTodoCoverage(audit, openItems)

  if (command === 'sync-descriptions' && coverageErrors.length === 0) {
    let updated = 0
    for (const task of audit.tasks) {
      const item = openItems.find((candidate) => candidate.uid === task.todoUid)
      if (!item) continue
      const description = taskDescription(task.phase, task.work, task.acceptanceGate)
      if (item.description === description) continue
      await client.updateDescription(audit.profile.todoEntityId, task.todoUid, description)
      updated += 1
    }
    console.log(JSON.stringify({ command, openItemCount: openItems.length, updated }, null, 2))
  } else {
    console.log(JSON.stringify({
      command,
      coverageErrors,
      openItemCount: openItems.length,
      roadmapTaskCount: audit.tasks.length,
    }, null, 2))
    if (coverageErrors.length > 0) process.exitCode = 4
  }
} else {
  throw new Error(`Unknown command "${command}". Use audit, next, transition, verify-hass, or sync-descriptions.`)
}

function taskDescription(phase: string, work: string, acceptanceGate: string) {
  return `Autonomous phase ${phase}. Work: ${plainText(work)} Acceptance: ${plainText(acceptanceGate)}`
}

function plainText(value: string) {
  return value.replace(/<br\s*\/?>/gi, ' ').replace(/\s+/g, ' ').trim()
}

function statusValue(value: string): AutonomousAdminStatus {
  if (!['pending', 'in_progress', 'accepted', 'rejected', 'hard_blocked', 'superseded'].includes(value)) {
    throw new Error(`Invalid status "${value}".`)
  }
  return value as AutonomousAdminStatus
}

function requiredValue(values: Record<string, string>, key: string) {
  const value = values[key]
  if (!value) throw new Error(`Missing --${key} <value>.`)
  return value
}

function parseArgs(argv: string[]) {
  const values: Record<string, string> = {}
  const positionals: string[] = []
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (!token.startsWith('--')) {
      positionals.push(token)
      continue
    }
    const key = token.slice(2)
    const value = argv[index + 1]
    if (!value || value.startsWith('--')) throw new Error(`Missing value for --${key}.`)
    if (values[key] !== undefined) throw new Error(`Duplicate --${key}.`)
    values[key] = value
    index += 1
  }
  return { positionals, values }
}
