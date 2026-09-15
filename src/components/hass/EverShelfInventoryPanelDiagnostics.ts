export const GROCERY_DELETE_DIALOG_DIAGNOSTICS_PROPERTY = '__sfentonGroceryDeleteDialogDiagnostics'

const GROCERY_DELETE_DIALOG_MAX_EVENTS = 40

export type GroceryDeleteDialogPlatform = 'android' | 'ios' | 'linux' | 'macos' | 'other' | 'windows'
export type GroceryDeleteDialogHost = 'custom-panel' | 'legacy-wrapper' | 'other' | 'raw-app'
export type GroceryDeleteDialogVisibility = '' | 'hidden' | 'prerender' | 'visible'
export type GroceryDeleteDialogEventName =
  | 'confirm-opened'
  | 'confirm-resolved'
  | 'prompt-opened'
  | 'prompt-parsed'
  | 'prompt-resolved'

export interface GroceryDeleteDialogDiagnosticEvent {
  childHost: GroceryDeleteDialogHost
  elapsedMs?: number
  event: GroceryDeleteDialogEventName
  hostHost: GroceryDeleteDialogHost
  maximumQuantity?: number
  platform: GroceryDeleteDialogPlatform
  result?: 'accepted' | 'cancelled' | 'error' | 'invalid' | 'valid' | 'value'
  sequence: number
  viewportHeight: number
  viewportWidth: number
  visibilityState: GroceryDeleteDialogVisibility
}

type DiagnosticsWindow = Window & {
  [GROCERY_DELETE_DIALOG_DIAGNOSTICS_PROPERTY]?: string
}

interface GroceryDeleteDialogDiagnosticOptions {
  currentWindow?: Window
  now?: () => number
}

const EVENT_NAMES = new Set<GroceryDeleteDialogEventName>([
  'confirm-opened',
  'confirm-resolved',
  'prompt-opened',
  'prompt-parsed',
  'prompt-resolved',
])
const HOSTS = new Set<GroceryDeleteDialogHost>([
  'custom-panel',
  'legacy-wrapper',
  'other',
  'raw-app',
])
const PLATFORMS = new Set<GroceryDeleteDialogPlatform>([
  'android',
  'ios',
  'linux',
  'macos',
  'other',
  'windows',
])
const RESULTS = new Set<NonNullable<GroceryDeleteDialogDiagnosticEvent['result']>>([
  'accepted',
  'cancelled',
  'error',
  'invalid',
  'valid',
  'value',
])
const VISIBILITY_VALUES = new Set<GroceryDeleteDialogVisibility>([
  '',
  'hidden',
  'prerender',
  'visible',
])

function diagnosticsWindow(currentWindow: Window) {
  return currentWindow as DiagnosticsWindow
}

export function groceryDeleteDialogDiagnosticsHost(currentWindow: Window = window) {
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

function isFiniteNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function hostCategoryFromPath(value: unknown): GroceryDeleteDialogHost {
  if (value === '/local/ha-sfenton-react-dash/index.html') return 'raw-app'
  if (value === '/sfenton-react-dash/home') return 'legacy-wrapper'
  if (value === '/sfenton-react-panel') return 'custom-panel'
  return 'other'
}

function normalizeHostCategory(
  category: unknown,
  legacyPath: unknown,
): GroceryDeleteDialogHost {
  if (typeof category === 'string' && HOSTS.has(category as GroceryDeleteDialogHost)) {
    return category as GroceryDeleteDialogHost
  }
  return hostCategoryFromPath(legacyPath)
}

function normalizeDiagnosticEvent(value: unknown): GroceryDeleteDialogDiagnosticEvent | null {
  if (!value || typeof value !== 'object') return null
  const event = value as Partial<GroceryDeleteDialogDiagnosticEvent> & {
    childPath?: unknown
    hostPath?: unknown
  }

  const valid = (event.elapsedMs === undefined || isFiniteNonNegativeNumber(event.elapsedMs))
    && typeof event.event === 'string'
    && EVENT_NAMES.has(event.event as GroceryDeleteDialogEventName)
    && (event.maximumQuantity === undefined || isFiniteNonNegativeNumber(event.maximumQuantity))
    && typeof event.platform === 'string'
    && PLATFORMS.has(event.platform as GroceryDeleteDialogPlatform)
    && (event.result === undefined || RESULTS.has(event.result))
    && typeof event.sequence === 'number'
    && Number.isSafeInteger(event.sequence)
    && event.sequence >= 1
    && isFiniteNonNegativeNumber(event.viewportHeight)
    && isFiniteNonNegativeNumber(event.viewportWidth)
    && typeof event.visibilityState === 'string'
    && VISIBILITY_VALUES.has(event.visibilityState as GroceryDeleteDialogVisibility)
  if (!valid) return null

  return {
    childHost: normalizeHostCategory(event.childHost, event.childPath),
    ...(event.elapsedMs === undefined ? {} : { elapsedMs: event.elapsedMs }),
    event: event.event as GroceryDeleteDialogEventName,
    hostHost: normalizeHostCategory(event.hostHost, event.hostPath),
    ...(event.maximumQuantity === undefined ? {} : { maximumQuantity: event.maximumQuantity }),
    platform: event.platform as GroceryDeleteDialogPlatform,
    ...(event.result === undefined ? {} : { result: event.result }),
    sequence: event.sequence!,
    viewportHeight: event.viewportHeight!,
    viewportWidth: event.viewportWidth!,
    visibilityState: event.visibilityState as GroceryDeleteDialogVisibility,
  }
}

function parseDiagnosticHistory(rawHistory: string | undefined) {
  if (!rawHistory) return { history: [], maximumSequence: 0 }

  try {
    const history: unknown = JSON.parse(rawHistory)
    if (!Array.isArray(history)) return { history: [], maximumSequence: 0 }

    const validHistory = history
      .map(normalizeDiagnosticEvent)
      .filter((event): event is GroceryDeleteDialogDiagnosticEvent => event !== null)
    return {
      history: validHistory      .slice(-GROCERY_DELETE_DIALOG_MAX_EVENTS),
      maximumSequence: validHistory.reduce(
        (maximum, event) => Math.max(maximum, event.sequence),
        0,
      ),
    }
  } catch {
    return { history: [], maximumSequence: 0 }
  }
}

function windowHostCategory(targetWindow: Window) {
  try {
    return hostCategoryFromPath(targetWindow.location.pathname)
  } catch {
    return 'other'
  }
}

function windowVisibility(currentWindow: Window): GroceryDeleteDialogVisibility {
  try {
    const state = currentWindow.document.visibilityState
    return VISIBILITY_VALUES.has(state as GroceryDeleteDialogVisibility)
      ? state as GroceryDeleteDialogVisibility
      : ''
  } catch {
    return ''
  }
}

function platformCategory(currentWindow: Window): GroceryDeleteDialogPlatform {
  let userAgent: string
  let maxTouchPoints: number
  try {
    userAgent = currentWindow.navigator.userAgent.toLowerCase()
    maxTouchPoints = currentWindow.navigator.maxTouchPoints
  } catch {
    return 'other'
  }

  if (userAgent.includes('android')) return 'android'
  if (/iphone|ipad|ipod/.test(userAgent) || (userAgent.includes('macintosh') && maxTouchPoints > 1)) {
    return 'ios'
  }
  if (userAgent.includes('windows')) return 'windows'
  if (userAgent.includes('macintosh') || userAgent.includes('mac os')) return 'macos'
  if (userAgent.includes('linux')) return 'linux'
  return 'other'
}

function viewportDimension(value: number) {
  return Number.isFinite(value) && value >= 0 ? value : 0
}

function appendDiagnosticEvent(
  currentWindow: Window,
  event: Pick<GroceryDeleteDialogDiagnosticEvent, 'elapsedMs' | 'event' | 'maximumQuantity' | 'result'>,
) {
  try {
    const hostWindow = groceryDeleteDialogDiagnosticsHost(currentWindow)
    const hostState = diagnosticsWindow(hostWindow)
    const parsedHistory = parseDiagnosticHistory(
      hostState[GROCERY_DELETE_DIALOG_DIAGNOSTICS_PROPERTY],
    )
    if (parsedHistory.maximumSequence >= Number.MAX_SAFE_INTEGER) return

    const sequence = parsedHistory.maximumSequence + 1
    const history = parsedHistory.history
    history.push({
      childHost: windowHostCategory(currentWindow),
      ...(event.elapsedMs === undefined ? {} : { elapsedMs: event.elapsedMs }),
      event: event.event,
      hostHost: windowHostCategory(hostWindow),
      ...(event.maximumQuantity === undefined ? {} : { maximumQuantity: event.maximumQuantity }),
      platform: platformCategory(currentWindow),
      ...(event.result === undefined ? {} : { result: event.result }),
      sequence,
      viewportHeight: viewportDimension(currentWindow.innerHeight),
      viewportWidth: viewportDimension(currentWindow.innerWidth),
      visibilityState: windowVisibility(currentWindow),
    })
    hostState[GROCERY_DELETE_DIALOG_DIAGNOSTICS_PROPERTY] = JSON.stringify(
      history.slice(-GROCERY_DELETE_DIALOG_MAX_EVENTS),
    )
  } catch {
    // Diagnostics must never interfere with the native deletion flow.
  }
}

function diagnosticOptions(options: GroceryDeleteDialogDiagnosticOptions) {
  try {
    return {
      currentWindow: options.currentWindow ?? window,
      now: options.now,
    }
  } catch {
    return { currentWindow: window, now: undefined }
  }
}

function safeNow(currentWindow: Window, now?: () => number) {
  try {
    const value = now ? now() : currentWindow.performance.now()
    return isFiniteNonNegativeNumber(value) ? value : undefined
  } catch {
    return undefined
  }
}

function safeElapsedMs(startedAt: number | undefined, resolvedAt: number | undefined) {
  if (startedAt === undefined || resolvedAt === undefined) return undefined
  const elapsedMs = resolvedAt - startedAt
  return isFiniteNonNegativeNumber(elapsedMs) ? elapsedMs : undefined
}

export function readGroceryDeleteDialogDiagnostics(currentWindow: Window = window) {
  try {
    const hostWindow = groceryDeleteDialogDiagnosticsHost(currentWindow)
    return parseDiagnosticHistory(
      diagnosticsWindow(hostWindow)[GROCERY_DELETE_DIALOG_DIAGNOSTICS_PROPERTY],
    ).history
  } catch {
    return []
  }
}

export function runGroceryDeleteConfirm(
  openDialog: () => boolean,
  options: GroceryDeleteDialogDiagnosticOptions = {},
) {
  const { currentWindow, now } = diagnosticOptions(options)
  const openedAt = safeNow(currentWindow, now)
  appendDiagnosticEvent(currentWindow, { event: 'confirm-opened' })
  try {
    const accepted = openDialog()
    appendDiagnosticEvent(currentWindow, {
      elapsedMs: safeElapsedMs(openedAt, safeNow(currentWindow, now)),
      event: 'confirm-resolved',
      result: accepted ? 'accepted' : 'cancelled',
    })
    return accepted
  } catch (error) {
    appendDiagnosticEvent(currentWindow, {
      elapsedMs: safeElapsedMs(openedAt, safeNow(currentWindow, now)),
      event: 'confirm-resolved',
      result: 'error',
    })
    throw error
  }
}

export function runGroceryDeletePrompt(
  maximumQuantity: number,
  openDialog: () => string | null,
  options: GroceryDeleteDialogDiagnosticOptions = {},
) {
  const { currentWindow, now } = diagnosticOptions(options)
  const openedAt = safeNow(currentWindow, now)
  appendDiagnosticEvent(currentWindow, { event: 'prompt-opened', maximumQuantity })
  try {
    const value = openDialog()
    appendDiagnosticEvent(currentWindow, {
      elapsedMs: safeElapsedMs(openedAt, safeNow(currentWindow, now)),
      event: 'prompt-resolved',
      maximumQuantity,
      result: value === null ? 'cancelled' : 'value',
    })
    return value
  } catch (error) {
    appendDiagnosticEvent(currentWindow, {
      elapsedMs: safeElapsedMs(openedAt, safeNow(currentWindow, now)),
      event: 'prompt-resolved',
      maximumQuantity,
      result: 'error',
    })
    throw error
  }
}

export function recordGroceryDeletePromptParsing(
  maximumQuantity: number,
  valid: boolean,
  options: GroceryDeleteDialogDiagnosticOptions = {},
) {
  const { currentWindow } = diagnosticOptions(options)
  appendDiagnosticEvent(currentWindow, {
    event: 'prompt-parsed',
    maximumQuantity,
    result: valid ? 'valid' : 'invalid',
  })
}
