import { readFile } from 'node:fs/promises'
import {
  RESUME_TELEMETRY_LOGGER,
  RESUME_TELEMETRY_REPAIRED_PATH_PROPERTY,
  RESUME_TELEMETRY_RESULT_PROPERTY,
  RESUME_TELEMETRY_SESSION_KEY,
  RESUME_TELEMETRY_STORAGE_KEY,
  classifyDashboardStart,
  installResumeTelemetry,
  type DashboardSessionHeartbeat,
} from './resumeTelemetry'
import { REACT_DASHBOARD_LIFECYCLE_HISTORY_PROPERTY } from './reactDashboardLifecycle'

const previous: DashboardSessionHeartbeat = {
  closedCleanly: false,
  frameOrigin: 1_010,
  hiddenAt: 10_000,
  instanceId: 'previous',
  topOrigin: 1_000,
  updatedAt: 10_000,
  visibility: 'hidden',
}

function setVisibility(visibilityState: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: visibilityState })
  document.dispatchEvent(new Event('visibilitychange'))
}

function pageHide(persisted: boolean) {
  const event = new Event('pagehide')
  Object.defineProperty(event, 'persisted', { value: persisted })
  window.dispatchEvent(event)
}

function storedHeartbeat() {
  return JSON.parse(window.localStorage.getItem(RESUME_TELEMETRY_STORAGE_KEY) ?? 'null') as DashboardSessionHeartbeat | null
}

describe('classifyDashboardStart', () => {
  const current = { now: 70_000, sessionMarker: true, topNavigationType: 'navigate', topOrigin: 5_000 }

  it('reports a first start without a previous heartbeat', () => {
    expect(classifyDashboardStart(undefined, current)).toEqual({
      kind: 'first-start',
      sessionMarker: true,
      topNavigationType: 'navigate',
    })
  })

  it('attributes a restart inside the same HA page to the dashboard bridge', () => {
    expect(classifyDashboardStart(previous, {
      ...current,
      disposeEvent: {
        childPath: '/local/ha-sfenton-react-dash/index.html',
        event: 'disposed',
        hostPath: '/sfenton-react-dash/home',
        instanceId: 'previous',
        reason: 'legacy-card-source-change',
        timeOrigin: 1_010,
        timestamp: 69_500,
      },
      topOrigin: 1_000.4,
    })).toMatchObject({
      awaySeconds: 60,
      dispose: {
        afterVisibleMs: undefined,
        beforeStartMs: 500,
        childPath: '/local/ha-sfenton-react-dash/index.html',
        hostPath: '/sfenton-react-dash/home',
      },
      disposeReason: 'legacy-card-source-change',
      kind: 'dashboard-reload',
      previousVisibility: 'hidden',
    })
    expect(classifyDashboardStart(previous, { ...current, topOrigin: 1_000 })).toMatchObject({
      dispose: undefined,
      disposeReason: 'unknown',
    })
  })

  it('times a teardown that follows a return from the background', () => {
    // The first reported phone restart: away 5 min 24 s, torn down shortly after becoming visible again.
    const returned = { ...previous, topPath: '/sfenton-react-dash/home', visibility: 'visible' as const, visibleAt: 334_000 }
    const classification = classifyDashboardStart(returned, {
      ...current,
      disposeEvent: {
        childPath: '/local/ha-sfenton-react-dash/index.html',
        event: 'disposed',
        hostPath: '/sfenton-react-dash',
        instanceId: 'previous',
        reason: 'legacy-card-disconnected',
        timeOrigin: 1_010,
        timestamp: 334_700,
      },
      lifecycle: [
        { childPath: '/a', event: 'mounted', hostPath: '/sfenton-react-dash/home', instanceId: 'previous', timeOrigin: 1_010, timestamp: 2_000 },
        { childPath: '/a', event: 'disposed', hostPath: '/sfenton-react-dash', instanceId: 'previous', reason: 'legacy-card-disconnected', timeOrigin: 1_010, timestamp: 334_700 },
        { childPath: '/a', event: 'mounted', hostPath: '/sfenton-react-dash/home', instanceId: 'next', timeOrigin: 334_800, timestamp: 334_950 },
      ],
      now: 335_000,
      topOrigin: 1_000,
      topPath: '/sfenton-react-dash/home',
    })

    expect(classification).toMatchObject({
      awaySeconds: 324,
      dispose: { afterVisibleMs: 700, beforeStartMs: 300, hostPath: '/sfenton-react-dash' },
      disposeReason: 'legacy-card-disconnected',
      kind: 'dashboard-reload',
      previousTopPath: '/sfenton-react-dash/home',
      previousVisibility: 'visible',
      recentLifecycle: [
        'mounted@/sfenton-react-dash/home -333s',
        'disposed:legacy-card-disconnected@/sfenton-react-dash -0.3s',
        'mounted@/sfenton-react-dash/home -0.1s',
      ],
      topPath: '/sfenton-react-dash/home',
    })
  })

  it('treats a clean HA page exit as an ordinary reload', () => {
    expect(classifyDashboardStart({ ...previous, closedCleanly: true }, {
      ...current,
      topNavigationType: 'reload',
    }).kind).toBe('ha-page-reload')
  })

  it('identifies a web process restore by the surviving web view session', () => {
    // Observed in the iOS simulator: WebKit restores a killed web content process as back_forward.
    expect(classifyDashboardStart(previous, { ...current, topNavigationType: 'back_forward' })).toMatchObject({
      awaySeconds: 60,
      kind: 'web-process-restart',
      topNavigationType: 'back_forward',
    })
  })

  it('identifies an app relaunch by the missing web view session', () => {
    expect(classifyDashboardStart(previous, { ...current, sessionMarker: false })).toMatchObject({
      awaySeconds: 60,
      kind: 'app-cold-start',
      previousVisibility: 'hidden',
    })
    expect(classifyDashboardStart({ ...previous, hiddenAt: undefined, visibility: 'visible' }, {
      ...current,
      sessionMarker: false,
    })).toMatchObject({ awaySeconds: undefined, kind: 'app-cold-start', previousVisibility: 'visible' })
  })
})

describe('installResumeTelemetry', () => {
  afterEach(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
    Reflect.deleteProperty(document, 'visibilityState')
    Reflect.deleteProperty(window, RESUME_TELEMETRY_RESULT_PROPERTY)
    Reflect.deleteProperty(window, RESUME_TELEMETRY_REPAIRED_PATH_PROPERTY)
    Reflect.deleteProperty(window, REACT_DASHBOARD_LIFECYCLE_HISTORY_PROPERTY)
    Reflect.deleteProperty(window, 'hassConnection')
  })

  it('stays quiet on first start and records a heartbeat for the next instance', () => {
    const report = vi.fn(async () => undefined)
    const telemetry = installResumeTelemetry({ instanceId: 'first', now: () => 5_000, report })

    expect(telemetry.classification.kind).toBe('first-start')
    expect(report).not.toHaveBeenCalled()
    expect(window.sessionStorage.getItem(RESUME_TELEMETRY_SESSION_KEY)).toBe('true')
    expect(storedHeartbeat()).toMatchObject({
      closedCleanly: false,
      instanceId: 'first',
      topOrigin: window.performance.timeOrigin,
    })
    telemetry.dispose()
  })

  it('tracks hidden time and clean exits in the heartbeat', () => {
    let clock = 5_000
    const telemetry = installResumeTelemetry({ instanceId: 'first', now: () => clock, report: vi.fn() })

    clock = 6_000
    setVisibility('hidden')
    expect(storedHeartbeat()).toMatchObject({ hiddenAt: 6_000, visibility: 'hidden' })

    clock = 9_000
    setVisibility('visible')
    expect(storedHeartbeat()).toMatchObject({ hiddenAt: 6_000, visibility: 'visible', visibleAt: 9_000 })
    expect(storedHeartbeat()?.topPath).toBe(window.location.pathname)

    pageHide(true)
    expect(storedHeartbeat()?.closedCleanly).toBe(false)
    pageHide(false)
    expect(storedHeartbeat()?.closedCleanly).toBe(true)

    telemetry.dispose()
    setVisibility('hidden')
    expect(storedHeartbeat()?.visibility).toBe('visible')
  })

  it('classifies a dashboard reload with its bridge dispose reason and reports it', async () => {
    window.localStorage.setItem(RESUME_TELEMETRY_STORAGE_KEY, JSON.stringify({
      ...previous,
      topOrigin: window.performance.timeOrigin,
    }))
    ;(window as unknown as Record<string, unknown>)[REACT_DASHBOARD_LIFECYCLE_HISTORY_PROPERTY] = JSON.stringify([
      { childPath: '/app', event: 'mounted', hostPath: '/sfenton-react-dash/home', instanceId: 'previous', timestamp: 1 },
      { childPath: '/app', event: 'disposed', hostPath: '/sfenton-react-dash/home', instanceId: 'other', reason: 'pagehide', timestamp: 2 },
      { childPath: '/app', event: 'disposed', hostPath: '/sfenton-react-dash/home', instanceId: 'previous', reason: 'legacy-card-source-change', timestamp: 3 },
    ])
    const report = vi.fn(async () => undefined)

    const telemetry = installResumeTelemetry({ instanceId: 'next', now: () => 70_000, report })

    expect(telemetry.classification).toMatchObject({
      awaySeconds: 60,
      disposeReason: 'legacy-card-source-change',
      kind: 'dashboard-reload',
      recentLifecycle: expect.arrayContaining([expect.stringMatching(/^disposed:legacy-card-source-change@/)]),
    })
    expect((window as unknown as Record<string, unknown>)[RESUME_TELEMETRY_RESULT_PROPERTY])
      .toBe(telemetry.classification)
    expect(report).toHaveBeenCalledWith(window, telemetry.classification)
    telemetry.dispose()
  })

  it('writes the classification to the Home Assistant system log over the inherited connection', async () => {
    window.localStorage.setItem(RESUME_TELEMETRY_STORAGE_KEY, JSON.stringify(previous))
    const sendMessagePromise = vi.fn(async () => undefined)
    ;(window as unknown as Record<string, unknown>).hassConnection = Promise.resolve({ conn: { sendMessagePromise } })

    const telemetry = installResumeTelemetry({ instanceId: 'next', now: () => 70_000 })

    await vi.waitFor(() => expect(sendMessagePromise).toHaveBeenCalledTimes(1))
    expect(sendMessagePromise).toHaveBeenCalledWith(expect.objectContaining({
      domain: 'system_log',
      service: 'write',
      service_data: expect.objectContaining({
        level: 'warning',
        logger: RESUME_TELEMETRY_LOGGER,
        message: expect.stringContaining('"kind":"app-cold-start"'),
      }),
      type: 'call_service',
    }))
    telemetry.dispose()
  })

  it('reports the HA path the card bridge repaired before this start', () => {
    window.localStorage.setItem(RESUME_TELEMETRY_STORAGE_KEY, JSON.stringify(previous))
    ;(window as unknown as Record<string, unknown>)[RESUME_TELEMETRY_REPAIRED_PATH_PROPERTY] = '/sfenton-react-dash/home&path=office'
    const report = vi.fn(async () => undefined)

    const telemetry = installResumeTelemetry({ instanceId: 'next', now: () => 70_000, report })

    expect(telemetry.classification).toMatchObject({
      kind: 'app-cold-start',
      repairedTopPath: '/sfenton-react-dash/home&path=office',
    })
    expect(report).toHaveBeenCalledWith(window, expect.objectContaining({
      repairedTopPath: '/sfenton-react-dash/home&path=office',
    }))
    telemetry.dispose()
  })

  it('treats an unreadable heartbeat as a first start', () => {
    window.localStorage.setItem(RESUME_TELEMETRY_STORAGE_KEY, '{not json')
    const report = vi.fn(async () => undefined)

    const telemetry = installResumeTelemetry({ instanceId: 'next', now: () => 70_000, report })

    expect(telemetry.classification.kind).toBe('first-start')
    expect(report).not.toHaveBeenCalled()
    telemetry.dispose()
  })

  it('swallows a failed report without affecting the dashboard', async () => {
    window.localStorage.setItem(RESUME_TELEMETRY_STORAGE_KEY, JSON.stringify(previous))
    const report = vi.fn(async () => {
      throw new Error('offline')
    })

    const telemetry = installResumeTelemetry({ instanceId: 'next', now: () => 70_000, report })

    expect(telemetry.classification.kind).toBe('app-cold-start')
    await vi.waitFor(() => expect(report).toHaveBeenCalledTimes(1))
    expect(storedHeartbeat()?.instanceId).toBe('next')
    telemetry.dispose()
  })
})

describe('dashboard entry', () => {
  it('records every dashboard instance and stops recording when it is disposed', async () => {
    const source = await readFile('src/main.tsx', 'utf8')

    expect(source).toContain('installResumeTelemetry({ instanceId: lifecycle.instanceId })')
    expect(source).toMatch(/onDispose: \(\) => \{\s+resumeTelemetry\.dispose\(\)/)
  })
})
// @covers src/main.tsx
