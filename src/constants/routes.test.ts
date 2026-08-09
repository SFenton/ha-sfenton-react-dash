import { ROOM_PAGE_CONFIGS } from './roomPages'
import { APP_MANUAL_ROUTE_PATH, DASHBOARD_ROUTES, HOME_RECIPES_ROUTE_PATH, fallbackBackPathForRoute, primaryNavPathForRoute, primaryNavRouteActive, routePathFromUrl, routeUrl } from './routes'

describe('routes', () => {
  it('extracts at-a-glance route paths', () => {
    expect(routePathFromUrl('/at-a-glance/living-room')).toBe('living-room')
    expect(routePathFromUrl('/at-a-glance/grocery-list')).toBe('grocery-list')
    expect(routePathFromUrl('/at-a-glance/food')).toBe('food')
    expect(routePathFromUrl('/at-a-glance/recipes')).toBe(HOME_RECIPES_ROUTE_PATH)
    expect(routePathFromUrl('/at-a-glance/pantry')).toBe('pantry')
    expect(routePathFromUrl('/at-a-glance/fridge')).toBe('fridge')
    expect(routePathFromUrl('/at-a-glance/freezer')).toBe('freezer')
    expect(routePathFromUrl('/at-a-glance/spice-rack')).toBe('spice-rack')
    expect(routePathFromUrl('/at-a-glance/cabinet')).toBe('cabinet')
    expect(routePathFromUrl('/at-a-glance/manual')).toBe(APP_MANUAL_ROUTE_PATH)
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
    expect(routeUrl('vacation', '/at-a-glance/settings')).toBe('/at-a-glance/settings?path=vacation')
    expect(routeUrl('security', '/at-a-glance/overview#old-popup', '#security-system')).toBe('/at-a-glance/overview?path=security#security-system')
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

  it('keeps the summary user param only while targeting the summary modal hash', () => {
    expect(routeUrl('overview', '/sfenton-react-dash/home?path=security', '#daily-report')).toBe('/sfenton-react-dash/home?path=overview#daily-report')
    expect(routeUrl('overview', '/sfenton-react-dash/home?path=overview&user=stephen', '#daily-report')).toBe('/sfenton-react-dash/home?path=overview&user=stephen#daily-report')
    expect(routeUrl('overview', '/sfenton-react-dash/home?path=overview&user=stephen')).toBe('/sfenton-react-dash/home?path=overview')
    expect(routeUrl('chores', '/sfenton-react-dash/home?path=overview&user=stephen')).toBe('/sfenton-react-dash/home?path=chores')
  })

  it('keeps manual query state only while targeting the App Manual', () => {
    expect(routeUrl(APP_MANUAL_ROUTE_PATH, '/sfenton-react-dash/home?path=settings')).toBe('/sfenton-react-dash/home?path=manual')
    expect(routeUrl(APP_MANUAL_ROUTE_PATH, '/sfenton-react-dash/home?path=manual&manual-section=systems&manual-article=presence-based-lighting')).toBe('/sfenton-react-dash/home?path=manual&manual-section=systems&manual-article=presence-based-lighting')
    expect(routeUrl('settings', '/sfenton-react-dash/home?path=manual&manual-section=systems&manual-article=presence-based-lighting')).toBe('/sfenton-react-dash/home?path=settings')
  })

  it('groups home subpages under the Home primary nav route', () => {
    expect(primaryNavPathForRoute('living-room')).toBe('overview')
    expect(primaryNavPathForRoute('guest-room')).toBe('overview')
    expect(primaryNavPathForRoute('master-bedroom')).toBe('overview')
    expect(primaryNavPathForRoute('garage')).toBe('overview')
    expect(primaryNavPathForRoute('vacuums')).toBe('overview')
    expect(primaryNavPathForRoute('media')).toBe('overview')
    expect(primaryNavPathForRoute('custom-lights')).toBe('overview')
    expect(primaryNavPathForRoute('grocery-list')).toBe('overview')
    expect(primaryNavPathForRoute('food')).toBe('overview')
    expect(primaryNavPathForRoute('recipes')).toBe('overview')
    expect(primaryNavPathForRoute('pantry')).toBe('overview')
    expect(primaryNavPathForRoute('fridge')).toBe('overview')
    expect(primaryNavPathForRoute('freezer')).toBe('overview')
    expect(primaryNavPathForRoute('spice-rack')).toBe('overview')
    expect(primaryNavPathForRoute('cabinet')).toBe('overview')
    expect(primaryNavRouteActive('living-room', 'overview')).toBe(true)
    expect(primaryNavRouteActive('grocery-list', 'overview')).toBe(true)
    expect(primaryNavRouteActive('food', 'overview')).toBe(true)
    expect(primaryNavRouteActive('recipes', 'overview')).toBe(true)
    expect(primaryNavRouteActive('pantry', 'overview')).toBe(true)
    expect(primaryNavRouteActive('fridge', 'overview')).toBe(true)
    expect(primaryNavRouteActive('freezer', 'overview')).toBe(true)
    expect(primaryNavRouteActive('spice-rack', 'overview')).toBe(true)
    expect(primaryNavRouteActive('cabinet', 'overview')).toBe(true)
    expect(primaryNavRouteActive('vacuums', 'overview')).toBe(true)
    expect(primaryNavRouteActive('media', 'overview')).toBe(true)
    expect(primaryNavRouteActive('custom-lights', 'overview')).toBe(true)
    expect(primaryNavRouteActive('living-room', 'chores')).toBe(false)
    expect(primaryNavRouteActive('vacuums', 'chores')).toBe(false)
  })

  it('records the exact runtime section baseline for all sixteen room routes', () => {
    const expected: Record<string, readonly string[]> = {
      'living-room': ['Header Summaries', 'Climate', 'Devices', 'Remote', 'Quick App Launch'],
      'guest-room': ['Header Summaries', 'Climate'],
      'master-bedroom': ['Header Summaries', 'SleepyPod', 'Media', 'Climate'],
      gym: ['Header Summaries', 'Climate'],
      hallway: ['Header Summaries', 'Nothing Here Yet!'],
      office: ['Header Summaries', 'Climate', 'Office PCs'],
      kitchen: ['Header Summaries', 'Groceries', 'Appliances', 'Climate'],
      'dining-room': ['Header Summaries', 'Climate'],
      'back-deck': ['Header Summaries', 'Grill'],
      'music-room': ['Header Summaries', 'Climate', 'Devices'],
      'theater-room': ['Header Summaries', 'Climate', 'Remote', 'Quick App Launch', 'Theater Room PCs', 'Devices'],
      'downstairs-hallway': ['Header Summaries', 'Nothing Here Yet!'],
      garage: ['Header Summaries', 'Appliances', 'Garage Doors'],
      'guest-bathroom': ['Header Summaries', 'Climate'],
      'master-bathroom': ['Header Summaries', 'Climate'],
      entryway: ['Header Summaries', 'Nothing Here Yet!'],
    }

    expect(Object.keys(expected).sort()).toEqual(Object.keys(ROOM_PAGE_CONFIGS).sort())
    for (const [path, sectionNames] of Object.entries(expected)) {
      expect(DASHBOARD_ROUTES.find((route) => route.path === path)?.manualVisibleSectionNames).toEqual(sectionNames)
    }
  })

  it('binds the Mach-E, Vacuums, and Media routes to distinct page guides and visible sections', () => {
    expect(DASHBOARD_ROUTES.find((route) => route.path === 'mach-e')).toMatchObject({
      manualArticleId: 'mach-e-page-guide',
      manualVisibleSectionNames: ['Charge Status', 'Doors', "Driver's Seat", 'Passenger Seat', 'Climate'],
    })
    expect(DASHBOARD_ROUTES.find((route) => route.path === 'vacuums')).toMatchObject({
      manualArticleId: 'vacuums-page-guide',
      manualVisibleSectionNames: ['Robot Vacuums', 'Auto-Clean'],
    })
    expect(DASHBOARD_ROUTES.find((route) => route.path === 'media')).toMatchObject({
      manualArticleId: 'media-page-guide',
      manualVisibleSectionNames: ['Living Room', 'Theater Room'],
    })
  })

  it('binds every Settings route to its own page guide and exact visible sections', () => {
    expect(DASHBOARD_ROUTES.find((route) => route.path === 'settings')).toMatchObject({
      manualArticleId: 'settings-page-guide',
      manualVisibleSectionNames: ['App Manual', 'Admin Controls', 'Guest Controls', 'Vacation', 'To-Do', 'Mach-E', 'Home Assistant Settings'],
    })
    expect(DASHBOARD_ROUTES.find((route) => route.path === 'admin')).toMatchObject({
      manualArticleId: 'admin-page-guide',
      manualVisibleSectionNames: ['Security Controls', 'Living Room Power Recovery', 'Relay Control Mode', 'Presence-Based Light Overrides', 'Show Specific Controls', 'Automatic Presence Setting Overrides'],
    })
    expect(DASHBOARD_ROUTES.find((route) => route.path === 'guests-staying-over')).toMatchObject({
      manualArticleId: 'guest-controls-page-guide',
      manualVisibleSectionNames: ['Guest Controls'],
    })
    expect(DASHBOARD_ROUTES.find((route) => route.path === 'vacation')).toMatchObject({
      manualArticleId: 'vacation-page-guide',
      manualVisibleSectionNames: ['Vacation Mode', 'Pre-Vacation Checklist', 'Vacation Dates'],
    })
  })

  it('groups settings subpages under the Settings primary nav route', () => {
    expect(primaryNavPathForRoute('admin')).toBe('settings')
    expect(primaryNavPathForRoute('guests-staying-over')).toBe('settings')
    expect(primaryNavPathForRoute('mach-e')).toBe('settings')
    expect(primaryNavPathForRoute('to-do')).toBe('settings')
    expect(primaryNavPathForRoute('vacation')).toBe('settings')
    expect(primaryNavPathForRoute(APP_MANUAL_ROUTE_PATH)).toBe('settings')
    expect(primaryNavRouteActive('vacation', 'settings')).toBe(true)
    expect(primaryNavRouteActive('admin', 'overview')).toBe(false)
  })

  it('returns page-level fallback back paths for secondary routes', () => {
    expect(fallbackBackPathForRoute('to-do')).toBe('settings')
    expect(fallbackBackPathForRoute('admin')).toBe('settings')
    expect(fallbackBackPathForRoute(APP_MANUAL_ROUTE_PATH)).toBe('settings')
    expect(fallbackBackPathForRoute('pantry')).toBe('food')
    expect(fallbackBackPathForRoute('all-food')).toBe('food')
    expect(fallbackBackPathForRoute('recipes')).toBe('food')
    expect(fallbackBackPathForRoute('master-bedroom')).toBe('overview')
    expect(fallbackBackPathForRoute('food')).toBe('overview')
    expect(fallbackBackPathForRoute('stephs-chores')).toBe('chores')
    expect(fallbackBackPathForRoute('settings')).toBeUndefined()
    expect(fallbackBackPathForRoute('overview')).toBeUndefined()
  })
})