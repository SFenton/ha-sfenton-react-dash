import type { ReactNode } from 'react'
import { AtAGlancePage } from './pages/AtAGlancePage'
import { DashboardViewPage } from './pages/DashboardViewPage'
import { AppShell } from './components/shell/AppShell'
import { BottomNav } from './components/shell/BottomNav'
import { DashboardFloatingAction } from './components/shell/DashboardFloatingAction'
import { SmoothRouteOutlet } from './components/shell/SmoothRouteOutlet'
import { hasDashboardFloatingAction } from './components/shell/dashboardFloatingAction'
import { PRIMARY_NAV_ROUTES, routeUrl } from './constants/routes'
import { dashboardHref } from './hooks/dashboardLocation'
import { useDashboardRoute } from './hooks/useDashboardRoute'
import { useSmoothDisplayedRoute } from './hooks/useSmoothDisplayedRoute'

function pageForPath(path: string, activePath: string, onNavigate: (path: string) => void) {
  if (path === 'overview') {
    return <AtAGlancePage activePath={activePath} onNavigate={onNavigate} withShell={false} />
  }

  return <DashboardViewPage activePath={activePath} onNavigate={onNavigate} path={path} withShell={false} />
}

function floatingActionForPath(path: string, onNavigate: (path: string) => void): ReactNode {
  return hasDashboardFloatingAction(path) ? <DashboardFloatingAction key={path} onNavigate={onNavigate} path={path} /> : undefined
}

function routeUsesMenuChrome(path: string) {
  return PRIMARY_NAV_ROUTES.some((route) => route.path === path)
}

function Dashboard() {
  const { path, navigate } = useDashboardRoute()
  const { displayedPath, transitionSourcePath, transitionState } = useSmoothDisplayedRoute(path)
  const leadingChromeTransition = routeUsesMenuChrome(transitionSourcePath) === routeUsesMenuChrome(path) ? 'stable' : 'changing'

  const navigateToPath = (nextPath: string) => {
    navigate(routeUrl(nextPath, dashboardHref()))
  }

  return (
    <AppShell bottomNav={<BottomNav activePath={path} onNavigate={navigateToPath} />} floatingAction={floatingActionForPath(displayedPath, navigateToPath)}>
      <SmoothRouteOutlet leadingChromeTransition={leadingChromeTransition} routePath={displayedPath} transitionState={transitionState}>
        {pageForPath(displayedPath, path, navigateToPath)}
      </SmoothRouteOutlet>
    </AppShell>
  )
}

export default Dashboard
