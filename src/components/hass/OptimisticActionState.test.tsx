import { fireEvent, render, screen } from '@testing-library/react'
import { act } from 'react'
import { mockEntities, resetMockHass, setMockEntityState } from '../../test/mocks/hakitCoreState'
import { OptimisticActionStateBoundary } from './OptimisticActionState'
import { useOptimisticActionStates } from './optimisticActionState'

const ACTIVE_SOURCE = 'sensor.music_room_active_media_source'

function StateProbe() {
  const state = useOptimisticActionStates()[ACTIVE_SOURCE]
  return (
    <button onClick={() => state?.commit('Xbox', { revertMs: 90_000 })} type="button">
      {state?.displayedState}
    </button>
  )
}

beforeEach(() => {
  resetMockHass()
  mockEntities[ACTIVE_SOURCE].state = 'Off'
})

describe('OptimisticActionStateBoundary', () => {
  it('lets a conflicting external source change replace routed-source optimism immediately', () => {
    render(
      <OptimisticActionStateBoundary entityIds={[ACTIVE_SOURCE]} liveChangeEntityIds={[ACTIVE_SOURCE]}>
        <StateProbe />
      </OptimisticActionStateBoundary>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Off' }))
    expect(screen.getByRole('button', { name: 'Xbox' })).toBeInTheDocument()

    act(() => setMockEntityState(ACTIVE_SOURCE, 'Server'))

    expect(screen.getByRole('button', { name: 'Server' })).toBeInTheDocument()
  })
})
