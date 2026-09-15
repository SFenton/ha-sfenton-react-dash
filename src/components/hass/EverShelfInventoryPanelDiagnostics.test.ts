import {
  GROCERY_DELETE_DIALOG_DIAGNOSTICS_PROPERTY,
  groceryDeleteDialogDiagnosticsHost,
  readGroceryDeleteDialogDiagnostics,
  recordGroceryDeletePromptParsing,
  runGroceryDeleteConfirm,
  runGroceryDeletePrompt,
} from './EverShelfInventoryPanelDiagnostics'

function fakeWindow({
  height = 852,
  maxTouchPoints = 0,
  pathname,
  topWindow,
  userAgent = 'Mozilla/5.0 (Linux; Android 15)',
  visibilityState = 'visible',
  width = 393,
}: {
  height?: number
  maxTouchPoints?: number
  pathname: string
  topWindow?: Window
  userAgent?: string
  visibilityState?: DocumentVisibilityState
  width?: number
}) {
  const target = new EventTarget()
  Object.defineProperties(target, {
    document: { value: { visibilityState } },
    innerHeight: { value: height },
    innerWidth: { value: width },
    location: {
      value: {
        origin: 'https://ha.example',
        pathname,
      },
    },
    navigator: {
      value: {
        maxTouchPoints,
        userAgent,
      },
    },
    performance: { value: { now: () => 0 } },
    top: {
      configurable: true,
      value: topWindow ?? target,
    },
  })
  return target as unknown as Window
}

function propertyState(targetWindow: Window) {
  return targetWindow as unknown as Record<string, unknown>
}

describe('grocery delete dialog diagnostics', () => {
  it('records native dialog order, outcomes, bounded prompt context, and monotonic elapsed time', () => {
    const currentWindow = fakeWindow({ pathname: '/local/dashboard/index.html' })
    const clock = vi.fn()
      .mockReturnValueOnce(10)
      .mockReturnValueOnce(14)
      .mockReturnValueOnce(20)
      .mockReturnValueOnce(20)

    expect(runGroceryDeleteConfirm(() => true, { currentWindow, now: clock })).toBe(true)
    expect(runGroceryDeletePrompt(2, () => null, { currentWindow, now: clock })).toBeNull()

    expect(readGroceryDeleteDialogDiagnostics(currentWindow)).toEqual([
      expect.objectContaining({ event: 'confirm-opened', sequence: 1 }),
      expect.objectContaining({
        elapsedMs: 4,
        event: 'confirm-resolved',
        result: 'accepted',
        sequence: 2,
      }),
      expect.objectContaining({ event: 'prompt-opened', maximumQuantity: 2, sequence: 3 }),
      expect.objectContaining({
        elapsedMs: 0,
        event: 'prompt-resolved',
        maximumQuantity: 2,
        result: 'cancelled',
        sequence: 4,
      }),
    ])
  })

  it('records parsing categories without retaining entered values or arbitrary dialog context', () => {
    const currentWindow = fakeWindow({
      height: 741,
      maxTouchPoints: 5,
      pathname: '/sfenton-react-panel',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit Mobile',
      visibilityState: 'hidden',
      width: 1152,
    })

    runGroceryDeletePrompt(7, () => 'private entered quantity', {
      currentWindow,
      now: vi.fn().mockReturnValueOnce(30).mockReturnValueOnce(33),
    })
    recordGroceryDeletePromptParsing(7, false, { currentWindow })

    const history = readGroceryDeleteDialogDiagnostics(currentWindow)
    expect(history.map(({ event, result }) => ({ event, result }))).toEqual([
      { event: 'prompt-opened', result: undefined },
      { event: 'prompt-resolved', result: 'value' },
      { event: 'prompt-parsed', result: 'invalid' },
    ])
    expect(history[1]).toEqual({
      childHost: 'custom-panel',
      elapsedMs: 3,
      event: 'prompt-resolved',
      hostHost: 'custom-panel',
      maximumQuantity: 7,
      platform: 'ios',
      result: 'value',
      sequence: 2,
      viewportHeight: 741,
      viewportWidth: 1152,
      visibilityState: 'hidden',
    })
    expect(JSON.stringify(history)).not.toContain('private entered quantity')
    expect(Object.keys(history[1]).sort()).toEqual([
      'childHost',
      'elapsedMs',
      'event',
      'hostHost',
      'maximumQuantity',
      'platform',
      'result',
      'sequence',
      'viewportHeight',
      'viewportWidth',
      'visibilityState',
    ])
  })

  it('exposes serialized history on the same-origin top host', () => {
    const hostWindow = fakeWindow({ pathname: '/sfenton-react-dash/home' })
    const childWindow = fakeWindow({
      pathname: '/local/ha-sfenton-react-dash/index.html',
      topWindow: hostWindow,
    })

    runGroceryDeleteConfirm(() => false, {
      currentWindow: childWindow,
      now: vi.fn().mockReturnValueOnce(5).mockReturnValueOnce(6),
    })

    expect(groceryDeleteDialogDiagnosticsHost(childWindow)).toBe(hostWindow)
    expect(propertyState(childWindow)[GROCERY_DELETE_DIALOG_DIAGNOSTICS_PROPERTY]).toBeUndefined()
    expect(typeof propertyState(hostWindow)[GROCERY_DELETE_DIALOG_DIAGNOSTICS_PROPERTY]).toBe('string')
    expect(readGroceryDeleteDialogDiagnostics(childWindow)).toMatchObject([
      {
        childHost: 'raw-app',
        event: 'confirm-opened',
        hostHost: 'legacy-wrapper',
      },
      {
        event: 'confirm-resolved',
        result: 'cancelled',
      },
    ])
  })

  it('falls back to the current frame when top-window access is cross-origin', () => {
    const inaccessibleTop = {} as Window
    Object.defineProperty(inaccessibleTop, 'location', {
      get() {
        throw new DOMException('Blocked', 'SecurityError')
      },
    })
    const currentWindow = fakeWindow({
      pathname: '/local/ha-sfenton-react-dash/index.html',
      topWindow: inaccessibleTop,
    })

    runGroceryDeleteConfirm(() => true, {
      currentWindow,
      now: vi.fn().mockReturnValueOnce(1).mockReturnValueOnce(2),
    })

    expect(groceryDeleteDialogDiagnosticsHost(currentWindow)).toBe(currentWindow)
    expect(readGroceryDeleteDialogDiagnostics(currentWindow)).toHaveLength(2)
  })

  it('does not interfere when diagnostic storage is inaccessible', () => {
    const currentWindow = fakeWindow({ pathname: '/sfenton-react-panel' })
    Object.defineProperty(currentWindow, GROCERY_DELETE_DIALOG_DIAGNOSTICS_PROPERTY, {
      configurable: true,
      get() {
        throw new Error('storage read failed')
      },
      set() {
        throw new Error('storage write failed')
      },
    })
    const openDialog = vi.fn(() => true)

    expect(runGroceryDeleteConfirm(openDialog, { currentWindow })).toBe(true)
    expect(openDialog).toHaveBeenCalledOnce()
    expect(readGroceryDeleteDialogDiagnostics(currentWindow)).toEqual([])
  })

  it('keeps timing failures outside native dialog behavior and omits unavailable elapsed time', () => {
    const currentWindow = fakeWindow({ pathname: '/sfenton-react-panel' })
    const confirmDialog = vi.fn(() => true)
    const promptDialog = vi.fn(() => '2')
    const failingClock = vi.fn(() => {
      throw new Error('clock failed')
    })

    expect(runGroceryDeleteConfirm(confirmDialog, { currentWindow, now: failingClock })).toBe(true)
    expect(runGroceryDeletePrompt(2, promptDialog, { currentWindow, now: failingClock })).toBe('2')
    expect(confirmDialog).toHaveBeenCalledOnce()
    expect(promptDialog).toHaveBeenCalledOnce()
    expect(readGroceryDeleteDialogDiagnostics(currentWindow)).toMatchObject([
      { event: 'confirm-opened' },
      { event: 'confirm-resolved', result: 'accepted' },
      { event: 'prompt-opened' },
      { event: 'prompt-resolved', result: 'value' },
    ])
    expect(readGroceryDeleteDialogDiagnostics(currentWindow).every(
      (event) => event.elapsedMs === undefined,
    )).toBe(true)
  })

  it('records callback errors in order and rethrows the exact original exceptions', () => {
    const currentWindow = fakeWindow({ pathname: '/sfenton-react-panel' })
    const confirmError = new TypeError('confirm callback failed')
    const promptError = { marker: 'prompt callback failed' }

    try {
      runGroceryDeleteConfirm(() => {
        throw confirmError
      }, {
        currentWindow,
        now: vi.fn().mockReturnValueOnce(10).mockReturnValueOnce(12),
      })
      throw new Error('Expected confirm callback to throw')
    } catch (error) {
      expect(error).toBe(confirmError)
    }
    try {
      runGroceryDeletePrompt(4, () => {
        throw promptError
      }, {
        currentWindow,
        now: vi.fn().mockReturnValueOnce(20).mockReturnValueOnce(25),
      })
      throw new Error('Expected prompt callback to throw')
    } catch (error) {
      expect(error).toBe(promptError)
    }

    expect(readGroceryDeleteDialogDiagnostics(currentWindow).map(
      ({ elapsedMs, event, result, sequence }) => ({ elapsedMs, event, result, sequence }),
    )).toEqual([
      { elapsedMs: undefined, event: 'confirm-opened', result: undefined, sequence: 1 },
      { elapsedMs: 2, event: 'confirm-resolved', result: 'error', sequence: 2 },
      { elapsedMs: undefined, event: 'prompt-opened', result: undefined, sequence: 3 },
      { elapsedMs: 5, event: 'prompt-resolved', result: 'error', sequence: 4 },
    ])
  })

  it('reconstructs allowlisted fields, coarsens old paths, and uses the safe maximum sequence', () => {
    const currentWindow = fakeWindow({ pathname: '/frame' })
    propertyState(currentWindow)[GROCERY_DELETE_DIALOG_DIAGNOSTICS_PROPERTY] = JSON.stringify([
      {
        childPath: '/hostile/private/item-name',
        event: 'confirm-opened',
        hostPath: '/sfenton-react-dash/home',
        platform: 'android',
        privateItemTitle: 'must be removed',
        sequence: 7,
        viewportHeight: 852,
        viewportWidth: 393,
        visibilityState: 'visible',
      },
      {
        childHost: 'raw-app',
        event: 'confirm-resolved',
        hostHost: 'custom-panel',
        platform: 'ios',
        result: 'accepted',
        sequence: 3,
        unexpected: 'must be removed',
        viewportHeight: 741,
        viewportWidth: 1152,
        visibilityState: 'hidden',
      },
      {
        childHost: 'hostile',
        event: 'confirm-opened',
        hostHost: 'also-hostile',
        platform: 'android',
        sequence: 7,
        viewportHeight: 852,
        viewportWidth: 393,
        visibilityState: 'visible',
      },
      {
        childHost: 'raw-app',
        event: 'confirm-opened',
        hostHost: 'legacy-wrapper',
        platform: 'android',
        sequence: Number.MAX_SAFE_INTEGER + 1,
        viewportHeight: 852,
        viewportWidth: 393,
        visibilityState: 'visible',
      },
      { malformed: true },
    ])
    expect(readGroceryDeleteDialogDiagnostics(currentWindow)).toEqual([
      {
        childHost: 'other',
        event: 'confirm-opened',
        hostHost: 'legacy-wrapper',
        platform: 'android',
        sequence: 7,
        viewportHeight: 852,
        viewportWidth: 393,
        visibilityState: 'visible',
      },
      {
        childHost: 'raw-app',
        event: 'confirm-resolved',
        hostHost: 'custom-panel',
        platform: 'ios',
        result: 'accepted',
        sequence: 3,
        viewportHeight: 741,
        viewportWidth: 1152,
        visibilityState: 'hidden',
      },
      {
        childHost: 'other',
        event: 'confirm-opened',
        hostHost: 'other',
        platform: 'android',
        sequence: 7,
        viewportHeight: 852,
        viewportWidth: 393,
        visibilityState: 'visible',
      },
    ])
    runGroceryDeleteConfirm(() => true, {
      currentWindow,
      now: vi.fn().mockReturnValueOnce(1).mockReturnValueOnce(1),
    })
    expect(readGroceryDeleteDialogDiagnostics(currentWindow).slice(-2)).toMatchObject([
      { event: 'confirm-opened', sequence: 8 },
      { event: 'confirm-resolved', sequence: 9 },
    ])
  })

  it('retains 40 events while allocating after the maximum from truncated hostile history', () => {
    const currentWindow = fakeWindow({ pathname: '/frame' })
    const persistedHistory = Array.from({ length: 41 }, (_, index) => ({
      childHost: 'other',
      event: 'confirm-opened',
      hostHost: 'other',
      platform: 'android',
      sequence: index === 0 ? 500 : index,
      viewportHeight: 852,
      viewportWidth: 393,
      visibilityState: 'visible',
    }))
    propertyState(currentWindow)[GROCERY_DELETE_DIALOG_DIAGNOSTICS_PROPERTY] = JSON.stringify(
      persistedHistory,
    )

    runGroceryDeleteConfirm(() => false, {
      currentWindow,
      now: vi.fn().mockReturnValueOnce(1).mockReturnValueOnce(1),
    })

    const history = readGroceryDeleteDialogDiagnostics(currentWindow)
    expect(history).toHaveLength(40)
    expect(history[0]).toMatchObject({ event: 'confirm-opened', sequence: 3 })
    expect(history.at(-1)).toMatchObject({
      event: 'confirm-resolved',
      result: 'cancelled',
      sequence: 502,
    })
  })

  it('stops recording when persisted history has exhausted safe sequence values', () => {
    const currentWindow = fakeWindow({ pathname: '/frame' })
    propertyState(currentWindow)[GROCERY_DELETE_DIALOG_DIAGNOSTICS_PROPERTY] = JSON.stringify([{
      childHost: 'other',
      event: 'confirm-opened',
      hostHost: 'other',
      platform: 'android',
      sequence: Number.MAX_SAFE_INTEGER,
      viewportHeight: 852,
      viewportWidth: 393,
      visibilityState: 'visible',
    }])

    expect(runGroceryDeleteConfirm(() => true, { currentWindow })).toBe(true)
    expect(readGroceryDeleteDialogDiagnostics(currentWindow)).toHaveLength(1)
  })
})
