import { fireEvent, render, screen } from '@testing-library/react'
import { LightBrightnessCard } from './LightBrightnessCard'
import { entity, mockCallServiceCalls, mockEntities, resetMockHass } from '../../test/mocks/hakitCoreState'

const LIGHT_ID = 'light.test_custom_light'

describe('LightBrightnessCard modal disclosure', () => {
  beforeEach(() => {
    resetMockHass()
    mockEntities[LIGHT_ID] = entity(LIGHT_ID, 'on', { brightness: 128, rgb_color: [255, 128, 64] })
  })

  it('separates the keyboard-accessible detail opener from the HA power action', () => {
    const onMoreInfo = vi.fn()
    render(<LightBrightnessCard entityId={LIGHT_ID} onMoreInfo={onMoreInfo} showStatus tapAction="more-info" title="Test Light" />)

    const details = screen.getByRole('button', { name: 'Open Test Light details' })
    expect(details.parentElement?.querySelector('[data-modal-disclosure="right-chevron"]')).toBeInTheDocument()
    expect(details.parentElement?.querySelectorAll('[data-dynamic-grid-label="true"]')).toHaveLength(2)
    fireEvent.click(details)

    expect(onMoreInfo).toHaveBeenCalledWith(LIGHT_ID, 'Test Light')
    expect(mockCallServiceCalls).toEqual([])

    fireEvent.click(screen.getByRole('button', { name: 'Toggle Test Light' }))
    expect(mockCallServiceCalls).toEqual([
      { domain: 'homeassistant', service: 'toggle', target: LIGHT_ID },
    ])
  })

  it('does not show modal disclosure for a direct toggle card', () => {
    render(<LightBrightnessCard entityId={LIGHT_ID} title="Test Light" />)

    expect(screen.queryByRole('button', { name: 'Open Test Light details' })).not.toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Test Light' }).querySelector('[data-modal-disclosure]')).not.toBeInTheDocument()
  })
})
