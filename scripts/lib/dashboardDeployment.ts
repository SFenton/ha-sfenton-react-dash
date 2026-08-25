import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { LEGACY_REACT_DASHBOARD_HOST, PANEL_REACT_DASHBOARD_HOST } from '../../src/constants/dashboardHosts'

const execFileAsync = promisify(execFile)

export const REACT_DASHBOARD_PUBLIC_PATH = '/local/ha-sfenton-react-dash/index.html'

interface LovelaceCard {
  type?: unknown
  url?: unknown
}

interface LovelaceView {
  cards?: unknown
}

interface LovelaceConfig {
  views?: unknown
}

export function legacyDashboardUrl(version: string) {
  return `${REACT_DASHBOARD_PUBLIC_PATH}?v=${encodeURIComponent(version)}`
}

export function updateLegacyDashboardConfig(config: LovelaceConfig, version: string) {
  if (!Array.isArray(config.views) || config.views.length === 0) {
    throw new Error(`Dashboard ${LEGACY_REACT_DASHBOARD_HOST} has no views.`)
  }

  const firstView = config.views[0] as LovelaceView
  if (!Array.isArray(firstView.cards) || firstView.cards.length === 0) {
    throw new Error(`Dashboard ${LEGACY_REACT_DASHBOARD_HOST} has no wrapper card.`)
  }

  const firstCard = firstView.cards[0] as LovelaceCard
  if (firstCard.type !== 'custom:sfenton-react-app-card') {
    throw new Error(`Dashboard ${LEGACY_REACT_DASHBOARD_HOST} does not use the expected wrapper card.`)
  }

  const nextUrl = legacyDashboardUrl(version)
  if (firstCard.url === nextUrl) {
    return { changed: false, config, url: nextUrl }
  }

  const nextConfig = structuredClone(config)
  const nextView = (nextConfig.views as LovelaceView[])[0]
  const nextCard = (nextView.cards as LovelaceCard[])[0]
  nextCard.url = nextUrl
  return { changed: true, config: nextConfig, url: nextUrl }
}

export function validatePanelRegistration(panels: Record<string, unknown>) {
  const panel = panels[PANEL_REACT_DASHBOARD_HOST]
  if (!panel || typeof panel !== 'object') {
    throw new Error(`Home Assistant panel ${PANEL_REACT_DASHBOARD_HOST} is not registered.`)
  }

  const registeredPanel = panel as {
    component_name?: unknown
    config?: {
      _panel_custom?: {
        embed_iframe?: unknown
        name?: unknown
      }
    }
  }
  const customConfig = registeredPanel.config?._panel_custom
  if (
    registeredPanel.component_name !== 'custom'
    || customConfig?.name !== PANEL_REACT_DASHBOARD_HOST
    || customConfig.embed_iframe !== true
  ) {
    throw new Error(`Home Assistant panel ${PANEL_REACT_DASHBOARD_HOST} is not the expected embedded custom panel.`)
  }

  return registeredPanel
}

export async function resolveDeploymentVersion() {
  const [{ stdout: shaOutput }, { stdout: statusOutput }] = await Promise.all([
    execFileAsync('git', ['rev-parse', '--short=12', 'HEAD']),
    execFileAsync('git', ['status', '--porcelain']),
  ])
  const sha = shaOutput.trim()
  if (!sha) throw new Error('Unable to resolve the current git revision.')
  if (!statusOutput.trim()) return sha

  const timestamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14)
  return `${sha}-dirty-${timestamp}`
}
