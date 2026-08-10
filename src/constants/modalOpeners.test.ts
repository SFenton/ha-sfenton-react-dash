import { EXPECTED_MODAL_OPENER_FAMILY_COUNT, MODAL_OPENER_EXCEPTIONS, MODAL_OPENER_INVENTORY } from './modalOpeners'
import { ROOM_PAGE_CONFIGS } from './roomPages'

describe('modal opener inventory', () => {
  it('keeps every audited opener family uniquely documented', () => {
    expect(MODAL_OPENER_INVENTORY).toHaveLength(EXPECTED_MODAL_OPENER_FAMILY_COUNT)
    expect(new Set(MODAL_OPENER_INVENTORY.map((item) => item.id)).size).toBe(MODAL_OPENER_INVENTORY.length)
  })

  it('documents every non-chevron exception with source evidence', () => {
    expect(MODAL_OPENER_EXCEPTIONS.length).toBeGreaterThan(0)
    for (const item of MODAL_OPENER_EXCEPTIONS) {
      expect(item.exceptionReason, item.id).toBeTruthy()
      expect(item.sourceReference, item.id).toBeTruthy()
    }
  })

  it('keeps all content disclosure families on the shared right-chevron affordance', () => {
    const contentFamilies = [
      'weather-hero',
      'overview-security-tile',
      'overview-route-quick-links',
      'security-system-tile',
      'guest-presence-security',
      'room-source-cards',
      'media-page-remotes',
      'vacuum-page-cards',
      'admin-config-rows',
      'thermostat-room-rows',
      'predictive-comfort',
      'custom-light-details',
      'vacation-mode-confirmation',
      'inventory-multi-item-row',
    ]

    expect(MODAL_OPENER_INVENTORY.filter((item) => contentFamilies.includes(item.id)).every((item) => item.affordance === 'right-chevron')).toBe(true)
  })

  it('matches the generated room opener counts', () => {
    const pages = Object.values(ROOM_PAGE_CONFIGS)
    const headerCount = pages.flatMap((page) => page.overviewCards).filter((card) => card.hash).length
    const bodyCount = pages.flatMap((page) => page.sourceSections.flatMap((section) => section.cards)).filter((card) => card.hash && !card.action).length

    expect(MODAL_OPENER_INVENTORY.find((item) => item.id === 'room-status-chips')?.instances).toBe(headerCount)
    expect(MODAL_OPENER_INVENTORY.find((item) => item.id === 'room-source-cards')?.instances).toBe(bodyCount)
  })

  it('keeps the Downstairs Hallway light and door on distinct destinations', () => {
    const cards = ROOM_PAGE_CONFIGS['downstairs-hallway'].overviewCards
    const light = cards.find((card) => card.title === 'Light')
    const door = cards.find((card) => card.title === 'Door')

    expect(light?.hash).toBe('#light-downstairs-hallway')
    expect(door?.hash).toBe('#door-downstairs-hallway')
  })
})
