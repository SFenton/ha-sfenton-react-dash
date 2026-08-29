import { execFile } from 'node:child_process'
import { Buffer } from 'node:buffer'
import { promisify } from 'node:util'
import { LEGACY_REACT_DASHBOARD_HOST, PANEL_REACT_DASHBOARD_HOST } from '../../src/constants/dashboardHosts'

const execFileAsync = promisify(execFile)

export const REACT_DASHBOARD_PUBLIC_PATH = '/local/ha-sfenton-react-dash/index.html'
export const REACT_DASHBOARD_CARD_RESOURCE_PATH = '/local/ha-sfenton-react-dash/sfenton-react-app-card.js'

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

interface LovelaceResource {
  id?: unknown
  type?: unknown
  url?: unknown
}

export function legacyDashboardUrl(version: string) {
  return `${REACT_DASHBOARD_PUBLIC_PATH}?v=${encodeURIComponent(version)}`
}

export function legacyCardResourceUrl(version: string) {
  return `${REACT_DASHBOARD_CARD_RESOURCE_PATH}?v=${encodeURIComponent(version)}`
}

export async function assertDashboardResourceAvailable(
  haUrl: string,
  resourceUrl: string,
  haToken: string,
  fetchImpl: typeof fetch = fetch,
) {
  const targetUrl = new URL(resourceUrl, haUrl)
  const headers = {
    Authorization: `Bearer ${haToken}`,
  }
  let response = await fetchImpl(targetUrl, {
    headers,
    method: 'HEAD',
  })
  if (response.status === 405 || response.status === 501) {
    response = await fetchImpl(targetUrl, {
      headers: {
        ...headers,
        Range: 'bytes=0-0',
      },
      method: 'GET',
    })
    await response.body?.cancel()
  }
  if (!response.ok) {
    throw new Error(`Dashboard resource ${targetUrl.pathname} is unavailable (HTTP ${response.status}).`)
  }
  const contentType = response.headers.get('content-type')?.toLowerCase()
  if (contentType?.includes('text/html')) {
    throw new Error(`Dashboard resource ${targetUrl.pathname} returned HTML instead of JavaScript.`)
  }
}

function decodedInlineResourceSource(url: string) {
  try {
    const parsedUrl = new URL(url, 'https://home-assistant.invalid')
    if (parsedUrl.origin === 'https://home-assistant.invalid') return ''
    const encodedSource = parsedUrl.pathname.split('/').filter(Boolean).at(-1)
    return encodedSource ? Buffer.from(encodedSource, 'base64').toString('utf8') : ''
  } catch {
    return ''
  }
}

function isLegacyReactCardResource(resource: LovelaceResource) {
  if (resource.type !== 'module' || typeof resource.url !== 'string') return false

  let resourcePath: string
  try {
    resourcePath = new URL(resource.url, 'https://home-assistant.invalid').pathname
  } catch {
    return false
  }
  if (resourcePath === REACT_DASHBOARD_CARD_RESOURCE_PATH) return true

  const inlineSource = decodedInlineResourceSource(resource.url)
  return inlineSource.includes('customElements.define')
    && inlineSource.includes('sfenton-react-app-card')
}

export function updateLegacyCardResource(resources: unknown, version: string) {
  if (!Array.isArray(resources)) {
    throw new Error('Home Assistant returned an invalid Lovelace resource list.')
  }

  const matches = resources.filter((resource): resource is LovelaceResource => (
    Boolean(resource) && typeof resource === 'object' && isLegacyReactCardResource(resource)
  ))
  if (matches.length !== 1) {
    throw new Error(`Expected one sfenton-react-app-card resource, found ${matches.length}.`)
  }

  const resource = matches[0]
  if (typeof resource.id !== 'string' || !resource.id) {
    throw new Error('The sfenton-react-app-card resource has no storage ID.')
  }

  const url = legacyCardResourceUrl(version)
  return {
    changed: resource.url !== url,
    previousUrl: resource.url as string,
    resourceId: resource.id,
    url,
  }
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
