import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { MASTER_BEDROOM_WAKE_LIGHT as config } from '../../../constants/wakeLights'
import {
  mockCallServiceCalls, mockEntities, rejectPendingMockWakeCommands, resetMockHass,
  resolvePendingMockWakeCommands, setMockCallServiceOutcome, setMockEntityAttribute,
} from '../../../test/mocks/hakitCoreState'
import { WakeLightModal } from './WakeLightModalContent'
import { createWakeLightAlarm } from './wakeLightContract'
import { useWakeLightController } from './useWakeLightController'

const ENTITY = config.statusEntityId
const renderModal = () => render(<WakeLightModal config={config} onClose={() => undefined} open roomTitle="Master Bedroom" />)

describe('Wake command acceptance and stable optimism', () => {
  beforeEach(resetMockHass)

  it('retains the editor through delayed acceptance and suppresses duplicate saves', async () => {
    setMockCallServiceOutcome('wake_light', 'command', 'pending')
    renderModal()
    fireEvent.click(screen.getByRole('button', { name: 'Add Wake Alarm' }))
    fireEvent.change(screen.getByLabelText('Alarm Name'), { target: { value: 'Retained Draft' } })
    const save = screen.getByRole('button', { name: 'Save' })
    fireEvent.click(save)
    fireEvent.click(save)
    expect(save).toBeDisabled()
    expect(save).toHaveAccessibleName('Save')
    expect(screen.getByLabelText('Alarm Name')).toHaveValue('Retained Draft')
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Add Wake Alarm · Master Bedroom')
    expect(mockCallServiceCalls).toHaveLength(1)
    await act(async () => resolvePendingMockWakeCommands())
    await waitFor(() => expect(screen.getByRole('dialog')).toHaveAccessibleName('Master Bedroom Wake-Light Alarms'))
    expect(screen.getByText('Retained Draft')).toBeInTheDocument()
  })

  it('retains the draft and shows an honest transport error on rejection', async () => {
    setMockCallServiceOutcome('wake_light', 'command', 'pending')
    renderModal()
    fireEvent.click(screen.getByRole('button', { name: 'Add Wake Alarm' }))
    fireEvent.change(screen.getByLabelText('Alarm Name'), { target: { value: 'Keep This Draft' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await act(async () => rejectPendingMockWakeCommands())
    expect(screen.getByLabelText('Alarm Name')).toHaveValue('Keep This Draft')
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Add Wake Alarm · Master Bedroom')
    expect(screen.getByRole('alert')).toHaveTextContent('Home Assistant did not confirm the change.')
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
    expect(JSON.stringify(mockEntities[ENTITY].attributes.alarms)).not.toContain('Keep This Draft')
  })

  it('requires explicit draft replacement after a revision conflict', async () => {
    setMockCallServiceOutcome('wake_light', 'command', 'pending')
    renderModal()
    fireEvent.click(screen.getByRole('button', { name: /Weekday Wake/ }))
    fireEvent.change(screen.getByLabelText('Alarm Name'), { target: { value: 'My Draft' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    act(() => {
      const alarms = mockEntities[ENTITY].attributes.alarms as Record<string, unknown>[]
      setMockEntityAttribute(ENTITY, 'revision', 4)
      setMockEntityAttribute(ENTITY, 'alarms', alarms.map(alarm => alarm.id === 'weekday-wake'
        ? { ...alarm, label: 'Changed Elsewhere', revision: 2 } : alarm))
    })
    await act(async () => resolvePendingMockWakeCommands())
    expect(screen.getByLabelText('Alarm Name')).toHaveValue('My Draft')
    expect(screen.getByRole('alert')).toHaveTextContent('Alarm configuration changed elsewhere.')
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Open Latest Alarm, Replace Draft' }))
    expect(screen.getByLabelText('Alarm Name')).toHaveValue('Changed Elsewhere')
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('keeps object-valued optimistic alarms through unrelated telemetry', async () => {
    setMockCallServiceOutcome('wake_light', 'command', 'pending')
    const { result } = renderHook(() => useWakeLightController(config))
    act(() => { void result.current.saveAlarm(createWakeLightAlarm('new-alarm', 'Optimistic Alarm')) })
    expect(result.current.snapshot.alarms.some(alarm => alarm.id === 'new-alarm')).toBe(true)
    act(() => setMockEntityAttribute(ENTITY, 'progress', 23))
    expect(result.current.snapshot.alarms.some(alarm => alarm.id === 'new-alarm')).toBe(true)
    await act(async () => resolvePendingMockWakeCommands())
    expect(result.current.snapshot.alarms.find(alarm => alarm.id === 'new-alarm')?.revision).toBe(1)
  })

  it.each(['defaults', 'link'] as const)('keeps optimistic %s through unrelated telemetry', async (kind) => {
    setMockCallServiceOutcome('wake_light', 'command', 'pending')
    const { result } = renderHook(() => useWakeLightController(config))
    act(() => {
      if (kind === 'defaults') void result.current.updateDefaults({ ...result.current.snapshot.defaults, rampMinutes: 15 })
      else void result.current.setAlarmLink(['sleepypod:right#monday#06:30'], false)
    })
    act(() => setMockEntityAttribute(ENTITY, 'progress', 24))
    if (kind === 'defaults') expect(result.current.snapshot.defaults.rampMinutes).toBe(15)
    else expect(result.current.snapshot.alarmLinks['sleepypod:right#monday#06:30']).toBe(false)
    await act(async () => rejectPendingMockWakeCommands())
    if (kind === 'defaults') expect(result.current.snapshot.defaults.rampMinutes).toBe(30)
    else expect(result.current.snapshot.alarmLinks['sleepypod:right#monday#06:30']).toBeUndefined()
  })

  it('lets episode-anchored Stop bypass a pending configuration request', async () => {
    setMockEntityAttribute(ENTITY, 'active_occurrences', [{
      alarm_id: 'weekday-wake', occurrence_id: 'active', wake_at: '2030-06-10T06:30:00-07:00',
      phase: 'holding', source_ref: null,
    }])
    setMockCallServiceOutcome('wake_light', 'command', 'pending')
    const { result } = renderHook(() => useWakeLightController(config))
    act(() => { void result.current.updateDefaults({ ...result.current.snapshot.defaults, rampMinutes: 15 }) })
    act(() => { void result.current.endEpisode() })
    expect(mockCallServiceCalls).toHaveLength(2)
    expect(mockCallServiceCalls[1]).toMatchObject({
      serviceData: { operation: 'end_episode', expected_revision: 3, episode_ref: expect.any(String) },
    })
    await act(async () => resolvePendingMockWakeCommands())
    expect(result.current.snapshot.activeOccurrences).toEqual([])
    expect(result.current.error).toBeNull()
  })

  it('queues independent alarm toggles while disabling only the alarm already processing', async () => {
    const alarms = mockEntities[ENTITY].attributes.alarms as Record<string, unknown>[]
    setMockEntityAttribute(ENTITY, 'alarms', [
      ...alarms,
      { ...alarms[0], id: 'weekend-wake', label: 'Weekend Wake', revision: 1, weekdays: ['saturday', 'sunday'] },
    ])
    setMockCallServiceOutcome('wake_light', 'command', 'pending')
    renderModal()
    const nativeToggle = screen.getByRole('switch', { name: 'Turn off Weekday Wake' })
    const otherToggle = screen.getByRole('switch', { name: 'Turn off Weekend Wake' })

    fireEvent.click(nativeToggle)
    expect(nativeToggle).toHaveAttribute('aria-disabled', 'true')
    expect(otherToggle).toHaveAttribute('aria-disabled', 'false')
    expect(screen.getByRole('button', { name: 'Add Wake Alarm' })).toBeEnabled()

    fireEvent.click(otherToggle)
    expect(otherToggle).toHaveAttribute('aria-disabled', 'true')
    expect(mockCallServiceCalls).toHaveLength(1)

    await act(async () => resolvePendingMockWakeCommands())
    await waitFor(() => expect(mockCallServiceCalls).toHaveLength(2))
    expect(screen.getByRole('switch', { name: 'Turn on Weekend Wake' })).toHaveAttribute('aria-disabled', 'true')
    await act(async () => resolvePendingMockWakeCommands())

    await waitFor(() => {
      expect(screen.getByRole('switch', { name: 'Turn on Weekday Wake' })).toHaveAttribute('aria-disabled', 'false')
      expect(screen.getByRole('switch', { name: 'Turn on Weekend Wake' })).toHaveAttribute('aria-disabled', 'false')
    })
  })

  it('uses the configured room ramp for new native drafts', () => {
    setMockEntityAttribute(ENTITY, 'defaults', { ramp_minutes: 15, post_wake_hold_minutes: 5 })
    renderModal()
    fireEvent.click(screen.getByRole('button', { name: 'Add Wake Alarm' }))
    expect(screen.getByLabelText('Alarm Type')).toHaveValue('once')
    expect(screen.getByRole('radio', { name: '15 Minutes' })).toHaveAttribute('aria-checked', 'true')
  })

  it('keeps incompatible contracts read-only without hiding saved alarms', () => {
    setMockEntityAttribute(ENTITY, 'contract_version', 1)
    renderModal()
    expect(screen.getByText('Weekday Wake')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add Wake Alarm' })).toBeDisabled()
    expect(screen.getByRole('alert')).toHaveTextContent('requires an integration update')
    expect(mockCallServiceCalls).toEqual([])
  })

  it('disables Save until an existing alarm changes and disables it again after reversion', () => {
    renderModal()
    fireEvent.click(screen.getByRole('button', { name: /Weekday Wake/ }))
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Weekday Wake · Master Bedroom')
    expect(screen.getByRole('button', { name: 'Delete' })).toBeEnabled()
    const save = screen.getByRole('button', { name: 'Save' })
    const name = screen.getByLabelText('Alarm Name')
    expect(save).toBeDisabled()
    fireEvent.change(name, { target: { value: ' Weekday Wake ' } })
    expect(save).toBeDisabled()
    fireEvent.change(name, { target: { value: 'Changed Wake' } })
    expect(save).toBeEnabled()
    fireEvent.change(name, { target: { value: 'Weekday Wake' } })
    expect(save).toBeDisabled()
  })
})
