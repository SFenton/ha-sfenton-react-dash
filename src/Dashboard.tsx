import { AtAGlancePage } from './pages/AtAGlancePage'
import { DashboardViewPage } from './pages/DashboardViewPage'
import { routeUrl } from './constants/routes'
import { useDashboardRoute } from './hooks/useDashboardRoute'

function Dashboard() {
  const { path, navigate } = useDashboardRoute()

  const navigateToPath = (nextPath: string) => {
    navigate(routeUrl(nextPath))
  }

  if (path === 'overview') {
    return <AtAGlancePage activePath={path} onNavigate={navigateToPath} />
  }

  return <DashboardViewPage activePath={path} onNavigate={navigateToPath} path={path} />
}

export default Dashboard
