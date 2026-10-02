import { describe, expect, it } from 'vitest'
import {
  type AdminIssueProgressRecord,
  appendDeployEvent,
  desiredManagedLabels,
  desiredStatusLabel,
  formatProgressComment,
  formatTriageComment,
  issueMetadataScope,
  labelSyncDue,
  normalizeDeployEventReason,
  planLabelChanges,
} from './adminIssueLabels'
import type { AdminIssueDeployEvent, AdminIssueTriage } from './adminIssueController'

const triage: AdminIssueTriage = {
  kind: 'bug',
  areas: ['dashboard', 'lighting'],
  summary: 'The light control reports an incorrect state.',
  acceptance: ['The state reflects Home Assistant updates.', 'The control remains usable.'],
  confidence: 0.85,
  mediaReviewed: ['before.png'],
}

describe('admin issue labels', () => {
  it('plans managed label updates without touching unmanaged labels', () => {
    expect(planLabelChanges(
      ['bug', 'status:queued', 'type:feature', 'area:old', 'team:home'],
      desiredManagedLabels('researching', triage),
    )).toEqual({
      add: ['area:dashboard', 'area:lighting', 'status:researching', 'type:bug'],
      remove: ['area:old', 'status:queued', 'type:feature'],
    })
  })

  it('does not plan changes when managed labels already match', () => {
    const desired = desiredManagedLabels('ready-for-pr', triage)
    expect(desiredStatusLabel('ready-for-pr')).toBe('status:ready-for-pr')
    expect(planLabelChanges(['bug', ...desired], desired)).toEqual({ add: [], remove: [] })
  })

  it('renders a stable structured triage receipt', () => {
    const comment = formatTriageComment('todo-1', triage)
    expect(comment).toContain('admin-issue-controller:todo-1:triage')
    expect(comment).toContain('**Kind:** `bug`')
    expect(comment).toContain('`dashboard`, `lighting`')
    expect(comment).toContain('85%')
    expect(comment).toContain('- [ ] The state reflects Home Assistant updates.')
    expect(comment).toContain('- before.png')
  })

  it('deduplicates adjacent deploy events and caps history', () => {
    const event: AdminIssueDeployEvent = {
      at: '2026-10-02T10:00:00.000Z',
      decision: 'deployed',
      reason: 'forward',
      toSha: 'a'.repeat(40),
      runId: 12,
    }
    expect(appendDeployEvent([event], { ...event, at: '2026-10-02T10:01:00.000Z' })).toEqual([event])
    const capped = appendDeployEvent(
      [{ ...event, decision: 'hold', reason: 'waiting' }, event],
      { ...event, decision: 'validated', reason: 'production verified' },
      2,
    )
    expect(capped).toEqual([
      event,
      { ...event, decision: 'validated', reason: 'production verified' },
    ])
  })

  it('renders phase, worker, pull request, merge, and deployment progress', () => {
    const record: AdminIssueProgressRecord = {
      uid: 'todo-1',
      phase: 'deploying',
      workerRuns: 2,
      repairAttempts: 1,
      receipts: { lastWorkerProvider: 'copilot' },
      pr: { number: 44, url: 'https://example.test/pr/44' },
      provenance: {
        kind: 'active',
        merge: { mergeSha: 'b'.repeat(40) },
      },
      deployHistory: [{
        at: '2026-10-02T10:00:00.000Z',
        decision: 'hold',
        reason: 'waiting for deployment',
        runId: 12,
        url: 'https://example.test/run/12',
      }],
      updatedAt: '2026-10-02T10:02:00.000Z',
    }
    const comment = formatProgressComment(record)
    expect(comment).toContain('admin-issue-controller:todo-1:progress')
    expect(comment).toContain('**Phase:** deploying')
    expect(comment).toContain('**Last worker provider:** copilot')
    expect(comment).toContain('https://example.test/pr/44 (merged)')
    expect(comment).toContain('`' + 'b'.repeat(40) + '`')
    expect(comment).toContain('[run #12](https://example.test/run/12)')
  })
})

describe('issueMetadataScope', () => {
  it('skips historical completed and paused records until they were synced', () => {
    expect(issueMetadataScope({ phase: 'completed', receipts: {} })).toEqual({ labels: false, progress: false })
    expect(issueMetadataScope({ phase: 'paused', receipts: {} })).toEqual({ labels: true, progress: false })
    expect(issueMetadataScope({ phase: 'researching', receipts: {} })).toEqual({ labels: true, progress: true })
  })

  it('keeps syncing records that already carry metadata receipts', () => {
    expect(issueMetadataScope({
      phase: 'completed',
      receipts: { progressCommentHash: 'a', syncedLabels: 'status:deploying' },
    })).toEqual({ labels: true, progress: true })
  })
})

describe('deploy event reasons', () => {
  it('normalizes empty and oversized reasons to the persisted limit', () => {
    expect(normalizeDeployEventReason('  ')).toBe('No reason reported')
    const long = normalizeDeployEventReason('x'.repeat(24_000))
    expect(long).toHaveLength(1_000)
    expect(long.endsWith('…')).toBe(true)
    const [event] = appendDeployEvent(undefined, {
      at: '2026-10-02T10:00:00.000Z',
      decision: 'failed',
      reason: 'y'.repeat(5_000),
    })
    expect(event.reason).toHaveLength(1_000)
  })
})

describe('labelSyncDue', () => {
  const nowMs = Date.parse('2026-10-02T12:00:00.000Z')

  it('rechecks when the desired set changes or the last check is stale', () => {
    expect(labelSyncDue({}, 'status:queued', nowMs)).toBe(true)
    expect(labelSyncDue({ syncedLabels: 'status:queued', syncedLabelsAt: '2026-10-02T11:30:00.000Z' }, 'status:blocked', nowMs)).toBe(true)
    expect(labelSyncDue({ syncedLabels: 'status:queued', syncedLabelsAt: '2026-10-02T10:59:00.000Z' }, 'status:queued', nowMs)).toBe(true)
    expect(labelSyncDue({ syncedLabels: 'status:queued' }, 'status:queued', nowMs)).toBe(true)
  })

  it('skips the remote read while a matching check is fresh', () => {
    expect(labelSyncDue({ syncedLabels: 'status:queued', syncedLabelsAt: '2026-10-02T11:30:00.000Z' }, 'status:queued', nowMs)).toBe(false)
  })
})
