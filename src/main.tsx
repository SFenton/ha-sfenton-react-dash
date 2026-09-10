import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './i18n/init'
import './index.css'
import App from './App.tsx'
import { installReactDashboardLifecycle } from './lifecycle/reactDashboardLifecycle'
import { installFocusAppearance } from './utils/focusAppearance'

const root = createRoot(document.getElementById('root')!)
const disposeFocusAppearance = installFocusAppearance()
installReactDashboardLifecycle({
  onDispose: () => {
    disposeFocusAppearance()
    root.unmount()
  },
})

root.render(
  <StrictMode>
    <App />
  </StrictMode>,
)
