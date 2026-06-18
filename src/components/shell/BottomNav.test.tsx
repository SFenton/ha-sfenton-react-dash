import { fireEvent, render, screen } from '@testing-library/react'
import { BottomNav } from './BottomNav'

describe('BottomNav', () => {
  it('updates the visual active tab on pointer down before route navigation commits', () => {
    const onNavigate = vi.fn()

    render(<BottomNav activePath="overview" onNavigate={onNavigate} />)

    const homeTab = screen.getByRole('button', { name: 'Home' })
    const securityTab = screen.getByRole('button', { name: 'Security' })

    expect(homeTab).toHaveAttribute('data-active', 'true')
    expect(homeTab).toHaveAttribute('aria-current', 'page')

    fireEvent.pointerDown(securityTab)

    expect(securityTab).toHaveAttribute('data-active', 'true')
    expect(securityTab).not.toHaveAttribute('aria-current')
    expect(homeTab).toHaveAttribute('aria-current', 'page')
    expect(onNavigate).not.toHaveBeenCalled()

    fireEvent.click(securityTab)

    expect(onNavigate).toHaveBeenCalledWith('security')
  })

  it('restores the route-backed active tab when a pointer interaction is cancelled', () => {
    const onNavigate = vi.fn()

    render(<BottomNav activePath="overview" onNavigate={onNavigate} />)

    const homeTab = screen.getByRole('button', { name: 'Home' })
    const securityTab = screen.getByRole('button', { name: 'Security' })

    fireEvent.pointerDown(securityTab)
    expect(securityTab).toHaveAttribute('data-active', 'true')

    fireEvent.pointerCancel(securityTab)

    expect(homeTab).toHaveAttribute('data-active', 'true')
    expect(onNavigate).not.toHaveBeenCalled()
  })
})
