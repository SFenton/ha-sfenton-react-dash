import {
  readReactDashboardLifecycleHistory,
  reactDashboardLifecycleHost,
  type ReactDashboardLifecycleEvent,
} from './reactDashboardLifecycle'

export const RESUME_TELEMETRY_STORAGE_KEY = 'sfenton-react-dash.session'
export const RESUME_TELEMETRY_SESSION_KEY = 'sfenton-react-dash.session-marker'
export const RESUME_TELEMETRY_RESULT_PROPERTY = '__sfentonReactDashboardStart'
export const RESUME_TELEMETRY_LOGGER = 'react_dash.resume'
// A machine-readable diagnostic line for the HA system log, not user-visible copy.
export const RESUME_TELEMETRY_LOG_PREFIX = 'RESUME_TELEMETRY'
const HASS_CONNECTION_TIMEOUT_MS = 30_000
const RECENT_LIFECYCLE_EVENTS = 6

/**
 * Why this React Dash instance started, from the previous instance's persisted heartbeat:
 * - `dashboard-reload`: the same HA page is still loaded; only the React iframe restarted (bridge dispose reason).
 * - `ha-page-reload`: the previous HA page exited cleanly (pull-to-refresh, app refresh, navigation).
 * - `web-process-restart`: the HA page restarted without exiting inside the same web view session. WebKit restores
 *   a page whose web content process was killed this way (observed as a `back_forward` navigation that keeps
 *   sessionStorage).
 * - `app-cold-start`: the HA page restarted without exiting in a new web view session (sessionStorage gone,
 *   `navigate`), i.e. the app process was relaunched after being terminated.
 */
export type DashboardStartKind =
  | 'first-start'
  | 'dashboard-reload'
  | 'ha-page-reload'
  | 'web-process-restart'
  | 'app-cold-start'

export interface DashboardSessionHeartbeat {
  closedCleanly: boolean
  frameOrigin: number
  hiddenAt?: number
  instanceId: string
  topOrigin: number
  topPath?: string
  updatedAt: number
  visibility: DocumentVisibilityState
  visibleAt?: number
}

export interface DashboardStartSignals {
  disposeEvent?: ReactDashboardLifecycleEvent
  lifecycle?: ReactDashboardLifecycleEvent[]
  now: number
  sessionMarker: boolean
  topNavigationType?: string
  topOrigin: number
  topPath?: string
}

/** Where and when the bridge disposed the previous instance, relative to the previous instance becoming visible. */
export interface DashboardDisposeContext {
  afterVisibleMs?: number
  beforeStartMs: number
  childPath: string
  hostPath: string
}

export interface DashboardStartClassification {
  awaySeconds?: number
  dispose?: DashboardDisposeContext
  disposeReason?: string
  kind: DashboardStartKind
  previousTopPath?: string
  previousVisibility?: DocumentVisibilityState
  recentLifecycle?: string[]
  sessionMarker: boolean
  topNavigationType?: string
  topPath?: string
}

// Length of the previous instance's latest absence: still away, or away until it last became visible again.
function awaySeconds(previous: DashboardSessionHeartbeat, now: number) {
  if (previous.hiddenAt === undefined) return undefined
  const returnedAt = previous.visibility === 'visible' && previous.visibleAt !== undefined && previous.visibleAt >= previous.hiddenAt
    ? previous.visibleAt
    : now
  return Math.max(0, Math.round((returnedAt - previous.hiddenAt) / 1_000))
}

function windowPath(targetWindow: Window) {
  try {
    return targetWindow.location.pathname
  } catch {
    return undefined
  }
}

// Compact `event:reason@hostPath -Ns` entries, newest last, so one log line shows the sequence around a restart.
function recentLifecycleSummary(events: ReactDashboardLifecycleEvent[] | undefined, now: number) {
  if (!events?.length) return undefined
  return events.slice(-RECENT_LIFECYCLE_EVENTS).map((event) => {
    const reason = event.reason ? `:${event.reason}` : ''
    const secondsAgo = Math.round((now - event.timestamp) / 100) / 10
    return `${event.event}${reason}@${event.hostPath} -${secondsAgo}s`
  })
}

type TelemetryWindow = Window & {
  [RESUME_TELEMETRY_RESULT_PROPERTY]?: DashboardStartClassification
  hassConnection?: Promise<{ conn: { sendMessagePromise: (message: Record<string, unknown>) => Promise<unknown> } }>
}

export function classifyDashboardStart(
  previous: DashboardSessionHeartbeat | undefined,
  current: DashboardStartSignals,
): DashboardStartClassification {
  const shared = {
    sessionMarker: current.sessionMarker,
    topNavigationType: current.topNavigationType,
    topPath: current.topPath,
  }
  if (!previous) return { ...shared, kind: 'first-start' }

  const context = {
    ...shared,
    awaySeconds: awaySeconds(previous, current.now),
    previousTopPath: previous.topPath,
    previousVisibility: previous.visibility,
    recentLifecycle: recentLifecycleSummary(current.lifecycle, current.now),
  }
  if (Math.round(previous.topOrigin) === Math.round(current.topOrigin)) {
    const disposeEvent = current.disposeEvent
    return {
      ...context,
      dispose: disposeEvent
        ? {
            afterVisibleMs: previous.visibleAt === undefined
              ? undefined
              : Math.round(disposeEvent.timestamp - previous.visibleAt),
            beforeStartMs: Math.max(0, Math.round(current.now - disposeEvent.timestamp)),
            childPath: disposeEvent.childPath,
            hostPath: disposeEvent.hostPath,
          }
        : undefined,
      disposeReason: disposeEvent?.reason ?? 'unknown',
      kind: 'dashboard-reload',
    }
  }
  if (previous.closedCleanly) return { ...context, kind: 'ha-page-reload' }
  return { ...context, kind: current.sessionMarker ? 'web-process-restart' : 'app-cold-start' }
}

function readHeartbeat(storage: Storage | undefined) {
  try {
    const raw = storage?.getItem(RESUME_TELEMETRY_STORAGE_KEY)
    return raw ? JSON.parse(raw) as DashboardSessionHeartbeat : undefined
  } catch {
    return undefined
  }
}

function writeHeartbeat(storage: Storage | undefined, heartbeat: DashboardSessionHeartbeat) {
  try {
    storage?.setItem(RESUME_TELEMETRY_STORAGE_KEY, JSON.stringify(heartbeat))
  } catch {
    // Storage can be unavailable (private mode, quota); telemetry is best effort.
  }
}

function safeStorage(read: () => Storage) {
  try {
    return read()
  } catch {
    return undefined
  }
}

// sessionStorage belongs to the web view session: WebKit keeps it across its own reload of a crashed page, while a
// relaunched app process starts a fresh one.
function claimSessionMarker(storage: Storage | undefined) {
  try {
    const seen = storage?.getItem(RESUME_TELEMETRY_SESSION_KEY) === 'true'
    storage?.setItem(RESUME_TELEMETRY_SESSION_KEY, 'true')
    return seen
  } catch {
    return false
  }
}

function navigationType(targetWindow: Window) {
  try {
    const [entry] = targetWindow.performance.getEntriesByType('navigation') as PerformanceNavigationTiming[]
    return entry?.type
  } catch {
    return undefined
  }
}

async function reportToHomeAssistant(hostWindow: TelemetryWindow, classification: DashboardStartClassification) {
  const connection = hostWindow.hassConnection
  if (!connection) return
  const timeout = new Promise<undefined>((resolve) => {
    hostWindow.setTimeout(() => resolve(undefined), HASS_CONNECTION_TIMEOUT_MS)
  })
  const resolved = await Promise.race([connection, timeout])
  if (!resolved) return
  const logLine = [
    RESUME_TELEMETRY_LOG_PREFIX,
    JSON.stringify({ ...classification, userAgent: hostWindow.navigator.userAgent.slice(0, 160) }),
  ].join(' ')
  await resolved.conn.sendMessagePromise({
    type: 'call_service',
    domain: 'system_log',
    service: 'write',
    service_data: {
      level: 'warning',
      logger: RESUME_TELEMETRY_LOGGER,
      message: logLine,
    },
  })
}

interface InstallResumeTelemetryOptions {
  currentWindow?: Window
  instanceId: string
  now?: () => number
  report?: (hostWindow: Window, classification: DashboardStartClassification) => Promise<void>
}

/**
 * Records why each React Dash instance started and keeps a heartbeat for the next one. Resume restarts are
 * otherwise invisible: the evidence (lifecycle history, page state) dies with the page that reloaded.
 */
export function installResumeTelemetry({
  currentWindow = window,
  instanceId,
  now = Date.now,
  report = (hostWindow, classification) => reportToHomeAssistant(hostWindow as TelemetryWindow, classification),
}: InstallResumeTelemetryOptions) {
  const hostWindow = reactDashboardLifecycleHost(currentWindow) as TelemetryWindow
  const storage = safeStorage(() => currentWindow.localStorage)
  const sessionStorage = safeStorage(() => hostWindow.sessionStorage)
  const previous = readHeartbeat(storage)
  const topOrigin = hostWindow.performance.timeOrigin

  const sessionMarker = claimSessionMarker(sessionStorage)

  const lifecycle = readReactDashboardLifecycleHistory(currentWindow)
  const disposeEvent = previous
    ? lifecycle
      .filter((event) => event.instanceId === previous.instanceId && event.event === 'disposed')
      .at(-1)
    : undefined
  const classification = classifyDashboardStart(previous, {
    disposeEvent,
    lifecycle,
    now: now(),
    sessionMarker,
    topNavigationType: navigationType(hostWindow),
    topOrigin,
    topPath: windowPath(hostWindow),
  })
  hostWindow[RESUME_TELEMETRY_RESULT_PROPERTY] = classification

  const heartbeat: DashboardSessionHeartbeat = {
    closedCleanly: false,
    frameOrigin: currentWindow.performance.timeOrigin,
    instanceId,
    topOrigin,
    updatedAt: now(),
    visibility: currentWindow.document.visibilityState,
  }
  const persist = (changes: Partial<DashboardSessionHeartbeat>) => {
    Object.assign(heartbeat, changes, { topPath: windowPath(hostWindow), updatedAt: now() })
    writeHeartbeat(storage, heartbeat)
  }
  persist({})

  const onVisibilityChange = () => {
    const visibility = currentWindow.document.visibilityState
    persist(visibility === 'hidden' ? { hiddenAt: now(), visibility } : { visibility, visibleAt: now() })
  }
  const onPageHide = (event: Event) => {
    if ((event as PageTransitionEvent).persisted) return
    persist({ closedCleanly: true })
  }
  currentWindow.document.addEventListener('visibilitychange', onVisibilityChange)
  currentWindow.addEventListener('pagehide', onPageHide)

  if (classification.kind !== 'first-start') {
    report(hostWindow, classification).catch(() => undefined)
  }

  return {
    classification,
    dispose() {
      currentWindow.document.removeEventListener('visibilitychange', onVisibilityChange)
      currentWindow.removeEventListener('pagehide', onPageHide)
    },
  }
}
