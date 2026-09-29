import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './i18n/init'
import './index.css'
import App from './App.tsx'
import { installReactDashboardLifecycle } from './lifecycle/reactDashboardLifecycle'
import { installResumeTelemetry } from './lifecycle/resumeTelemetry'
import { installFocusAppearance } from './utils/focusAppearance'

const root = createRoot(document.getElementById('root')!)
const disposeFocusAppearance = installFocusAppearance()
const lifecycle = installReactDashboardLifecycle({
  onDispose: () => {
    resumeTelemetry.dispose()
    disposeFocusAppearance()
    root.unmount()
  },
})
const resumeTelemetry = installResumeTelemetry({ instanceId: lifecycle.instanceId })

root.render(
  <StrictMode>
    <App />
  </StrictMode>,
)
