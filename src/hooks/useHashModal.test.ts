import { act, renderHook } from '@testing-library/react'
import { useHashModal } from './useHashModal'

describe('useHashModal', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/at-a-glance/overview')
  })

  it('clears the modal hash with replace so closing does not add a reopen entry', () => {
    const { result } = renderHook(() => useHashModal())

    act(() => result.current.openHash('#lights-overview'))
    expect(window.location.hash).toBe('#lights-overview')

    const replaceState = vi.spyOn(window.history, 'replaceState')

    act(() => result.current.closeHash())

    expect(result.current.hash).toBe('')
    expect(window.location.hash).toBe('')
    expect(replaceState).toHaveBeenCalledWith(null, '', '/at-a-glance/overview')

    replaceState.mockRestore()
  })
})
