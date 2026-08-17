import { fireEvent, render, screen } from '@testing-library/react'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  GARAGE_DOOR_COMMAND_LOCKOUT_MS,
  GARAGE_DOOR_CONFIRM_TIMEOUT_MS,
  GARAGE_DOOR_SENDING_FEEDBACK_MS,
  GARAGE_DOOR_SERVICE_TIMEOUT_MS,
} from '../../constants/garageDoors'
import {
  mockCallServiceCalls,
  resetMockHass,
  setMockCallServiceOutcome,
  setMockConnectionStatus,
  setMockEntityState,
} from '../../test/mocks/hakitCoreState'
import { GarageDoorTile } from './GarageDoorTile'

function renderGarageDoor() {
  return render(
    <GarageDoorTile
      entityId="cover.left_door"
      icon="mdi:garage"
      title="Left Door"
      toneForState={(state) => state === 'closed' ? 'contact' : state === 'closing' ? 'security' : 'danger'}
    />,
  )
}

async function advanceTimers(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

async function flushPromises() {
  await act(async () => {
    await Promise.resolve()
  })
}

describe('GarageDoorTile', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    resetMockHass()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows sending feedback immediately and then the predicted transition', async () => {
    renderGarageDoor()

    const closed = screen.getByRole('button', { name: 'Left Door Closed' })
    expect(closed).toHaveAttribute('data-action-kind', 'command')
    expect(closed).not.toHaveAttribute('aria-pressed')

    fireEvent.click(closed)

    const sending = screen.getByRole('button', { name: 'Left Door Sending Open…' })
    expect(sending).toBeEnabled()
    expect(sending).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByRole('status')).toHaveTextContent('Sending Open…')
    expect(mockCallServiceCalls).toEqual([
      { domain: 'cover', service: 'open_cover', target: 'cover.left_door' },
    ])

    await advanceTimers(GARAGE_DOOR_SENDING_FEEDBACK_MS)

    const opening = screen.getByRole('button', { name: 'Left Door Opening' })
    expect(opening).toBeEnabled()
    expect(opening).toHaveAttribute('aria-disabled', 'true')
    expect(opening).toHaveAttribute('data-tone', 'danger')

    await advanceTimers(GARAGE_DOOR_COMMAND_LOCKOUT_MS - GARAGE_DOOR_SENDING_FEEDBACK_MS)
    expect(opening).not.toHaveAttribute('aria-disabled')
  })

  it('converges on intermediate or direct terminal Home Assistant updates', async () => {
    renderGarageDoor()
    fireEvent.click(screen.getByRole('button', { name: 'Left Door Closed' }))
    await advanceTimers(GARAGE_DOOR_SENDING_FEEDBACK_MS)

    act(() => setMockEntityState('cover.left_door', 'opening'))
    expect(screen.getByRole('button', { name: 'Left Door Opening' })).toBeEnabled()
    expect(screen.getByRole('status')).toHaveTextContent('')

    act(() => setMockEntityState('cover.left_door', 'open'))
    expect(screen.getByRole('button', { name: 'Left Door Open' })).toBeEnabled()

    act(() => setMockEntityState('cover.left_door', 'closed'))
    fireEvent.click(screen.getByRole('button', { name: 'Left Door Closed' }))
    act(() => setMockEntityState('cover.left_door', 'open'))
    expect(screen.getByRole('button', { name: 'Left Door Open' })).toBeEnabled()
  })

  it('restores live state and exposes a live status when the service rejects', async () => {
    setMockCallServiceOutcome('cover', 'open_cover', 'reject')
    renderGarageDoor()

    fireEvent.click(screen.getByRole('button', { name: 'Left Door Closed' }))
    await flushPromises()

    expect(screen.getByRole('button', { name: 'Left Door Error' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Left Door Error' })).toHaveAttribute('data-tone', 'danger')
    expect(screen.getByRole('status')).toHaveTextContent('Error')
  })

  it('fails a request whose websocket acknowledgement never arrives', async () => {
    setMockCallServiceOutcome('cover', 'open_cover', 'pending')
    renderGarageDoor()

    fireEvent.click(screen.getByRole('button', { name: 'Left Door Closed' }))
    await advanceTimers(GARAGE_DOOR_SERVICE_TIMEOUT_MS)

    expect(screen.getByRole('button', { name: 'Left Door Error' })).toBeEnabled()
    expect(screen.getByRole('status')).toHaveTextContent('Error')
  })

  it('reverts to live state when Home Assistant never confirms the command', async () => {
    renderGarageDoor()

    fireEvent.click(screen.getByRole('button', { name: 'Left Door Closed' }))
    await advanceTimers(GARAGE_DOOR_SENDING_FEEDBACK_MS)
    expect(screen.getByRole('button', { name: 'Left Door Opening' })).toBeEnabled()

    await advanceTimers(GARAGE_DOOR_CONFIRM_TIMEOUT_MS - GARAGE_DOOR_SENDING_FEEDBACK_MS)

    expect(screen.getByRole('button', { name: 'Left Door Error' })).toBeEnabled()
    expect(screen.getByRole('status')).toHaveTextContent('Error')
  })

  it('suppresses rapid duplicates, then allows an idempotent retry or live-state reversal', async () => {
    renderGarageDoor()
    const closed = screen.getByRole('button', { name: 'Left Door Closed' })

    fireEvent.click(closed)
    fireEvent.click(closed)
    expect(mockCallServiceCalls).toHaveLength(1)

    await advanceTimers(GARAGE_DOOR_SENDING_FEEDBACK_MS)
    fireEvent.click(screen.getByRole('button', { name: 'Left Door Opening' }))
    expect(mockCallServiceCalls).toHaveLength(1)

    await advanceTimers(GARAGE_DOOR_COMMAND_LOCKOUT_MS - GARAGE_DOOR_SENDING_FEEDBACK_MS)
    fireEvent.click(screen.getByRole('button', { name: 'Left Door Opening' }))
    expect(mockCallServiceCalls).toEqual([
      { domain: 'cover', service: 'open_cover', target: 'cover.left_door' },
      { domain: 'cover', service: 'open_cover', target: 'cover.left_door' },
    ])

    act(() => setMockEntityState('cover.left_door', 'opening'))
    fireEvent.click(screen.getByRole('button', { name: 'Left Door Opening' }))
    expect(mockCallServiceCalls.at(-1)).toEqual({
      domain: 'cover',
      service: 'close_cover',
      target: 'cover.left_door',
    })
  })

  it('fails immediately when the connection is unavailable or drops mid-command', async () => {
    setMockConnectionStatus('disconnected')
    renderGarageDoor()

    fireEvent.click(screen.getByRole('button', { name: 'Left Door Closed' }))
    expect(mockCallServiceCalls).toHaveLength(0)
    expect(screen.getByRole('button', { name: 'Left Door Error' })).toBeEnabled()
    expect(screen.getByRole('status')).toHaveTextContent('Error')

    act(() => setMockConnectionStatus('connected'))
    fireEvent.click(screen.getByRole('button', { name: 'Left Door Error' }))
    await flushPromises()
    act(() => setMockConnectionStatus('suspended'))
    expect(screen.getByRole('button', { name: 'Left Door Error' })).toBeEnabled()
    expect(screen.getByRole('status')).toHaveTextContent('Error')
  })

  it('lets a live unavailable state replace stale error feedback', async () => {
    setMockCallServiceOutcome('cover', 'open_cover', 'reject')
    renderGarageDoor()

    fireEvent.click(screen.getByRole('button', { name: 'Left Door Closed' }))
    await flushPromises()
    expect(screen.getByRole('button', { name: 'Left Door Error' })).toBeEnabled()

    act(() => setMockEntityState('cover.left_door', 'unavailable'))
    expect(screen.queryByRole('button', { name: /Left Door/i })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Left Door Unavailable')).toHaveAttribute('data-muted', 'true')
    expect(screen.getByRole('status')).toHaveTextContent('')
  })

  it('renders unavailable and unknown states as noninteractive', () => {
    setMockEntityState('cover.left_door', 'unavailable')
    renderGarageDoor()

    expect(screen.queryByRole('button', { name: /Left Door/i })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Left Door Unavailable')).toHaveAttribute('data-muted', 'true')
  })
})
