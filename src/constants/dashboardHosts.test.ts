import {
  dashboardRouteHostIndex,
  FOLD_TEST_REACT_DASHBOARD_HOST,
  IOS_TEST_REACT_DASHBOARD_HOST,
  isDashboardRouteHostPath,
} from './dashboardHosts'

describe('dashboard hosts', () => {
  it('recognizes the isolated iOS test dashboard host', () => {
    expect(IOS_TEST_REACT_DASHBOARD_HOST).toBe('sfenton-react-ios-test')
    expect(isDashboardRouteHostPath('/sfenton-react-ios-test/home')).toBe(true)
    expect(dashboardRouteHostIndex(['sfenton-react-ios-test', 'home'])).toBe(0)
  })

  it('recognizes the distinct Fold test host without accepting similar paths', () => {
    expect(FOLD_TEST_REACT_DASHBOARD_HOST).toBe('sfenton-react-fold-test')
    expect(isDashboardRouteHostPath('/sfenton-react-fold-test/home')).toBe(true)
    expect(isDashboardRouteHostPath('/sfenton-react-fold-test-other/home')).toBe(false)
    expect(dashboardRouteHostIndex(['sfenton-react-fold-test', 'home'])).toBe(0)
  })
})
