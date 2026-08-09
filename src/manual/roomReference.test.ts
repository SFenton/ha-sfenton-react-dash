import { ROOM_PAGE_CONFIGS } from '../constants/roomPages'
import { roomReferenceInteractionDescription } from './roomReference'

function roomCard(path: string, title: string) {
  const room = ROOM_PAGE_CONFIGS[path]
  const card = [...room.overviewCards, ...room.sourceSections.flatMap((section) => section.cards)]
    .find((candidate) => candidate.title === title)
  if (!card) throw new Error(`Missing ${path} card ${title}`)
  return card
}

describe('generated room reference interactions', () => {
  it('distinguishes detail openers from status-only and immediate cards', () => {
    expect(roomReferenceInteractionDescription(roomCard('living-room', 'Lights'))).toMatch(/^Detail opener/)
    expect(roomReferenceInteractionDescription(roomCard('back-deck', 'Occupancy'))).toMatch(/^Status only/)
    expect(roomReferenceInteractionDescription(roomCard('garage', 'Left Door'))).toMatch(/^Immediate direct action/)
    expect(roomReferenceInteractionDescription(roomCard('living-room', 'Plex'))).toContain('launches Plex')
  })

  it('preserves state-dependent PC command branching', () => {
    expect(roomReferenceInteractionDescription(roomCard('office', "Stephen's PC"))).toBe(
      'State-dependent direct action — when the displayed power helper is On, it presses the configured Off command; in every other state it presses the configured On command. No detail sheet opens.',
    )
    expect(roomReferenceInteractionDescription(roomCard('theater-room', 'Theater Room PC'))).toContain('configured Off command')
  })

  it('explains that the grill opener is disabled while off or unavailable', () => {
    expect(roomReferenceInteractionDescription(roomCard('back-deck', 'Bear Grills'))).toBe(
      'Conditional detail opener — opens its focused sheet only while active. Off, Unavailable, Unknown leave the card muted and status-only.',
    )
  })
})
