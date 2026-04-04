import { useNavigation } from './store';
import { LayoutShell } from './components/LayoutShell';
import { Navbar } from './components/Navbar';
import { OverviewView } from './views/OverviewView';
import { SecurityView } from './views/SecurityView';
import { EcobeeView } from './views/EcobeeView';
import { ChoresView } from './views/ChoresView';
import { SettingsView } from './views/SettingsView';
import { AreaDetailView } from './views/AreaDetailView';
import { AREA_ROUTES } from './routes';
import type { AreaRoute } from './routes';

function ViewRouter() {
  const { currentRoute } = useNavigation();

  // Check if it's an area route
  const isArea = AREA_ROUTES.some((a) => a.route === currentRoute);
  if (isArea) {
    return <AreaDetailView area={currentRoute as AreaRoute} />;
  }

  switch (currentRoute) {
    case 'overview':
      return <OverviewView />;
    case 'security':
      return <SecurityView />;
    case 'ecobee':
      return <EcobeeView />;
    case 'chores':
      return <ChoresView />;
    case 'settings':
      return <SettingsView />;
    default:
      return <OverviewView />;
  }
}

export function Dashboard() {
  return (
    <>
      <LayoutShell>
        <ViewRouter />
      </LayoutShell>
      <Navbar />
    </>
  );
}
