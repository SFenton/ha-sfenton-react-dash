import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './i18n/init'
import './index.css'
import App from './App.tsx'
import { installReactDashboardLifecycle } from './lifecycle/reactDashboardLifecycle'

const root = createRoot(document.getElementById('root')!)
installReactDashboardLifecycle({
  onDispose: () => root.unmount(),
})

root.render(
  <StrictMode>
    <App />
  </StrictMode>,
)
