import { primaryNavPathForRoute, primaryNavRouteActive, routePathFromUrl, routeUrl } from './routes'

describe('routes', () => {
  it('extracts at-a-glance route paths', () => {
    expect(routePathFromUrl('/at-a-glance/living-room')).toBe('living-room')
    expect(routePathFromUrl('/at-a-glance')).toBe('overview')
    expect(routePathFromUrl('/local/ha-sfenton-react-dash/index.html')).toBe('overview')
  })

  it('extracts wrapper and static app query route paths', () => {
    expect(routePathFromUrl('/sfenton-react-dash/home?path=security#security-system')).toBe('security')
    expect(routePathFromUrl('/sfenton-react-dash/home?path=/at-a-glance/living-room#lights-living-room')).toBe('living-room')
    expect(routePathFromUrl('/local/ha-sfenton-react-dash/index.html?v=20260530&path=vacuums')).toBe('vacuums')
    expect(routePathFromUrl('/sfenton-react-dash/home')).toBe('overview')
  })

  it('builds at-a-glance URLs', () => {
    expect(routeUrl('vacuums')).toBe('/at-a-glance/vacuums')
    expect(routeUrl('')).toBe('/at-a-glance/overview')
  })

  it('builds shareable wrapper and static app URLs', () => {
    expect(routeUrl('security', '/sfenton-react-dash/home?path=overview')).toBe('/sfenton-react-dash/home?path=security')
    expect(routeUrl('living-room', '/sfenton-react-dash/home?v=20260530', '#lights-living-room')).toBe('/sfenton-react-dash/home?v=20260530&path=living-room#lights-living-room')
    expect(routeUrl('vacuums', '/local/ha-sfenton-react-dash/index.html?v=20260530#old-popup')).toBe('/local/ha-sfenton-react-dash/index.html?v=20260530&path=vacuums')
  })

  it('groups chore subpages under the Chores primary nav route', () => {
    expect(primaryNavPathForRoute('chores')).toBe('chores')
    expect(primaryNavPathForRoute('stephs-chores')).toBe('chores')
    expect(primaryNavPathForRoute('stephens-chores')).toBe('chores')
    expect(primaryNavPathForRoute('unassigned-chores')).toBe('chores')
    expect(primaryNavPathForRoute('home-improvement-chores')).toBe('chores')
    expect(primaryNavPathForRoute('groceries')).toBe('chores')
    expect(primaryNavRouteActive('stephs-chores', 'chores')).toBe(true)
    expect(primaryNavRouteActive('stephs-chores', 'overview')).toBe(false)
  })

  it('groups room subpages under the Home primary nav route', () => {
    expect(primaryNavPathForRoute('living-room')).toBe('overview')
    expect(primaryNavPathForRoute('guest-room')).toBe('overview')
    expect(primaryNavPathForRoute('master-bedroom')).toBe('overview')
    expect(primaryNavPathForRoute('garage')).toBe('overview')
    expect(primaryNavRouteActive('living-room', 'overview')).toBe(true)
    expect(primaryNavRouteActive('living-room', 'chores')).toBe(false)
  })
})