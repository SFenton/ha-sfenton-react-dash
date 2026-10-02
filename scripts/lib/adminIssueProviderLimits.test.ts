import { describe, expect, it } from 'vitest'
import {
  AdminIssueProviderLimitError,
  clearWorkerProviderLimit,
  deferWorkerForProviderLimit,
  detectWorkerProviderLimit,
  recordWorkerProviderLimit,
  workerProviderLimitRetryAt,
  workerProviderPauseUntil,
  workerProvidersPausedUntil,
} from './adminIssueProviderLimits'

const NOW = Date.parse('2026-10-02T05:35:00.000Z')
const lines = (...events: unknown[]) => events.map((event) => JSON.stringify(event)).join('\n')

describe('worker provider limits', () => {
  it('detects Copilot quota and rate-limit session errors from structured events', () => {
    expect(detectWorkerProviderLimit(lines(
      { type: 'session.start', data: {} },
      {
        type: 'session.error',
        data: {
          errorType: 'quota',
          errorCode: 'quota_exceeded',
          message: 'You have exceeded your premium request allowance.',
          statusCode: 402,
        },
      },
      { type: 'result', exitCode: 1 },
    ), NOW)).toEqual({ kind: 'quota', errorCode: 'quota_exceeded', statusCode: 402 })

    expect(detectWorkerProviderLimit(lines({
      type: 'session.error',
      data: { errorType: 'rate_limit', statusCode: 429, retryAfterSeconds: 90 },
    }), NOW)).toEqual({
      kind: 'rate_limit',
      retryAt: '2026-10-02T05:36:30.000Z',
      statusCode: 429,
    })
  })

  it('recognizes the Claude Code weekly-limit stream that blocked issue 301', () => {
    expect(detectWorkerProviderLimit(lines(
      {
        type: 'rate_limit_event',
        rate_limit_info: { status: 'rejected', resetsAt: 1790938800, rateLimitType: 'seven_day' },
      },
      { type: 'result', subtype: 'success', is_error: true, result: 'You\'ve hit your weekly limit' },
    ), NOW)).toEqual({ kind: 'quota', retryAt: '2026-10-02T11:00:00.000Z' })
    expect(detectWorkerProviderLimit(lines({
      type: 'rate_limit_event', rate_limit_info: { status: 'allowed' },
    }), NOW)).toBeUndefined()
  })

  it('ignores ordinary failures and free-text mentions of rate limits', () => {
    expect(detectWorkerProviderLimit(lines(
      { type: 'assistant.message', data: { content: 'Pirate Weather returned 429 rate limit (quota)' } },
      { type: 'session.error', data: { errorType: 'authentication', statusCode: 401 } },
      { type: 'result', exitCode: 1 },
    ), NOW)).toBeUndefined()
    expect(detectWorkerProviderLimit('error: rate limit exceeded\nnot json', NOW)).toBeUndefined()
  })

  it('honors provider reset times within bounds and otherwise backs off by kind', () => {
    expect(workerProviderLimitRetryAt(
      { kind: 'quota', retryAt: '2026-10-02T11:00:00.000Z' }, 1, NOW,
    )).toBe('2026-10-02T11:00:00.000Z')
    expect(workerProviderLimitRetryAt(
      { kind: 'quota', retryAt: '2026-10-02T05:35:01.000Z' }, 1, NOW,
    )).toBe('2026-10-02T05:36:00.000Z')
    expect(workerProviderLimitRetryAt(
      { kind: 'quota', retryAt: '2027-01-01T00:00:00.000Z' }, 1, NOW,
    )).toBe('2026-10-10T05:35:00.000Z')
    expect(workerProviderLimitRetryAt({ kind: 'quota' }, 1, NOW)).toBe('2026-10-02T06:35:00.000Z')
    expect(workerProviderLimitRetryAt({ kind: 'quota' }, 9, NOW)).toBe('2026-10-03T05:35:00.000Z')
    expect(workerProviderLimitRetryAt({ kind: 'rate_limit' }, 1, NOW)).toBe('2026-10-02T05:40:00.000Z')
    expect(workerProviderLimitRetryAt({ kind: 'rate_limit' }, 9, NOW)).toBe('2026-10-02T06:35:00.000Z')
  })

  it('records limits per provider and pauses admission only when both are limited', () => {
    const record = { phase: 'researching' as const, receipts: { workerFailureCount: '1' } as Record<string, string> }
    const other = { phase: 'queued' as const, receipts: {} as Record<string, string> }
    const state = { issues: { a: { uid: 'a', ...record }, b: { uid: 'b', ...other } } }
    state.issues.a.receipts = record.receipts
    state.issues.b.receipts = other.receipts

    expect(new AdminIssueProviderLimitError('copilot', { kind: 'quota' }).message)
      .toBe('Copilot CLI worker reported a usage quota limit')
    expect(new AdminIssueProviderLimitError('claude', { kind: 'rate_limit' }).message)
      .toBe('Claude Code worker reported a rate limit')

    expect(recordWorkerProviderLimit(record, 'copilot', { kind: 'quota' }, NOW))
      .toBe('2026-10-02T06:35:00.000Z')
    expect(recordWorkerProviderLimit(record, 'copilot', { kind: 'quota' }, NOW))
      .toBe('2026-10-02T07:35:00.000Z')
    expect(record.receipts).toMatchObject({
      workerCopilotLimitCount: '2',
      workerCopilotLimitKind: 'quota',
      workerCopilotLimitRetryAt: '2026-10-02T07:35:00.000Z',
    })
    expect(workerProviderPauseUntil(state as never, 'copilot')).toBe(Date.parse('2026-10-02T07:35:00.000Z'))
    expect(workerProviderPauseUntil(state as never, 'claude')).toBe(0)
    // Claude Code is still available, so admission continues on the fallback.
    expect(workerProvidersPausedUntil(state as never, NOW)).toBe(0)

    recordWorkerProviderLimit(other, 'claude', { kind: 'quota', retryAt: '2026-10-02T11:00:00.000Z' }, NOW)
    expect(workerProvidersPausedUntil(state as never, NOW)).toBe(Date.parse('2026-10-02T07:35:00.000Z'))
    expect(workerProvidersPausedUntil(state as never, Date.parse('2026-10-02T08:00:00.000Z'))).toBe(0)

    clearWorkerProviderLimit(record, 'copilot')
    expect(record.receipts).toEqual({ workerFailureCount: '1' })
    expect(workerProvidersPausedUntil(state as never, NOW)).toBe(0)
    expect(() => workerProviderPauseUntil({
      issues: { c: { uid: 'c', receipts: { workerClaudeLimitRetryAt: 'soon' } } },
    } as never, 'claude')).toThrow('invalid claude limit retry time')
  })

  it('requeues without consuming repair attempts until the earliest provider resets', () => {
    const record = { phase: 'researching' as const, receipts: { workerFailureCount: '1' } as Record<string, string> }
    const state = { issues: { a: { uid: 'a', receipts: record.receipts } } }
    recordWorkerProviderLimit(record, 'copilot', { kind: 'quota' }, NOW)
    recordWorkerProviderLimit(record, 'claude', { kind: 'quota', retryAt: '2026-10-02T11:00:00.000Z' }, NOW)
    const error = new AdminIssueProviderLimitError('claude', { kind: 'quota' })
    expect(deferWorkerForProviderLimit(state as never, record, error, NOW)).toBe('2026-10-02T06:35:00.000Z')
    expect(record.phase).toBe('queued')
    expect(record.receipts).toMatchObject({
      workerCopilotLimitCount: '1',
      workerClaudeLimitCount: '1',
      workerFailureCount: '1',
      workerRetryAfter: '2026-10-02T06:35:00.000Z',
    })

    // A worker that could not start Claude Code waits for Copilot to reset.
    const fallbackUnavailable = { phase: 'researching' as const, receipts: {} as Record<string, string> }
    recordWorkerProviderLimit(fallbackUnavailable, 'copilot', { kind: 'rate_limit' }, NOW)
    expect(deferWorkerForProviderLimit(
      { issues: { f: { uid: 'f', receipts: fallbackUnavailable.receipts } } } as never,
      fallbackUnavailable,
      new AdminIssueProviderLimitError('copilot', { kind: 'rate_limit' }),
      NOW,
    )).toBe('2026-10-02T05:40:00.000Z')

    const paused = { phase: 'paused' as const, receipts: {} as Record<string, string> }
    deferWorkerForProviderLimit(
      { issues: {} } as never,
      paused,
      new AdminIssueProviderLimitError('copilot', { kind: 'rate_limit' }),
      NOW,
    )
    expect(paused.phase).toBe('paused')
    expect(paused.receipts.workerRetryAfter).toBe('2026-10-02T05:40:00.000Z')
  })
})
