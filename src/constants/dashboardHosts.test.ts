import {
  dashboardRouteHostIndex,
  IOS_TEST_REACT_DASHBOARD_HOST,
  isDashboardRouteHostPath,
} from './dashboardHosts'

describe('dashboard hosts', () => {
  it('recognizes the isolated iOS test dashboard host', () => {
    expect(IOS_TEST_REACT_DASHBOARD_HOST).toBe('sfenton-react-ios-test')
    expect(isDashboardRouteHostPath('/sfenton-react-ios-test/home')).toBe(true)
    expect(dashboardRouteHostIndex(['sfenton-react-ios-test', 'home'])).toBe(0)
  })
})
