import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MASTER_BEDROOM_WAKE_LIGHT } from '../../../constants/wakeLights'
import { mockCallServiceCalls, mockEntities, resetMockHass, setMockEntityAttribute } from '../../../test/mocks/hakitCoreState'
import { SleepypodAlarmWakeLightToggle, WakeLightModal, WakeLightModalPreload, WakeLightTile } from './WakeLightModalContent'

async function clickTab(name: string) {
  fireEvent.pointerDown(screen.getByRole('tab', { name }))
  fireEvent.click(screen.getByRole('tab', { name }))
  await waitFor(() => expect(screen.getByRole('tab', { name })).toHaveAttribute('aria-selected', 'true'))
}

const ENTITY = MASTER_BEDROOM_WAKE_LIGHT.statusEntityId

describe('WakeLightModalContent', () => {
  beforeEach(() => {
    resetMockHass()
  })

  it('opens one mounted sheet and creates a one-time wake alarm through wake_light.command', async () => {
    render(
      <WakeLightModal
        config={MASTER_BEDROOM_WAKE_LIGHT}
        onClose={() => undefined}
        open
        roomTitle="Master Bedroom"
      />,
    )

    const dialog = await screen.findByRole('dialog', { name: 'Master Bedroom Wake-Light Alarms' })
    expect(within(dialog).getByRole('tablist', { name: 'Wake-Light Alarms modal sections' })).toBeInTheDocument()
    expect(within(dialog).getByText('Weekday Wake')).toBeInTheDocument()
    expect(within(dialog).getByText('Early Flight')).toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Add Wake Alarm' }))
    const editor = await screen.findByRole('dialog', { name: 'Add Wake Alarm · Master Bedroom' })
    expect(editor).toBe(dialog)
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    expect(within(editor).getByLabelText('Alarm Name')).toHaveFocus()
    expect(within(editor).getByLabelText('Alarm Type')).toHaveValue('once')

    fireEvent.change(within(editor).getByLabelText('Alarm Name'), { target: { value: 'Airport Morning' } })
    fireEvent.change(within(editor).getByLabelText('Alarm Date'), { target: { value: '2031-01-15' } })
    fireEvent.change(within(editor).getByLabelText('Wake Time'), { target: { value: '05:15' } })
    fireEvent.click(within(editor).getByRole('radio', { name: '15 Minutes' }))
    fireEvent.click(within(editor).getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(within(dialog).getByText('Airport Morning')).toBeInTheDocument())
    expect(mockCallServiceCalls.at(-1)).toMatchObject({
      domain: 'wake_light',
      service: 'command',
      serviceData: {
        alarm: {
          date: '2031-01-15',
          kind: 'once',
          label: 'Airport Morning',
          local_time: '05:15',
          ramp_minutes: 15,
        },
        operation: 'upsert_alarm',
        profile_id: 'master-bedroom',
      },
    })
  })

  it('updates defaults and exposes fail-closed vacation status', async () => {
    setMockEntityAttribute('sensor.master_bedroom_wake_light', 'safety', {
      light_state: 'ready',
      light_target_name: 'Master Bedroom Lights',
      occupancy_state: 'unknown',
      pbl_state: 'ready',
      vacation_state: 'unknown',
    })

    setMockEntityAttribute('sensor.master_bedroom_wake_light', 'current_blockers', ['vacation_not_off'])

    render(
      <WakeLightModal
        config={MASTER_BEDROOM_WAKE_LIGHT}
        onClose={() => undefined}
        open
        roomTitle="Master Bedroom"
      />,
    )

    const dialog = await screen.findByRole('dialog', { name: 'Master Bedroom Wake-Light Alarms' })
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Vacation Mode · Runs Blocked')
    await clickTab('Defaults')
    expect(await screen.findByText(/After full brightness, Wake Light prevents ordinary presence lighting/)).toHaveTextContent('5 min')
    expect(screen.queryByRole('combobox', { name: 'Post-Wake Hold Time' })).not.toBeInTheDocument()
    expect(screen.queryByText('Light Ramp Duration')).not.toBeInTheDocument()
    const ramp = screen.getByRole('radiogroup', { name: 'Light Ramp Duration' })
    expect(within(ramp).getAllByRole('radio').map(option => option.textContent)).toEqual([
      'None', '5 Minutes', '10 Minutes', '15 Minutes', '30 Minutes',
    ])
    fireEvent.click(within(ramp).getByRole('radio', { name: '15 Minutes' }))
    await waitFor(() => {
      expect(mockCallServiceCalls.at(-1)).toMatchObject({
        domain: 'wake_light',
        service: 'command',
        serviceData: {
          defaults: {
            post_wake_hold_minutes: 5,
            ramp_minutes: 15,
          },
          operation: 'update_defaults',
        },
      })
    })

    const hold = screen.getByRole('radiogroup', { name: 'Post-Wake Hold Time' })
    expect(within(hold).getAllByRole('radio').map(option => option.textContent)).toEqual([
      '5 Minutes', '10 Minutes', '15 Minutes', '30 Minutes',
    ])
    expect(within(hold).queryByRole('radio', { name: 'None' })).not.toBeInTheDocument()
    fireEvent.click(within(hold).getByRole('radio', { name: '30 Minutes' }))
    await waitFor(() => {
      expect(mockCallServiceCalls.at(-1)).toMatchObject({
        domain: 'wake_light',
        service: 'command',
        serviceData: {
          defaults: {
            post_wake_hold_minutes: 30,
            ramp_minutes: 15,
          },
          operation: 'update_defaults',
        },
      })
    })

    expect(screen.queryByRole('tab', { name: 'Wake Light Overview' })).not.toBeInTheDocument()
  })

  it('keeps hold-duration controls read-only on contract 5', async () => {
    setMockEntityAttribute(ENTITY, 'contract_version', 5)
    render(
      <WakeLightModal
        config={MASTER_BEDROOM_WAKE_LIGHT}
        onClose={() => undefined}
        open
        roomTitle="Master Bedroom"
      />,
    )

    await clickTab('Defaults')
    const hold = await screen.findByRole('radiogroup', { name: 'Post-Wake Hold Time' })
    expect(within(hold).getAllByRole('radio').every(option => (option as HTMLButtonElement).disabled)).toBe(true)
    expect(screen.getByRole('alert')).toHaveTextContent('Update the Wake Light integration')
  })

  it('unlinks one source alarm day through the same wake-light command path', async () => {
    render(
      <SleepypodAlarmWakeLightToggle
        config={MASTER_BEDROOM_WAKE_LIGHT}
        localTime="06:30"
        side="right"
        weekday="monday"
      />,
    )

    const link = screen.getByRole('switch', { name: 'Turn off Use Room Wake Lights' })
    expect(link).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(link)

    await waitFor(() => {
      expect(mockCallServiceCalls.at(-1)).toMatchObject({
        domain: 'wake_light',
        service: 'command',
        serviceData: {
          enabled: false,
          link_keys: ['sleepypod:right#monday#06:30'],
          operation: 'link_alarm',
          profile_id: 'master-bedroom',
        },
      })
    })
  })

  it('links each source alarm row and reports the aggregate side state', async () => {
    setMockEntityAttribute(ENTITY, 'alarms', [{
      date: null, enabled: true, id: 'sp-right-0630', kind: 'weekly', label: 'SleepyPod Right Wake',
      local_time: '06:30', ramp_minutes: 30, revision: 0, source: 'sleepypod',
      source_label: 'SleepyPod Right', source_ref: 'sleepypod:right', weekdays: ['monday', 'tuesday'],
    }])
    render(
      <WakeLightModal
        config={MASTER_BEDROOM_WAKE_LIGHT}
        onClose={() => undefined}
        onOpenSource={() => undefined}
        open
        roomTitle="Master Bedroom"
      />,
    )

    const dialog = await screen.findByRole('dialog', { name: 'Master Bedroom Wake-Light Alarms' })
    expect(within(dialog).getByText("Steph's Alarms")).toBeInTheDocument()
    const link = within(dialog).getByRole('switch', { name: 'Turn off Use room wake lights for the SleepyPod Right Wake alarm' })
    expect(link).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(link)

    await waitFor(() => {
      expect(mockCallServiceCalls).toHaveLength(1)
      expect(mockCallServiceCalls[0]).toMatchObject({
        serviceData: {
          enabled: false,
          link_keys: ['sleepypod:right#monday#06:30', 'sleepypod:right#tuesday#06:30'],
          operation: 'link_alarm',
        },
      })
    })
  })

  it('enables and disables individual native alarms without a global schedule toggle', async () => {
    render(
      <WakeLightModal
        config={MASTER_BEDROOM_WAKE_LIGHT}
        onClose={() => undefined}
        open
        roomTitle="Master Bedroom"
      />,
    )

    expect(screen.queryByText(/Schedule · (?:Enabled|Paused)/)).not.toBeInTheDocument()
    fireEvent.click(await screen.findByRole('switch', { name: 'Turn off Weekday Wake' }))
    await waitFor(() => expect(mockCallServiceCalls.at(-1)).toMatchObject({
      domain: 'wake_light',
      service: 'command',
      serviceData: {
        alarm: { enabled: false, id: 'weekday-wake' },
        operation: 'upsert_alarm',
      },
    }))
  })

  it('removes native Snooze while keeping immediate room Stop', async () => {
    mockEntities['sensor.master_bedroom_wake_light'].state = 'ramping'
    setMockEntityAttribute('sensor.master_bedroom_wake_light', 'commanded_brightness_pct', 42)
    setMockEntityAttribute('sensor.master_bedroom_wake_light', 'active_occurrences', [{
      alarm_id: 'weekday-wake',
      occurrence_id: 'occurrence-1',
      phase: 'ramping',
      progress: 42,
      snoozed_until: null,
      source_ref: null,
      wake_at: '2030-06-10T06:30:00-07:00',
    }])

    render(
      <WakeLightModal
        config={MASTER_BEDROOM_WAKE_LIGHT}
        onClose={() => undefined}
        open
        roomTitle="Master Bedroom"
      />,
    )

    expect(await screen.findByRole('heading', { name: 'Active Wake-Light Controls' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Snooze' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Stop Wake-Light Episode' }))
    await waitFor(() => expect(mockCallServiceCalls.filter((call) => call.domain === 'wake_light')).toHaveLength(1))

    const calls = mockCallServiceCalls.filter((call) => call.domain === 'wake_light')
    expect(calls[0]).toMatchObject({
      returnResponse: true,
      serviceData: {
        expected_revision: 3,
        operation: 'end_episode',
      },
    })
  })

  it('uses two tabs and omits the removed hero status tiles', async () => {
    render(
      <WakeLightModal
        config={MASTER_BEDROOM_WAKE_LIGHT}
        onClose={() => undefined}
        open
        roomTitle="Master Bedroom"
      />,
    )

    const tabs = await screen.findAllByRole('tab')
    expect(tabs.map(tab => tab.textContent)).toEqual(['Wake Alarms', 'Defaults'])
    expect(screen.queryByText('Next Wake Alarm')).not.toBeInTheDocument()
    expect(screen.queryByText('Light Ramp Duration')).not.toBeInTheDocument()
    expect(screen.queryByText(/Home Assistant gradually brightens/)).not.toBeInTheDocument()
    expect(document.querySelector('[data-scroll-region="wake-light-hero"]')).not.toBeInTheDocument()
  })

  it('uses the no-active modal subtitle when every alarm is disabled', async () => {
    const alarms = mockEntities[ENTITY].attributes.alarms as Record<string, unknown>[]
    setMockEntityAttribute(ENTITY, 'alarms', alarms.map(alarm => ({ ...alarm, enabled: false })))
    setMockEntityAttribute(ENTITY, 'next_wake_at', null)

    render(
      <WakeLightModal
        config={MASTER_BEDROOM_WAKE_LIGHT}
        onClose={() => undefined}
        open
        roomTitle="Master Bedroom"
      />,
    )

    const dialog = await screen.findByRole('dialog', { name: 'Master Bedroom Wake-Light Alarms' })
    expect(within(dialog).getByText('No Active Wake-Light Alarms')).toBeInTheDocument()
  })

  it('uses the numeric alarm date and shared next-alarm pattern in the tile and modal', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2030-06-10T08:00:00-07:00'))
    setMockEntityAttribute(ENTITY, 'next_wake_at', '2030-06-11T06:00:00-07:00')
    setMockEntityAttribute(ENTITY, 'next_ramp_minutes', 30)

    try {
      const tile = render(<WakeLightTile config={MASTER_BEDROOM_WAKE_LIGHT} onOpen={() => undefined} />)
      expect(screen.getByRole('button', {
        name: /Wake-Light Alarms Next Alarm: 6\/11 6:00 AM • 30 min ramp/,
      })).toBeInTheDocument()
      tile.unmount()

      render(<WakeLightModal config={MASTER_BEDROOM_WAKE_LIGHT} onClose={() => undefined} open roomTitle="Master Bedroom" />)
      const dialog = screen.getByRole('dialog', { name: 'Master Bedroom Wake-Light Alarms' })
      expect(within(dialog).getByText('Next Alarm: 6/11 6:00 AM • 30 min ramp')).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not describe an enabled linked alarm as none enabled when no next occurrence is available', async () => {
    setMockEntityAttribute('sensor.master_bedroom_wake_light', 'alarms', [{
      date: null,
      enabled: true,
      id: 'source-right',
      kind: 'weekly',
      label: 'SleepyPod Right Wake',
      local_time: '07:00',
      ramp_minutes: 30,
      revision: 0,
      source: 'sleepypod',
      source_label: 'SleepyPod Right',
      source_ref: 'sleepypod:right',
      weekdays: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday'],
    }])
    setMockEntityAttribute('sensor.master_bedroom_wake_light', 'next_wake_at', null)
    setMockEntityAttribute('sensor.master_bedroom_wake_light', 'next_ramp_minutes', null)

    render(
      <WakeLightModal
        config={MASTER_BEDROOM_WAKE_LIGHT}
        onClose={() => undefined}
        open
        roomTitle="Master Bedroom"
      />,
    )

    const dialog = await screen.findByRole('dialog', { name: 'Master Bedroom Wake-Light Alarms' })
    expect(within(dialog).getByText('Idle')).toBeInTheDocument()
    expect(within(dialog).queryByText('Alarms · None Enabled')).not.toBeInTheDocument()
  })

  it('keeps actionable blockers in the alarms flow without exposing backend codes', async () => {
    setMockEntityAttribute(
      'sensor.master_bedroom_wake_light',
      'current_blockers',
      ['source_identity_unavailable'],
    )
    setMockEntityAttribute(
      'sensor.master_bedroom_wake_light',
      'failures',
      ['source_identity_unavailable'],
    )

    render(
      <WakeLightModal
        config={MASTER_BEDROOM_WAKE_LIGHT}
        onClose={() => undefined}
        open
        roomTitle="Master Bedroom"
      />,
    )

    expect(await screen.findByRole('alert')).toHaveTextContent('linked alarm schedule')
    expect(screen.queryByText('source_identity_unavailable')).not.toBeInTheDocument()
  })

  it('renders inert preload geometry without commands or timers', () => {
    const timeoutSpy = vi.spyOn(window, 'setTimeout')
    const callsBefore = mockCallServiceCalls.length
    const { container } = render(<WakeLightModalPreload config={MASTER_BEDROOM_WAKE_LIGHT} />)

    expect(container.querySelector('[data-wake-light-preload="master-bedroom"]')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(mockCallServiceCalls).toHaveLength(callsBefore)
    expect(timeoutSpy).not.toHaveBeenCalled()
    timeoutSpy.mockRestore()
  })

  it('keeps the unavailable tile useful as a modal entry point', () => {
    mockEntities['sensor.master_bedroom_wake_light'].state = 'unavailable'
    const onOpen = vi.fn()
    render(<WakeLightTile config={MASTER_BEDROOM_WAKE_LIGHT} onOpen={onOpen} />)

    fireEvent.click(screen.getByRole('button', { name: 'Wake-Light Alarms Setup · Unavailable' }))
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('enables Save only while the alarm editor holds outstanding changes', async () => {
    render(
      <WakeLightModal
        config={MASTER_BEDROOM_WAKE_LIGHT}
        onClose={() => undefined}
        open
        roomTitle="Master Bedroom"
      />,
    )

    const dialog = await screen.findByRole('dialog', { name: 'Master Bedroom Wake-Light Alarms' })
    fireEvent.click(within(dialog).getByText('Weekday Wake'))
    const editor = await screen.findByRole('dialog', { name: 'Weekday Wake · Master Bedroom' })
    expect(within(editor).getByRole('button', { name: 'Save' })).toBeDisabled()

    fireEvent.change(within(editor).getByLabelText('Alarm Name'), { target: { value: 'Weekday Wakeup' } })
    await waitFor(() => expect(within(editor).getByRole('button', { name: 'Save' })).toBeEnabled())

    fireEvent.change(within(editor).getByLabelText('Alarm Name'), { target: { value: 'Weekday Wake' } })
    await waitFor(() => expect(within(editor).getByRole('button', { name: 'Save' })).toBeDisabled())
  })

  it('requires native confirmation before deleting the saved wake alarm', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    render(
      <WakeLightModal
        config={MASTER_BEDROOM_WAKE_LIGHT}
        onClose={() => undefined}
        open
        roomTitle="Master Bedroom"
      />,
    )

    const dialog = await screen.findByRole('dialog', { name: 'Master Bedroom Wake-Light Alarms' })
    fireEvent.click(within(dialog).getByText('Weekday Wake'))
    const editor = await screen.findByRole('dialog', { name: 'Weekday Wake · Master Bedroom' })
    const deleteButton = within(editor).getByRole('button', { name: 'Delete' })
    fireEvent.change(within(editor).getByLabelText('Wake Time'), { target: { value: '06:40' } })

    fireEvent.click(deleteButton)
    expect(confirm).toHaveBeenCalledWith('Delete alarm set for 6:30 AM on Weekdays?')
    expect(mockCallServiceCalls).toEqual([])
    expect(editor).toHaveAccessibleName('Weekday Wake · Master Bedroom')
    expect(within(editor).getByLabelText('Wake Time')).toHaveValue('06:40')

    fireEvent.click(deleteButton)
    await waitFor(() => expect(mockCallServiceCalls).toHaveLength(1))
    expect(mockCallServiceCalls[0]).toMatchObject({
      domain: 'wake_light',
      service: 'command',
      serviceData: {
        alarm_id: 'weekday-wake',
        operation: 'delete_alarm',
        profile_id: 'master-bedroom',
      },
    })
    expect(confirm).toHaveBeenCalledTimes(2)
    confirm.mockRestore()
  })

  it('shows the integration-unavailable recovery alert only once', async () => {
    mockEntities['sensor.master_bedroom_wake_light'].state = 'unavailable'
    setMockEntityAttribute('sensor.master_bedroom_wake_light', 'command_available', false)
    setMockEntityAttribute('sensor.master_bedroom_wake_light', 'current_blockers', ['integration_unavailable'])

    render(
      <WakeLightModal
        config={MASTER_BEDROOM_WAKE_LIGHT}
        onClose={() => undefined}
        open
        roomTitle="Master Bedroom"
      />,
    )

    const dialog = await screen.findByRole('dialog', { name: 'Master Bedroom Wake-Light Alarms' })
    expect(within(dialog).getAllByRole('alert')).toHaveLength(1)
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Wake-light controls are unavailable.')
  })

  describe('cross-bed wake alarm creation', () => {
    function bedProvisioningStub() {
      return {
        createAlarms: vi.fn(),
        targets: [
          { available: true, side: 'left' as const, slots: [], title: "Stephen's Bed" },
          { available: true, side: 'right' as const, slots: [{ day: 'monday' as const, time: '07:30' }], title: "Steph's Bed" },
        ],
      }
    }

    async function openAddEditor(bedProvisioning: ReturnType<typeof bedProvisioningStub>) {
      render(
        <WakeLightModal
          bedProvisioning={bedProvisioning}
          config={MASTER_BEDROOM_WAKE_LIGHT}
          onClose={() => undefined}
          open
          roomTitle="Master Bedroom"
        />,
      )
      const dialog = await screen.findByRole('dialog', { name: 'Master Bedroom Wake-Light Alarms' })
      fireEvent.click(within(dialog).getByRole('button', { name: 'Add Wake Alarm' }))
      return screen.findByRole('dialog', { name: 'Add Wake Alarm · Master Bedroom' })
    }

    async function openScheduledAddEditor(bedProvisioning: ReturnType<typeof bedProvisioningStub>) {
      const editor = await openAddEditor(bedProvisioning)
      fireEvent.change(within(editor).getByLabelText('Alarm Type'), { target: { value: 'weekly' } })
      fireEvent.change(within(editor).getByLabelText('Wake Time'), { target: { value: '07:30' } })
      return editor
    }

    it('starts both bed toggles off without rendering recurring bed guidance', async () => {
      // Steph's side already holds a linked 07:30 Monday bed alarm; the toggle must still read off.
      const editor = await openScheduledAddEditor(bedProvisioningStub())
      expect(within(editor).getByRole('switch', { name: "Turn on Add to Stephen's Bed" })).toHaveAttribute('aria-checked', 'false')
      expect(within(editor).getByRole('switch', { name: "Turn on Add to Steph's Bed" })).toHaveAttribute('aria-checked', 'false')
      expect(within(editor).queryByText(/Adds this wake time/)).not.toBeInTheDocument()
    })

    it('renders Light Ramp Duration as a separator in the alarm editor', async () => {
      const editor = await openAddEditor(bedProvisioningStub())
      const heading = within(editor).getByRole('heading', { name: 'Light Ramp Duration' })
      expect(heading.parentElement?.querySelector('span[aria-hidden="true"]')).toBeInTheDocument()
      expect(within(editor).getByRole('radiogroup', { name: 'Light Ramp Duration' })).toBeInTheDocument()
    })

    it('shows both bed toggles immediately for one-time naps and scheduled alarms', async () => {
      const editor = await openAddEditor(bedProvisioningStub())
      const stephen = within(editor).getByRole('switch', { name: "Turn on Add to Stephen's Bed" })
      const steph = within(editor).getByRole('switch', { name: "Turn on Add to Steph's Bed" })
      expect(stephen).toHaveAttribute('aria-checked', 'false')
      expect(steph).toHaveAttribute('aria-checked', 'false')
      expect(stephen).toHaveAttribute('aria-disabled', 'false')
      expect(steph).toHaveAttribute('aria-disabled', 'false')
      expect(within(editor).queryByText(/Adds a temporary bed alarm/)).not.toBeInTheDocument()

      fireEvent.change(within(editor).getByLabelText('Alarm Type'), { target: { value: 'weekly' } })
      expect(stephen).toHaveAttribute('aria-disabled', 'false')
      expect(steph).toHaveAttribute('aria-disabled', 'false')
    })

    it("sends a selected bed side with a one-time nap alarm for Home Assistant to own", async () => {
      const bedProvisioning = bedProvisioningStub()
      const editor = await openAddEditor(bedProvisioning)
      fireEvent.click(within(editor).getByRole('switch', { name: "Turn on Add to Stephen's Bed" }))
      fireEvent.click(within(editor).getByRole('button', { name: 'Save' }))

      await waitFor(() => expect(mockCallServiceCalls.some(call => (
        call.serviceData?.operation === 'upsert_alarm'
        && JSON.stringify(call.serviceData?.alarm).includes('bed_sides')
      ))).toBe(true))
      const upsert = mockCallServiceCalls.find(call => call.serviceData?.operation === 'upsert_alarm')
      expect(upsert).toMatchObject({ serviceData: { alarm: { bed_sides: ['left'], kind: 'once' } } })
      expect(bedProvisioning.createAlarms).not.toHaveBeenCalled()
    })

    it("turns a bed alarm's wake light off for a side left off, without disturbing the other side", async () => {
      const bedProvisioning = bedProvisioningStub()
      const editor = await openScheduledAddEditor(bedProvisioning)
      fireEvent.click(within(editor).getByRole('button', { name: 'Save' }))

      await waitFor(() => expect(mockCallServiceCalls.some(call => call.serviceData?.operation === 'link_alarm')).toBe(true))
      const linkCalls = mockCallServiceCalls.filter(call => call.serviceData?.operation === 'link_alarm')
      expect(linkCalls).toHaveLength(1)
      expect(linkCalls[0]).toMatchObject({
        serviceData: { enabled: false, link_keys: ['sleepypod:right#monday#07:30'], operation: 'link_alarm' },
      })
      // Stephen's side holds no 07:30 alarm, so nothing of his is ever written.
      expect(JSON.stringify(linkCalls[0])).not.toContain('sleepypod:left')
      expect(bedProvisioning.createAlarms).not.toHaveBeenCalled()
    })

    it("adds the wake time to Stephen's bed for every drafted weekday", async () => {
      const bedProvisioning = bedProvisioningStub()
      const editor = await openScheduledAddEditor(bedProvisioning)
      fireEvent.click(within(editor).getByRole('switch', { name: "Turn on Add to Stephen's Bed" }))
      fireEvent.click(within(editor).getByRole('button', { name: 'Save' }))

      await waitFor(() => expect(bedProvisioning.createAlarms).toHaveBeenCalledWith(
        'left', ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'], '07:30',
      ))
      expect(bedProvisioning.createAlarms).toHaveBeenCalledTimes(1)
    })

    it("adds only the missing weekdays to Steph's bed rather than duplicating one", async () => {
      const bedProvisioning = bedProvisioningStub()
      const editor = await openScheduledAddEditor(bedProvisioning)
      fireEvent.click(within(editor).getByRole('switch', { name: "Turn on Add to Steph's Bed" }))
      fireEvent.click(within(editor).getByRole('button', { name: 'Save' }))

      await waitFor(() => expect(bedProvisioning.createAlarms).toHaveBeenCalledWith(
        'right', ['tuesday', 'wednesday', 'thursday', 'friday'], '07:30',
      ))
      // Her existing linked Monday alarm already drives the wake light, so it is left alone.
      expect(mockCallServiceCalls.some(call => call.serviceData?.operation === 'link_alarm')).toBe(false)
    })
  })
})
// @covers src/components/core/iconPaths.ts
// @covers src/constants/wakeLights.ts
// @covers src/i18n/index.ts
// @covers src/i18n/locales/en/modals/wakeLight.json
// @covers src/i18n/resources.ts
