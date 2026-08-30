import { createElement } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { OptimisticActionStateBoundary } from './OptimisticActionState'
import { runOptimisticServiceCommand, useOptimisticActionStates, type OptimisticActionStateMap } from './optimisticActionState'
import { mockEntities, resetMockHass } from '../../test/mocks/hakitCoreState'

describe('runOptimisticServiceCommand', () => {
  it('uses each intent revert window and resets requested state before dispatch', () => {
    const sourceCommit = vi.fn(() => 2)
    const sourceReset = vi.fn()
    const xboxCommit = vi.fn(() => 1)
    const states: OptimisticActionStateMap = {
      'input_select.music_room_media_source': {
        commit: sourceCommit,
        displayedState: 'Xbox',
        liveState: 'Xbox',
        reset: sourceReset,
      },
      'media_player.xbox': {
        commit: xboxCommit,
        displayedState: 'off',
        liveState: 'off',
        reset: vi.fn(),
      },
    }
    const callService = vi.fn()

    runOptimisticServiceCommand(
      callService,
      { domain: 'script', service: 'music_room_xbox' },
      [
        { entityId: 'media_player.xbox', revertMs: 90_000, value: 'on' },
        { entityId: 'input_select.music_room_media_source', revertMs: 120_000, value: 'Xbox' },
      ],
      [{ entityId: 'input_select.music_room_media_source', values: ['Xbox', 'Fortnite'] }],
      states,
    )

    expect(sourceReset).toHaveBeenCalledOnce()
    expect(xboxCommit).toHaveBeenCalledWith('on', { revertMs: 90_000 })
    expect(sourceCommit).toHaveBeenCalledWith('Xbox', { revertMs: 120_000 })
    expect(callService).toHaveBeenCalledWith({
      domain: 'script',
      returnResponse: true,
      service: 'music_room_xbox',
    })
  })

  it('does not reset a newer source selection when turning Xbox off', () => {
    const sourceReset = vi.fn()
    const states: OptimisticActionStateMap = {
      'input_select.music_room_media_source': {
        commit: vi.fn(() => 2),
        displayedState: 'Server',
        liveState: 'Xbox',
        reset: sourceReset,
      },
      'media_player.xbox': {
        commit: vi.fn(() => 3),
        displayedState: 'on',
        liveState: 'on',
        reset: vi.fn(),
      },
    }

    runOptimisticServiceCommand(
      vi.fn(),
      { domain: 'script', service: 'music_room_xbox_off' },
      [{ entityId: 'media_player.xbox', revertMs: 90_000, value: 'off' }],
      [{ entityId: 'input_select.music_room_media_source', values: ['Xbox', 'Fortnite'] }],
      states,
    )

    expect(sourceReset).not.toHaveBeenCalled()
  })

  it('immediately rolls optimistic state back when the service promise rejects', async () => {
    const reset = vi.fn()
    const states: OptimisticActionStateMap = {
      'media_player.xbox': {
        commit: vi.fn(() => 7),
        displayedState: 'off',
        liveState: 'off',
        reset,
      },
    }

    runOptimisticServiceCommand(
      () => Promise.reject(new Error('service failed')),
      { domain: 'script', service: 'music_room_xbox' },
      [{ entityId: 'media_player.xbox', revertMs: 90_000, value: 'on' }],
      undefined,
      states,
    )
    await Promise.resolve()
    await Promise.resolve()

    expect(reset).toHaveBeenCalledWith(7)
  })
})

describe('OptimisticActionStateBoundary', () => {
  beforeEach(() => {
    resetMockHass()
    mockEntities['media_player.xbox'].state = 'off'
  })

  it('does not let an older failed command clear a newer optimistic generation', () => {
    let firstGeneration = 0

    function Harness() {
      const controller = useOptimisticActionStates()['media_player.xbox']!
      return createElement(
        'div',
        null,
        createElement('output', { 'data-testid': 'state' }, controller.displayedState),
        createElement('button', { onClick: () => { firstGeneration = controller.commit('on') }, type: 'button' }, 'First'),
        createElement('button', { onClick: () => controller.commit('playing'), type: 'button' }, 'Second'),
        createElement('button', { onClick: () => controller.reset(firstGeneration), type: 'button' }, 'Reject First'),
      )
    }

    render(createElement(
      OptimisticActionStateBoundary,
      { entityIds: ['media_player.xbox'] },
      createElement(Harness),
    ))

    fireEvent.click(screen.getByRole('button', { name: 'First' }))
    fireEvent.click(screen.getByRole('button', { name: 'Second' }))
    fireEvent.click(screen.getByRole('button', { name: 'Reject First' }))

    expect(screen.getByTestId('state')).toHaveTextContent('playing')
  })

  it('does not create a stale override when intent already matches live state', () => {
    function Harness() {
      const controller = useOptimisticActionStates()['media_player.xbox']!
      return createElement(
        'div',
        null,
        createElement('output', { 'data-testid': 'state' }, controller.displayedState),
        createElement('button', { onClick: () => controller.commit('off'), type: 'button' }, 'Reselect Off'),
      )
    }

    const view = render(createElement(
      OptimisticActionStateBoundary,
      { entityIds: ['media_player.xbox'] },
      createElement(Harness),
    ))

    fireEvent.click(screen.getByRole('button', { name: 'Reselect Off' }))
    mockEntities['media_player.xbox'].state = 'on'
    view.rerender(createElement(
      OptimisticActionStateBoundary,
      { entityIds: ['media_player.xbox'] },
      createElement(Harness),
    ))

    expect(screen.getByTestId('state')).toHaveTextContent('on')
  })
})
