// @covers src/components/core/ModalTabNav.tsx
// @covers src/components/hass/VacuumCard.tsx
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { VACUUMS } from '../../constants/portedDashboard'
import { mockEntities, mockCallServiceCalls, resetMockHass, setMockCallServiceOutcome, setMockEntityState } from '../../test/mocks/hakitCoreState'
import { VACUUM_COMMAND_NONE, VACUUM_COMMAND_NORMAL, VACUUM_COMMAND_RESTRICTED } from './vacuumStatus'
import { VacuumRoomSourceModalContent } from './VacuumCard'
import { vacuumModalTabsForMode, vacuumRuntimeMode } from './vacuumModalRuntime'

const mainFloorVacuum = VACUUMS.find((vacuum) => vacuum.title === 'Main Floor')

if (!mainFloorVacuum) throw new Error('Expected Main Floor vacuum fixture')
if (!mainFloorVacuum.dockControls) throw new Error('Expected Main Floor dock controls fixture')

const mainFloorDockControls = mainFloorVacuum.dockControls

function setMainFloorRuntime({
  error = 'No error',
  state,
  statusFlag = 'none',
}: {
  error?: string
  state: string
  statusFlag?: string
}) {
  mockEntities[mainFloorVacuum.entityId].state = state
  mockEntities[mainFloorVacuum.errorEntityId].state = error
  mockEntities[mainFloorVacuum.statusFlagEntityId].state = statusFlag
}

function setMainFloorDockStatus(state: string) {
  mockEntities[mainFloorDockControls.dockStatusEntityId].state = state
}

function renderMainFloorRoomSource() {
  return render(<VacuumRoomSourceModalContent vacuum={mainFloorVacuum} />)
}

function visibleTabs() {
  return screen.getAllByRole('tab').map((tab) => tab.getAttribute('aria-label'))
}

function selectedTab() {
  return screen.getAllByRole('tab').find((tab) => tab.getAttribute('aria-selected') === 'true') ?? null
}

function tabbableTabs() {
  return screen.getAllByRole('tab').filter((tab) => tab.tabIndex === 0)
}

async function settleAnimationFrame() {
  await act(async () => {
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()))
  })
}

function mockReducedMotion(matches: boolean) {
  const original = window.matchMedia
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      addEventListener: vi.fn(),
      addListener: vi.fn(),
      dispatchEvent: vi.fn(),
      matches: query === '(prefers-reduced-motion: reduce)' ? matches : false,
      media: query,
      onchange: null,
      removeEventListener: vi.fn(),
      removeListener: vi.fn(),
    })),
  })
  return () => {
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: original })
  }
}

describe('VacuumCard runtime mode', () => {
  it.each([
    ['docked normal', { commandPolicyMode: VACUUM_COMMAND_NORMAL, displayState: 'docked', liveError: '', liveStatusFlag: 'none' }, 'full'],
    ['idle normal', { commandPolicyMode: VACUUM_COMMAND_NORMAL, displayState: 'idle', liveError: '', liveStatusFlag: 'none' }, 'full'],
    ['error normal without low battery', { commandPolicyMode: VACUUM_COMMAND_NORMAL, displayState: 'error', liveError: 'Brush stuck', liveStatusFlag: 'none' }, 'full'],
    ['cleaning normal', { commandPolicyMode: VACUUM_COMMAND_NORMAL, displayState: 'cleaning', liveError: '', liveStatusFlag: 'none' }, 'minimal'],
    ['paused normal', { commandPolicyMode: VACUUM_COMMAND_NORMAL, displayState: 'paused', liveError: '', liveStatusFlag: 'none' }, 'minimal'],
    ['returning normal', { commandPolicyMode: VACUUM_COMMAND_NORMAL, displayState: 'returning', liveError: '', liveStatusFlag: 'none' }, 'minimal'],
    ['error low battery', { commandPolicyMode: VACUUM_COMMAND_NORMAL, displayState: 'error', liveError: 'Low battery', liveStatusFlag: 'none' }, 'minimal'],
    ['docked resumable', { commandPolicyMode: VACUUM_COMMAND_NORMAL, displayState: 'docked', liveError: '', liveStatusFlag: 'resumable' }, 'minimal'],
    ['idle resumable', { commandPolicyMode: VACUUM_COMMAND_NORMAL, displayState: 'idle', liveError: '', liveStatusFlag: 'resumable' }, 'minimal'],
    ['restricted docked', { commandPolicyMode: VACUUM_COMMAND_RESTRICTED, displayState: 'docked', liveError: '', liveStatusFlag: 'none' }, 'minimal'],
    ['restricted idle', { commandPolicyMode: VACUUM_COMMAND_RESTRICTED, displayState: 'idle', liveError: '', liveStatusFlag: 'none' }, 'minimal'],
    ['none unavailable', { commandPolicyMode: VACUUM_COMMAND_NONE, displayState: 'unavailable', liveError: 'unavailable', liveStatusFlag: 'unavailable' }, 'minimal'],
    ['none unknown', { commandPolicyMode: VACUUM_COMMAND_NONE, displayState: 'unknown', liveError: 'unavailable', liveStatusFlag: 'unavailable' }, 'minimal'],
  ])('classifies %s as %s', (_label, snapshot, expected) => {
    expect(vacuumRuntimeMode(snapshot)).toBe(expected)
  })

  it('keeps full and minimal tab order capability-filtered from the shared runtime mode', () => {
    expect(vacuumModalTabsForMode(mainFloorVacuum, 'full').map((tab) => tab.label)).toEqual([
      'Controls',
      'Rooms',
      'Auto-Clean',
      'Actions',
      'Info',
    ])
    expect(vacuumModalTabsForMode(mainFloorVacuum, 'minimal').map((tab) => tab.label)).toEqual([
      'Controls',
      'Auto-Clean',
      'Info',
    ])
    expect(vacuumModalTabsForMode(mainFloorVacuum, 'minimal', 'cleaning').map((tab) => tab.label)).toEqual([
      'Controls',
      'Auto-Clean',
      'Actions',
      'Info',
    ])
  })
})

describe('VacuumRoomSourceModalContent', () => {
  beforeEach(() => {
    resetMockHass()
    setMainFloorRuntime({ state: 'docked' })
    setMainFloorDockStatus('idle')
    window.__vacuumModalPreview?.setMode('live')
  })

  afterEach(() => {
    window.__vacuumModalPreview?.setMode('live')
    vi.unstubAllEnvs()
  })

  it('shows full tabs and setup controls for a normal startable snapshot', () => {
    renderMainFloorRoomSource()

    expect(visibleTabs()).toEqual(['Controls', 'Rooms', 'Auto-Clean', 'Actions', 'Info'])

    const controlsPane = screen.getByRole('group', { name: 'Main Floor controls, rooms, auto-clean, actions, info' })
    expect(within(controlsPane).getByRole('button', { name: 'Rooms' })).toBeInTheDocument()
    expect(within(controlsPane).getByRole('button', { name: 'Area' })).toBeInTheDocument()
    expect(within(controlsPane).getByRole('button', { name: 'Clean' })).toBeInTheDocument()
    expect(within(controlsPane).getByRole('combobox', { name: /Mode Vacuum/i })).toBeInTheDocument()
    expect(within(controlsPane).getByRole('combobox', { name: /Fan Balanced/i })).toBeInTheDocument()
    expect(within(controlsPane).getByRole('heading', { name: 'Power Settings' })).toBeInTheDocument()
  })

  it('switches to minimal tabs, hides setup and power controls, and preserves runtime actions', () => {
    setMainFloorRuntime({ state: 'cleaning' })
    renderMainFloorRoomSource()

    expect(visibleTabs()).toEqual(['Controls', 'Auto-Clean', 'Info'])
    expect(screen.queryByRole('tab', { name: 'Rooms' })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Actions' })).not.toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Info' })).toBeInTheDocument()

    const controlsPane = screen.getByRole('group', { name: 'Main Floor controls, auto-clean, info' })
    expect(within(controlsPane).queryByRole('button', { name: 'Rooms' })).not.toBeInTheDocument()
    expect(within(controlsPane).queryByRole('button', { name: 'Area' })).not.toBeInTheDocument()
    expect(within(controlsPane).queryByRole('button', { name: 'Clean' })).not.toBeInTheDocument()
    expect(within(controlsPane).queryByRole('button', { name: 'Start Area Clean' })).not.toBeInTheDocument()
    expect(within(controlsPane).queryByRole('combobox', { name: /Mode /i })).not.toBeInTheDocument()
    expect(within(controlsPane).queryByRole('combobox', { name: /Fan /i })).not.toBeInTheDocument()
    expect(within(controlsPane).queryByRole('combobox', { name: /Water /i })).not.toBeInTheDocument()
    expect(within(controlsPane).queryByRole('heading', { name: 'Power Settings' })).not.toBeInTheDocument()
    expect(within(controlsPane).getByRole('button', { name: 'Pause' })).toBeInTheDocument()
    expect(within(controlsPane).getByRole('button', { name: 'Stop' })).toBeInTheDocument()
  })

  it('adds minimal Actions only for an active dock runtime action', () => {
    setMainFloorDockStatus('cleaning')
    renderMainFloorRoomSource()

    expect(visibleTabs()).toEqual(['Controls', 'Auto-Clean', 'Actions', 'Info'])
    expect(screen.queryByRole('tab', { name: 'Rooms' })).not.toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Actions' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Info' })).toBeInTheDocument()
  })

  it('surfaces Stop Dock Clean only in minimal Actions and calls the existing stop service', async () => {
    setMainFloorDockStatus('cleaning')
    renderMainFloorRoomSource()

    const controlsPane = screen.getByRole('group', { name: 'Main Floor controls, auto-clean, actions, info' })
    expect(within(controlsPane).queryByRole('button', { name: 'Stop Dock Clean' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Actions' }))
    await waitFor(() => expect(selectedTab()).toHaveAttribute('aria-label', 'Actions'))
    const stopDockClean = await screen.findByRole('button', { name: 'Stop Dock Clean' })
    expect(within(controlsPane).queryByRole('button', { name: 'Clean Mop Dock' })).not.toBeInTheDocument()
    expect(within(controlsPane).queryByRole('button', { name: 'Dry Mops' })).not.toBeInTheDocument()
    expect(within(controlsPane).queryByRole('button', { name: 'Empty Bin' })).not.toBeInTheDocument()

    fireEvent.click(stopDockClean)

    expect(mockCallServiceCalls).toEqual([
      { domain: 'script', service: 'main_floor_vacuum_mop_dock_clean' },
    ])
  })

  it('surfaces Stop Mop Drying only in minimal Actions and calls the existing stop service', async () => {
    setMainFloorDockStatus('drying')
    renderMainFloorRoomSource()

    const controlsPane = screen.getByRole('group', { name: 'Main Floor controls, auto-clean, actions, info' })
    expect(within(controlsPane).queryByRole('button', { name: 'Stop Mop Drying' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Actions' }))
    await waitFor(() => expect(selectedTab()).toHaveAttribute('aria-label', 'Actions'))
    const stopMopDrying = await screen.findByRole('button', { name: 'Stop Mop Drying' })
    expect(within(controlsPane).queryByRole('button', { name: 'Clean Mop Dock' })).not.toBeInTheDocument()
    expect(within(controlsPane).queryByRole('button', { name: 'Dry Mops' })).not.toBeInTheDocument()
    expect(within(controlsPane).queryByRole('button', { name: 'Empty Bin' })).not.toBeInTheDocument()

    fireEvent.click(stopMopDrying)

    expect(mockCallServiceCalls).toEqual([
      { domain: 'script', service: 'main_floor_vacuum_mop_dock_dry' },
    ])
  })

  it('retargets hidden tabs to Controls without restoring the old tab when full mode returns', async () => {
    renderMainFloorRoomSource()

    fireEvent.click(screen.getByRole('tab', { name: 'Rooms' }))
    expect(selectedTab()).toHaveAttribute('aria-label', 'Rooms')

    act(() => {
      setMockEntityState(mainFloorVacuum.entityId, 'cleaning')
    })

    expect(visibleTabs()).toEqual(['Controls', 'Auto-Clean', 'Info'])
    expect(selectedTab()).toHaveAttribute('aria-label', 'Controls')

    act(() => {
      setMockEntityState(mainFloorVacuum.entityId, 'docked')
    })

    await waitFor(() => expect(visibleTabs()).toEqual(['Controls', 'Rooms', 'Auto-Clean', 'Actions', 'Info']))
    expect(selectedTab()).toHaveAttribute('aria-label', 'Controls')
  })

  it('preserves Auto-Clean when it remains visible across full and minimal mode changes', async () => {
    renderMainFloorRoomSource()

    fireEvent.click(screen.getByRole('tab', { name: 'Auto-Clean' }))
    expect(selectedTab()).toHaveAttribute('aria-label', 'Auto-Clean')

    act(() => {
      setMockEntityState(mainFloorVacuum.entityId, 'cleaning')
    })

    expect(visibleTabs()).toEqual(['Controls', 'Auto-Clean', 'Info'])
    expect(selectedTab()).toHaveAttribute('aria-label', 'Auto-Clean')

    act(() => {
      setMockEntityState(mainFloorVacuum.entityId, 'docked')
    })

    await waitFor(() => expect(visibleTabs()).toEqual(['Controls', 'Rooms', 'Auto-Clean', 'Actions', 'Info']))
    expect(selectedTab()).toHaveAttribute('aria-label', 'Auto-Clean')
  })

  it('preserves Info when it remains visible across full and minimal mode changes', async () => {
    renderMainFloorRoomSource()

    fireEvent.click(screen.getByRole('tab', { name: 'Info' }))
    expect(selectedTab()).toHaveAttribute('aria-label', 'Info')

    act(() => {
      setMockEntityState(mainFloorVacuum.entityId, 'cleaning')
    })

    expect(visibleTabs()).toEqual(['Controls', 'Auto-Clean', 'Info'])
    expect(selectedTab()).toHaveAttribute('aria-label', 'Info')

    act(() => {
      setMockEntityState(mainFloorVacuum.entityId, 'docked')
    })

    await waitFor(() => expect(visibleTabs()).toEqual(['Controls', 'Rooms', 'Auto-Clean', 'Actions', 'Info']))
    expect(selectedTab()).toHaveAttribute('aria-label', 'Info')
  })

  it('retains Controls as the active tab when a focused hidden tab disappears', async () => {
    renderMainFloorRoomSource()

    const actionsTab = screen.getByRole('tab', { name: 'Actions' })
    actionsTab.focus()
    expect(actionsTab).toHaveFocus()

    act(() => {
      setMockEntityState(mainFloorVacuum.entityId, 'cleaning')
    })
    await settleAnimationFrame()

    await waitFor(() => expect(selectedTab()).toHaveAttribute('aria-label', 'Controls'))
    expect(screen.getByRole('tab', { name: 'Controls' })).toHaveAttribute('tabindex', '0')
  })

  it('closes the area editor when runtime mode becomes minimal', async () => {
    renderMainFloorRoomSource()

    fireEvent.click(screen.getByRole('button', { name: 'Area' }))
    expect(await screen.findByRole('button', { name: 'Draw' })).toBeInTheDocument()
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()

    act(() => {
      setMockEntityState(mainFloorVacuum.entityId, 'cleaning')
    })

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Draw' })).not.toBeInTheDocument())
    expect(screen.getByRole('tablist', { name: 'Main Floor modal sections' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument()
  })

  it('keeps one selected tab, visible keyboard order, and valid ARIA links through rapid mode changes', async () => {
    renderMainFloorRoomSource()

    const controls = screen.getByRole('tab', { name: 'Controls' })
    fireEvent.keyDown(controls, { key: 'End' })
    expect(selectedTab()).toHaveAttribute('aria-label', 'Info')

    act(() => {
      setMockEntityState(mainFloorVacuum.entityId, 'cleaning')
      setMockEntityState(mainFloorVacuum.entityId, 'docked')
      setMockEntityState(mainFloorVacuum.entityId, 'returning')
    })

    await waitFor(() => expect(visibleTabs()).toEqual(['Controls', 'Auto-Clean', 'Info']))
    expect(selectedTab()).toHaveAttribute('aria-label', 'Info')
    expect(tabbableTabs()).toHaveLength(1)

    fireEvent.keyDown(screen.getByRole('tab', { name: 'Info' }), { key: 'Home' })
    expect(selectedTab()).toHaveAttribute('aria-label', 'Controls')
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Controls' }), { key: 'End' })
    expect(selectedTab()).toHaveAttribute('aria-label', 'Info')

    fireEvent.keyDown(screen.getByRole('tab', { name: 'Info' }), { key: 'Home' })
    const active = screen.getByRole('tab', { name: 'Controls' })
    const panelId = active.getAttribute('aria-controls')
    expect(panelId).toBeTruthy()
    const panel = document.getElementById(panelId!)
    expect(panel).toHaveAttribute('role', 'tabpanel')
    expect(panel).toHaveAttribute('aria-labelledby', active.id)
  })

  it('keeps unknown consumables visible with the unavailable icon treatment', async () => {
    const dustbagConsumable = mainFloorVacuum.consumables.find((consumable) => consumable.title === 'Dustbag')
    const freshWaterConsumable = mainFloorVacuum.consumables.find((consumable) => consumable.title === 'Fresh Water')
    const wasteWaterConsumable = mainFloorVacuum.consumables.find((consumable) => consumable.title === 'Waste Water')
    if (!dustbagConsumable || !freshWaterConsumable || !wasteWaterConsumable) throw new Error('Expected main-floor consumable fixtures')

    const originalDustbag = mockEntities[dustbagConsumable.entityId]
    delete mockEntities[dustbagConsumable.entityId]
    mockEntities[freshWaterConsumable.entityId].state = 'unknown'
    mockEntities[wasteWaterConsumable.entityId].state = 'unavailable'

    try {
      renderMainFloorRoomSource()
      fireEvent.click(screen.getByRole('tab', { name: 'Info' }))
      await waitFor(() => expect(selectedTab()).toHaveAttribute('aria-label', 'Info'))

      for (const name of ['Dustbag Unknown', 'Fresh Water Unknown', 'Waste Water Unknown']) {
        const item = await screen.findByRole('group', { name })
        expect(item).toHaveAttribute('data-icon', 'mdi:help-circle-outline')
        expect(item).toHaveAttribute('data-tone', 'unavailable')
      }
    } finally {
      if (originalDustbag) mockEntities[dustbagConsumable.entityId] = originalDustbag
      mockEntities[freshWaterConsumable.entityId].state = 'ok'
      mockEntities[wasteWaterConsumable.entityId].state = 'ok'
    }
  })

  it('skips tab-membership motion under prefers-reduced-motion', async () => {
    const restoreMatchMedia = mockReducedMotion(true)
    try {
      renderMainFloorRoomSource()

      act(() => {
        setMockEntityState(mainFloorVacuum.entityId, 'cleaning')
      })

      await settleAnimationFrame()
      expect(visibleTabs()).toEqual(['Controls', 'Auto-Clean', 'Info'])
      for (const tab of screen.getAllByRole('tab')) {
        expect(tab).not.toHaveStyle({ opacity: '0' })
        expect(tab).not.toHaveStyle({ transform: expect.stringMatching(/translate/) })
        expect(tab).not.toHaveStyle({ transition: expect.stringContaining('180ms') })
      }
    } finally {
      restoreMatchMedia()
    }
  })

  it('shows a concise read-only status fallback when a minimal state has no runtime actions', () => {
    const originalWidth = window.innerWidth
    const originalHeight = window.innerHeight
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 393 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 852 })
    setMainFloorRuntime({ error: 'Low battery', state: 'error' })
    try {
      renderMainFloorRoomSource()

      const controlsPane = screen.getByRole('group', { name: 'Main Floor controls, auto-clean, info' })
      expect(within(controlsPane).getByRole('heading', { name: 'Error' })).toBeInTheDocument()
      expect(within(controlsPane).getByText('Low battery')).toBeInTheDocument()
      expect(within(controlsPane).queryByRole('button', { name: 'Stop' })).not.toBeInTheDocument()
      expect(within(controlsPane).queryByRole('button', { name: 'Dock' })).not.toBeInTheDocument()
    } finally {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalWidth })
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: originalHeight })
    }
  })

  it('does not remount the controls panel when live state changes between full and minimal modes', async () => {
    renderMainFloorRoomSource()

    const panel = document.getElementById(`vacuum-${mainFloorVacuum.vacuumMapId}-panel-content`)
    if (!panel) throw new Error('Expected vacuum tabpanel')

    fireEvent.click(screen.getByRole('tab', { name: 'Auto-Clean' }))
    act(() => {
      setMockEntityState(mainFloorVacuum.entityId, 'cleaning')
      setMockEntityState(mainFloorVacuum.entityId, 'docked')
    })

    await waitFor(() => expect(document.getElementById(`vacuum-${mainFloorVacuum.vacuumMapId}-panel-content`)).toBe(panel))
  })

  it('installs the development preview API and retargets hidden tabs when the override switches to minimal', async () => {
    vi.stubEnv('DEV', true)
    renderMainFloorRoomSource()

    expect(window.__vacuumModalPreview?.getMode()).toBe('live')
    fireEvent.click(screen.getByRole('tab', { name: 'Rooms' }))
    expect(selectedTab()).toHaveAttribute('aria-label', 'Rooms')

    act(() => {
      window.__vacuumModalPreview?.setMode('minimal')
    })

    expect(visibleTabs()).toEqual(['Controls', 'Auto-Clean', 'Info'])
    expect(selectedTab()).toHaveAttribute('aria-label', 'Controls')

    act(() => {
      window.__vacuumModalPreview?.setMode('full')
    })

    await waitFor(() => expect(visibleTabs()).toEqual(['Controls', 'Rooms', 'Auto-Clean', 'Actions', 'Info']))
    expect(selectedTab()).toHaveAttribute('aria-label', 'Controls')
  })

  it('keeps the development preview API out of production builds', () => {
    vi.stubEnv('DEV', false)
    vi.stubEnv('MODE', 'production')
    renderMainFloorRoomSource()

    expect(window.__vacuumModalPreview).toBeUndefined()
  })

  it('keeps configured auto-clean toggles enabled while a clean request is still pending', async () => {
    setMockCallServiceOutcome('script', 'main_floor_vacuum_clean_selected_segments', 'pending')
    renderMainFloorRoomSource()

    fireEvent.click(screen.getByRole('button', { name: 'Clean' }))

    await waitFor(() => expect(visibleTabs()).toEqual(['Controls', 'Auto-Clean', 'Info']))
    fireEvent.click(screen.getByRole('tab', { name: 'Auto-Clean' }))

    const officeAutoClean = await screen.findByRole('button', { name: 'Office auto-clean enabled' })
    expect(officeAutoClean).toBeEnabled()

    fireEvent.click(officeAutoClean)

    expect(screen.getByRole('button', { name: 'Office auto-clean disabled' })).toHaveAttribute('aria-pressed', 'true')
    expect(mockCallServiceCalls).toEqual([
      { domain: 'script', service: 'main_floor_vacuum_clean_selected_segments' },
      { domain: 'switch', service: 'turn_on', target: 'switch.main_floor_vacuum_coordinator_office_auto_clean_disabled' },
    ])
  })

  it('keeps hidden setup state preserved while minimal mode blocks editing', async () => {
    renderMainFloorRoomSource()
    fireEvent.click(screen.getByRole('tab', { name: 'Rooms' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Kitchen' }))

    fireEvent.click(screen.getByRole('tab', { name: 'Controls' }))
    expect(screen.getByText('Selected Rooms')).toBeInTheDocument()
    expect(screen.getByRole('listitem')).toHaveTextContent('Kitchen')

    act(() => {
      setMockEntityState(mainFloorVacuum.entityId, 'cleaning')
    })

    expect(screen.queryByRole('tab', { name: 'Rooms' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'Controls' }))
    expect(screen.queryByText('Selected Rooms')).not.toBeInTheDocument()

    act(() => {
      setMockEntityState(mainFloorVacuum.entityId, 'docked')
    })

    await waitFor(() => expect(screen.getByText('Selected Rooms')).toBeInTheDocument())
    expect(screen.getByRole('listitem')).toHaveTextContent('Kitchen')
  })
})
