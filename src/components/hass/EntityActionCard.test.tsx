import { fireEvent, render, screen } from '@testing-library/react'
import { EntityActionCard } from './EntityActionCard'
import { mockCallServiceCalls, resetMockHass } from '../../test/mocks/hakitCoreState'

describe('EntityActionCard', () => {
  beforeEach(() => resetMockHass())

  it('runs explicit toggle actions through Home Assistant services', () => {
    render(
      <EntityActionCard
        item={{ title: 'Manual Front Yard', entityId: 'input_boolean.manually_control_front_yard_lights', icon: 'mdi:lightbulb-group', action: { type: 'toggle' } }}
        onNavigate={() => undefined}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /manual front yard/i }))

    expect(mockCallServiceCalls).toEqual([
      {
        domain: 'homeassistant',
        service: 'toggle',
        target: 'input_boolean.manually_control_front_yard_lights',
      },
    ])
  })

  it('runs navigation actions without calling a Home Assistant service', () => {
    const navigate = vi.fn()

    render(
      <EntityActionCard
        item={{ title: 'Vacuums', entityId: 'sensor.unavailable', icon: 'mdi:robot-vacuum', action: { type: 'navigate', path: 'vacuums' } }}
        onNavigate={navigate}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /vacuums/i }))

    expect(navigate).toHaveBeenCalledWith('vacuums')
    expect(mockCallServiceCalls).toEqual([])
  })

  it('can run script service actions without adding an entity target', () => {
    render(
      <EntityActionCard
        item={{
          title: 'Living Room',
          entityId: 'switch.living_room_presence_living_room_lights_presence_allowed',
          icon: 'mdi:sofa',
          action: {
            type: 'service',
            domain: 'script',
            service: 'toggle_presence_lighting_override',
            target: null,
            serviceData: { presence_switch: 'switch.living_room_presence_living_room_lights_presence_allowed' },
          },
        }}
        onNavigate={() => undefined}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /living room/i }))

    expect(mockCallServiceCalls).toEqual([
      {
        domain: 'script',
        service: 'toggle_presence_lighting_override',
        serviceData: { presence_switch: 'switch.living_room_presence_living_room_lights_presence_allowed' },
      },
    ])
  })

})