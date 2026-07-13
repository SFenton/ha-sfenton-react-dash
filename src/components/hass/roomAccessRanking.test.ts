import { AREA_ITEMS, type RoomNavigationConfig } from '../../constants/atAGlance'
import { rankRoomsByAccess, roomAccessCount } from './roomAccessRanking'

describe('room access ranking', () => {
  it('sorts by descending count with configured-order tie breaking without mutating config', () => {
    const configuredRooms = [...AREA_ITEMS]
    const rankedRooms = rankRoomsByAccess(AREA_ITEMS, {
      'counter.room_access_guest_room': { state: '7' },
      'counter.room_access_gym': { state: '7' },
      'counter.room_access_living_room': { state: '2' },
    })

    expect(rankedRooms.slice(0, 4).map((room) => room.title)).toEqual([
      'Guest Room',
      'Gym',
      'Living Room',
      'Master Bedroom',
    ])
    expect(AREA_ITEMS).toEqual(configuredRooms)
  })

  it('keeps missing, unavailable, invalid, and newly configured room counters safely at zero', () => {
    const futureRoom: RoomNavigationConfig = {
      ...AREA_ITEMS[0],
      accessCounterEntityId: 'counter.room_access_future_room',
      accessKey: 'future-room',
      route: '/at-a-glance/future-room',
      title: 'Future Room',
    }
    const rooms = [AREA_ITEMS[0], AREA_ITEMS[1], futureRoom]

    expect(rankRoomsByAccess(rooms, {
      'counter.room_access_guest_room': { state: 'unavailable' },
      'counter.room_access_living_room': { state: 'unknown' },
    })).toEqual(rooms)
    expect(roomAccessCount(undefined)).toBe(0)
    expect(roomAccessCount({ state: '-1' })).toBe(0)
    expect(roomAccessCount({ state: '1.5' })).toBe(0)
  })

  it('keeps every configured room key and counter target unique and aligned', () => {
    expect(new Set(AREA_ITEMS.map((room) => room.accessKey)).size).toBe(AREA_ITEMS.length)
    expect(new Set(AREA_ITEMS.map((room) => room.accessCounterEntityId)).size).toBe(AREA_ITEMS.length)
    for (const room of AREA_ITEMS) {
      expect(room.accessCounterEntityId).toBe(`counter.room_access_${room.accessKey.replaceAll('-', '_')}`)
    }
  })
})
