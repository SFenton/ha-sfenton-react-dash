import { fireEvent, render, screen } from '@testing-library/react'
import { MediaRemoteModalNav } from './MediaRemoteModalContent'

describe('MediaRemoteModalNav', () => {
  it('updates the visual active tab on pointer down before content navigation settles', () => {
    const onTabChange = vi.fn()

    render(<MediaRemoteModalNav activeTab="controls" onTabChange={onTabChange} remoteTitle="Living Room" showDevices />)

    const controlsTab = screen.getByRole('button', { name: 'Controls' })
    const devicesTab = screen.getByRole('button', { name: 'Devices' })

    expect(controlsTab).toHaveAttribute('data-active', 'true')
    expect(controlsTab).toHaveAttribute('aria-current', 'page')

    fireEvent.pointerDown(devicesTab)

    expect(devicesTab).toHaveAttribute('data-active', 'true')
    expect(devicesTab).not.toHaveAttribute('aria-current')
    expect(controlsTab).toHaveAttribute('aria-current', 'page')
    expect(onTabChange).not.toHaveBeenCalled()

    fireEvent.click(devicesTab)

    expect(onTabChange).toHaveBeenCalledWith('devices')
  })
})
