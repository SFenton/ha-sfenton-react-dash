export const REACT_DASHBOARD_DISPOSE_PROPERTY = '__sfentonReactDashboardDispose'
export const REACT_DASHBOARD_LIFECYCLE_PROPERTY = '__sfentonReactDashboardLifecycle'
export const REACT_DASHBOARD_LIFECYCLE_HISTORY_PROPERTY = '__sfentonReactDashboardLifecycleHistory'

const LIFECYCLE_HISTORY_LIMIT = 40

export type ReactDashboardDisposer = (reason?: string) => boolean

export interface ReactDashboardLifecycleRegistration {
  dispose: ReactDashboardDisposer
  instanceId: string
  mountedAt: number
  timeOrigin: number
}

export interface ReactDashboardLifecycleEvent {
  childPath: string
  event: 'dispose-error' | 'disposed' | 'mounted'
  hostPath: string
  instanceId: string
  reason?: string
  timeOrigin: number
  timestamp: number
}

type LifecycleWindow = Window & {
  [REACT_DASHBOARD_DISPOSE_PROPERTY]?: ReactDashboardDisposer
  [REACT_DASHBOARD_LIFECYCLE_HISTORY_PROPERTY]?: string
  [REACT_DASHBOARD_LIFECYCLE_PROPERTY]?: ReactDashboardLifecycleRegistration
}

interface InstallReactDashboardLifecycleOptions {
  currentWindow?: Window
  instanceId?: string
  onDispose: () => void
}

function lifecycleWindow(currentWindow: Window) {
  return currentWindow as LifecycleWindow
}

export function reactDashboardLifecycleHost(currentWindow: Window = window) {
  try {
    const topWindow = currentWindow.top
    if (
      topWindow
      && topWindow !== currentWindow
      && topWindow.location.origin === currentWindow.location.origin
    ) {
      return topWindow
    }
  } catch {
    return currentWindow
  }

  return currentWindow
}

function parseLifecycleHistory(rawHistory: string | undefined) {
  if (!rawHistory) return []

  try {
    const history = JSON.parse(rawHistory)
    return Array.isArray(history) ? history as ReactDashboardLifecycleEvent[] : []
  } catch {
    return []
  }
}

function windowPathname(targetWindow: Window) {
  try {
    return targetWindow.location.pathname
  } catch {
    return ''
  }
}

function appendLifecycleEvent(
  hostWindow: Window,
  currentWindow: Window,
  event: Omit<ReactDashboardLifecycleEvent, 'childPath' | 'hostPath' | 'timestamp'>,
) {
  const hostState = lifecycleWindow(hostWindow)
  const history = parseLifecycleHistory(hostState[REACT_DASHBOARD_LIFECYCLE_HISTORY_PROPERTY])
  history.push({
    ...event,
    childPath: windowPathname(currentWindow),
    hostPath: windowPathname(hostWindow),
    timestamp: Date.now(),
  })
  hostState[REACT_DASHBOARD_LIFECYCLE_HISTORY_PROPERTY] = JSON.stringify(
    history.slice(-LIFECYCLE_HISTORY_LIMIT),
  )
}

function generatedInstanceId(currentWindow: Window) {
  if (typeof currentWindow.crypto?.randomUUID === 'function') {
    return currentWindow.crypto.randomUUID()
  }

  return `${currentWindow.performance.timeOrigin}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function readReactDashboardLifecycleHistory(currentWindow: Window = window) {
  const hostWindow = reactDashboardLifecycleHost(currentWindow)
  return parseLifecycleHistory(
    lifecycleWindow(hostWindow)[REACT_DASHBOARD_LIFECYCLE_HISTORY_PROPERTY],
  )
}

export function installReactDashboardLifecycle({
  currentWindow = window,
  instanceId = generatedInstanceId(currentWindow),
  onDispose,
}: InstallReactDashboardLifecycleOptions) {
  const appState = lifecycleWindow(currentWindow)
  const hostWindow = reactDashboardLifecycleHost(currentWindow)
  const hostState = lifecycleWindow(hostWindow)
  const timeOrigin = currentWindow.performance.timeOrigin
  const previousRegistration = hostState[REACT_DASHBOARD_LIFECYCLE_PROPERTY]

  if (previousRegistration) {
    try {
      previousRegistration.dispose('superseded-by-new-instance')
    } catch (error) {
      appendLifecycleEvent(hostWindow, currentWindow, {
        event: 'dispose-error',
        instanceId: previousRegistration.instanceId,
        reason: 'superseded-by-new-instance',
        timeOrigin: previousRegistration.timeOrigin,
      })
      console.error('Unable to dispose the previous React dashboard instance.', error)
    }

    if (hostState[REACT_DASHBOARD_LIFECYCLE_PROPERTY] === previousRegistration) {
      delete hostState[REACT_DASHBOARD_LIFECYCLE_PROPERTY]
    }
  }

  let disposed = false

  const dispose: ReactDashboardDisposer = (reason = 'external') => {
    if (disposed) return false
    disposed = true
    currentWindow.removeEventListener('pagehide', handlePageHide)

    if (appState[REACT_DASHBOARD_DISPOSE_PROPERTY] === dispose) {
      delete appState[REACT_DASHBOARD_DISPOSE_PROPERTY]
    }
    if (hostState[REACT_DASHBOARD_LIFECYCLE_PROPERTY] === registration) {
      delete hostState[REACT_DASHBOARD_LIFECYCLE_PROPERTY]
    }

    try {
      onDispose()
      appendLifecycleEvent(hostWindow, currentWindow, {
        event: 'disposed',
        instanceId,
        reason,
        timeOrigin,
      })
      return true
    } catch (error) {
      appendLifecycleEvent(hostWindow, currentWindow, {
        event: 'dispose-error',
        instanceId,
        reason,
        timeOrigin,
      })
      throw error
    }
  }

  const handlePageHide = (event: Event) => {
    if ((event as PageTransitionEvent).persisted) return

    try {
      dispose('pagehide')
    } catch (error) {
      console.error('Unable to dispose the React dashboard during pagehide.', error)
    }
  }

  const registration: ReactDashboardLifecycleRegistration = {
    dispose,
    instanceId,
    mountedAt: Date.now(),
    timeOrigin,
  }
  appState[REACT_DASHBOARD_DISPOSE_PROPERTY] = dispose
  hostState[REACT_DASHBOARD_LIFECYCLE_PROPERTY] = registration
  currentWindow.addEventListener('pagehide', handlePageHide)
  appendLifecycleEvent(hostWindow, currentWindow, {
    event: 'mounted',
    instanceId,
    timeOrigin,
  })

  return registration
}

export function disposeReactDashboardFrame(
  iframe: HTMLIFrameElement | null | undefined,
  reason: string,
) {
  const childWindow = iframe?.contentWindow
  if (!childWindow) return false

  try {
    const dispose = lifecycleWindow(childWindow)[REACT_DASHBOARD_DISPOSE_PROPERTY]
    if (typeof dispose !== 'function') return false
    return dispose(reason)
  } catch (error) {
    console.error('Unable to dispose the embedded React dashboard.', error)
    return false
  }
}
