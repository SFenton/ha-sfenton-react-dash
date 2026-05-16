import { routePathFromUrl, routeUrl } from './routes'

describe('routes', () => {
  it('extracts at-a-glance route paths', () => {
    expect(routePathFromUrl('/at-a-glance/living-room')).toBe('living-room')
    expect(routePathFromUrl('/at-a-glance')).toBe('overview')
    expect(routePathFromUrl('/local/ha-sfenton-react-dash/index.html')).toBe('overview')
  })

  it('builds at-a-glance URLs', () => {
    expect(routeUrl('vacuums')).toBe('/at-a-glance/vacuums')
    expect(routeUrl('')).toBe('/at-a-glance/overview')
  })
})