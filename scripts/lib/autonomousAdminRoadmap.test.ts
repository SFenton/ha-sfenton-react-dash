import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import {
  AUTONOMOUS_ADMIN_CONTEXT_TIER,
  AUTONOMOUS_ADMIN_MODEL,
  AUTONOMOUS_ADMIN_REASONING_EFFORT,
  auditAutonomousAdminRoadmap,
  exactAutonomousAdminTaskTransition,
  transitionAutonomousAdminTask,
  validateAutonomousAdminTodoCoverage,
} from './autonomousAdminRoadmap'

function pendingRoadmap(markdown: string) {
  return markdown.replace(
    /^(\|\s*\d+\s*\|\s*`A\d+[^|]+\|\s*`?[^|]+\|\s*)(accepted|rejected|hard_blocked|superseded)(\s*\|)/gm,
    '$1pending$3',
  )
}

describe('autonomous Admin roadmap', () => {
  it('audits the canonical 13-phase HASS queue with the pinned execution profile', async () => {
    const markdown = await readFile(resolve(process.cwd(), 'docs/autonomous-admin-roadmap.md'), 'utf8')
    const audit = auditAutonomousAdminRoadmap(markdown)

    expect(audit.errors).toEqual([])
    expect(audit.tasks).toHaveLength(13)
    expect(audit.nextTask).toBeUndefined()
    expect(audit.counts).toMatchObject({ accepted: 8, hard_blocked: 4, superseded: 1 })
    expect(audit.profile).toMatchObject({
      contextTier: AUTONOMOUS_ADMIN_CONTEXT_TIER,
      model: AUTONOMOUS_ADMIN_MODEL,
      reasoningEffort: AUTONOMOUS_ADMIN_REASONING_EFFORT,
      todoEntityId: 'todo.groceries',
    })
  })

  it('performs hash-bound task transitions and advances to the next phase', async () => {
    const sourceMarkdown = await readFile(resolve(process.cwd(), 'docs/autonomous-admin-roadmap.md'), 'utf8')
    const markdown = pendingRoadmap(sourceMarkdown)
    const initial = auditAutonomousAdminRoadmap(markdown)
    const inProgressMarkdown = transitionAutonomousAdminTask(
      markdown,
      initial.nextTask!.id,
      'in_progress',
      initial.planHash,
    )
    const inProgress = auditAutonomousAdminRoadmap(inProgressMarkdown)
    const acceptedMarkdown = transitionAutonomousAdminTask(
      inProgressMarkdown,
      inProgress.nextTask!.id,
      'accepted',
      inProgress.planHash,
    )
    const accepted = auditAutonomousAdminRoadmap(acceptedMarkdown)

    expect(inProgress.nextTask?.status).toBe('in_progress')
    expect(accepted.nextTask?.id).toBe('A02-guest-toggle-presence-reset')
  })

  it('detects open HASS Admin items that are not taskized', async () => {
    const markdown = await readFile(resolve(process.cwd(), 'docs/autonomous-admin-roadmap.md'), 'utf8')
    const audit = auditAutonomousAdminRoadmap(markdown)
    const openItems = audit.tasks.map((task) => ({
      status: 'needs_action',
      summary: task.adminTask,
      uid: task.todoUid,
    }))
    openItems.push({ status: 'needs_action', summary: 'New unplanned work', uid: 'new-ha-item' })

    expect(validateAutonomousAdminTodoCoverage(audit, openItems)).toContain(
      'Open HA item "New unplanned work" (new-ha-item) has no roadmap phase.',
    )
  })

  it('fails closed when the roadmap model is changed', async () => {
    const markdown = await readFile(resolve(process.cwd(), 'docs/autonomous-admin-roadmap.md'), 'utf8')
    const audit = auditAutonomousAdminRoadmap(markdown.replace('model: gpt-5.6-sol', 'model: auto'))

    expect(audit.errors).toContain('Execution profile model is "auto", expected "gpt-5.6-sol".')
  })

  it('rejects a phase that changes any roadmap row beyond its selected terminal status', async () => {
    const sourceMarkdown = await readFile(resolve(process.cwd(), 'docs/autonomous-admin-roadmap.md'), 'utf8')
    const markdown = pendingRoadmap(sourceMarkdown)
    const initial = auditAutonomousAdminRoadmap(markdown)
    const inProgress = transitionAutonomousAdminTask(
      markdown,
      'A01-predictive-cooling-heat-devices',
      'in_progress',
      initial.planHash,
    )
    const inProgressAudit = auditAutonomousAdminRoadmap(inProgress)
    const accepted = transitionAutonomousAdminTask(
      inProgress,
      'A01-predictive-cooling-heat-devices',
      'accepted',
      inProgressAudit.planHash,
    )
    const acceptedAudit = auditAutonomousAdminRoadmap(accepted)
    const changedAnotherTask = transitionAutonomousAdminTask(
      accepted,
      'A02-guest-toggle-presence-reset',
      'in_progress',
      acceptedAudit.planHash,
    )

    expect(() => exactAutonomousAdminTaskTransition(
      inProgress,
      changedAnotherTask,
      'A01-predictive-cooling-heat-devices',
      inProgressAudit.planHash,
    )).toThrow('were not exactly one allowed selected-task terminal transition')
  })
})
