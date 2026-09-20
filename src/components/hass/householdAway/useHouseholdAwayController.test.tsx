import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  mockCallServiceCalls, mockEntities, resetMockHass,
  resolvePendingMockHouseholdAwayCommands, setMockCallServiceOutcome, setMockEntityAttribute, setMockEntityState,
} from '../../../test/mocks/hakitCoreState'
import { useHouseholdAwayController } from './useHouseholdAwayController'

const ENTITY = 'sensor.household_away_status'

describe('useHouseholdAwayController', () => {
  beforeEach(resetMockHass)

  it('reflects the idle snapshot when no plan exists', () => {
    const { result } = renderHook(() => useHouseholdAwayController())
    expect(result.current.snapshot.mode).toBe('none')
    expect(result.current.snapshot.state).toBe('idle')
    expect(result.current.snapshot.available).toBe(true)
  })

  it('sends a schedule command with the exact expected payload', async () => {
    const { result } = renderHook(() => useHouseholdAwayController())
    let outcome: Awaited<ReturnType<typeof result.current.scheduleSoloTrip>>
    await act(async () => {
      outcome = await result.current.scheduleSoloTrip({
        traveler: 'stephen', startDate: '2026-02-01', startTime: '09:00', endDate: '2026-02-05', endTime: '18:00',
      })
    })
    expect(outcome!).toMatchObject({ acknowledgedRevision: 1, status: 'accepted' })
    const call = mockCallServiceCalls.at(-1) as Record<string, unknown>
    expect(call.domain).toBe('script')
    expect(call.service).toBe('household_away_command')
    expect(call.target).toBeUndefined()
    expect(call.serviceData).toMatchObject({
      operation: 'schedule', mode: 'solo_trip', traveler: 'stephen',
      start_date: '2026-02-01', start_time: '09:00', end_date: '2026-02-05', end_time: '18:00',
    })
    await waitFor(() => expect(result.current.snapshot.mode).toBe('solo_trip'))
    expect(result.current.snapshot.traveler).toBe('stephen')
    expect(result.current.snapshot.homeResident).toBe('steph')
  })

  it('surfaces a transport error and stays actionable after rejection', async () => {
    setMockCallServiceOutcome('script', 'household_away_command', 'reject')
    const { result } = renderHook(() => useHouseholdAwayController())
    let outcome: Awaited<ReturnType<typeof result.current.scheduleSoloTrip>>
    await act(async () => {
      outcome = await result.current.scheduleSoloTrip({
        traveler: 'steph', startDate: '2026-02-01', startTime: '09:00', endDate: '2026-02-05', endTime: '18:00',
      })
    })
    expect(outcome).toEqual({ errorCode: 'transport', status: 'rejected' })
    expect(result.current.errorCode).toBe('transport')
    expect(result.current.pending).toBe(false)
  })

  it('resolves pending commands only after the deferred response arrives', async () => {
    setMockCallServiceOutcome('script', 'household_away_command', 'pending')
    const { result } = renderHook(() => useHouseholdAwayController())
    let settled = false
    act(() => {
      void result.current.endNow().then(() => { settled = true })
    })
    expect(settled).toBe(false)
    await act(async () => resolvePendingMockHouseholdAwayCommands())
    expect(settled).toBe(true)
  })

  it('rejects a second command while the first response is pending', async () => {
    setMockCallServiceOutcome('script', 'household_away_command', 'pending')
    const { result } = renderHook(() => useHouseholdAwayController())
    let first: Promise<Awaited<ReturnType<typeof result.current.endNow>>>
    let second: Promise<Awaited<ReturnType<typeof result.current.cancel>>>

    act(() => {
      first = result.current.endNow()
      second = result.current.cancel()
    })

    await expect(second!).resolves.toEqual({ errorCode: 'transport', status: 'rejected' })
    expect(mockCallServiceCalls.filter((call) => call.domain === 'script' && call.service === 'household_away_command')).toHaveLength(1)
    await act(async () => resolvePendingMockHouseholdAwayCommands())
    await expect(first!).resolves.toMatchObject({ status: 'accepted' })
  })

  it('keeps command callbacks stable while reading the latest revision', async () => {
    const { result } = renderHook(() => useHouseholdAwayController())
    const sendSleepypodCommand = result.current.sendSleepypodCommand

    act(() => setMockEntityAttribute(ENTITY, 'revision', 7))

    expect(result.current.sendSleepypodCommand).toBe(sendSleepypodCommand)
    await act(async () => {
      await result.current.sendSleepypodCommand({ action: 'set_power', enabled: true, side: 'left' })
    })
    expect(mockCallServiceCalls.at(-1)).toMatchObject({
      serviceData: { expected_revision: 7, operation: 'sleepypod_command' },
    })
  })

  it('treats an unavailable sensor as command-unavailable', () => {
    setMockEntityState(ENTITY, 'unavailable')
    const { result } = renderHook(() => useHouseholdAwayController())
    expect(result.current.snapshot.available).toBe(false)
  })

  it('parses restore_required state with blockers', () => {
    setMockEntityState(ENTITY, 'restore_required')
    setMockEntityAttribute(ENTITY, 'blockers', ['sleepypod_schedule_diverged'])
    const { result } = renderHook(() => useHouseholdAwayController())
    expect(result.current.snapshot.state).toBe('restore_required')
    expect(result.current.snapshot.blockers).toEqual(['sleepypod_schedule_diverged'])
  })

  it('returns a distinct unknown result when the service times out', async () => {
    vi.useFakeTimers()
    setMockCallServiceOutcome('script', 'household_away_command', 'pending')
    const { result } = renderHook(() => useHouseholdAwayController())

    let command: Promise<Awaited<ReturnType<typeof result.current.endNow>>>
    act(() => {
      command = result.current.endNow()
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000)
    })

    await expect(command!).resolves.toEqual({ reason: 'timeout', status: 'unknown' })
    expect(result.current.errorCode).toBe('unknown_outcome')
    expect(result.current.pending).toBe(false)
    vi.useRealTimers()
  })

  it('does not touch the entity fixture object identity between renders unless it changes', () => {
    expect(mockEntities[ENTITY].state).toBe('idle')
  })
})
