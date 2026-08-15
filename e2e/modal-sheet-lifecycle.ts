import { type Page } from '@playwright/test'

export interface ModalLifecycleAnimation {
  currentTime: number | null
  pending: boolean
  playState: AnimationPlayState
}

export interface ModalLifecycleFrame {
  animations: ModalLifecycleAnimation[]
  bodyClientHeight: number | null
  bodyScrollHeight: number | null
  bodyScrollTop: number | null
  closing: string | null
  closed: boolean
  connected: boolean
  ending: boolean
  hash: string
  hidden: boolean
  inert: boolean
  movementY: string
  nodeId: number | null
  opacity: number | null
  open: boolean
  overlayClosed: boolean
  overlayEnding: boolean
  overlayOpacity: number | null
  popupPresent: boolean
  rapidReopen: string | null
  swipeDismiss: boolean
  starting: boolean
  state: string | null
  strength: string
  swiping: boolean
  time: number
  transition: string | null
  translateY: number | null
}

export interface ModalLifecycleEvent {
  cancelable: boolean
  clientX: number | null
  clientY: number | null
  defaultPrevented: boolean
  isTrusted: boolean
  phase: 'after' | 'capture'
  pointerType: string | null
  target: string
  time: number
  type: string
}

export interface ModalLifecycleMutation {
  attribute: string | null
  nodeId: number | null
  target: string
  time: number
  type: MutationRecordType
  value: string | null
}

export interface ModalLifecycleTrace {
  events: ModalLifecycleEvent[]
  frames: ModalLifecycleFrame[]
  historyPushCount: number
  historyReplaceCount: number
  mutations: ModalLifecycleMutation[]
}

interface ModalLifecycleProbe {
  snapshot: () => ModalLifecycleTrace
  start: () => void
  stop: () => void
}

type ProbeWindow = Window & {
  __modalLifecycleProbe?: ModalLifecycleProbe
}

export async function installModalLifecycleProbe(page: Page) {
  await page.addInitScript(() => {
    const nodeIds = new WeakMap<Node, number>()
    let nextNodeId = 1
    let active = false
    let animationFrame = 0
    let startTime = 0
    let frames: ModalLifecycleFrame[] = []
    let events: ModalLifecycleEvent[] = []
    let mutations: ModalLifecycleMutation[] = []
    let historyPushCount = 0
    let historyReplaceCount = 0

    const nodeId = (node: Node | null) => {
      if (!node) return null
      const existing = nodeIds.get(node)
      if (existing) return existing
      const created = nextNodeId
      nextNodeId += 1
      nodeIds.set(node, created)
      return created
    }

    const elapsed = (timestamp = performance.now()) => timestamp - startTime

    const describe = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return target?.constructor.name ?? 'unknown'
      const id = target.id ? `#${target.id}` : ''
      const testId = target.getAttribute('data-testid')
      const marker = testId ? `[data-testid="${testId}"]` : ''
      return `${target.tagName.toLowerCase()}${id}${marker}`
    }

    const eventPoint = (event: Event) => {
      if ('touches' in event && 'changedTouches' in event) {
        const touchEvent = event as TouchEvent
        const touch = touchEvent.touches[0] ?? touchEvent.changedTouches[0]
        return touch ? { clientX: touch.clientX, clientY: touch.clientY } : { clientX: null, clientY: null }
      }
      if (event instanceof PointerEvent) return { clientX: event.clientX, clientY: event.clientY }
      return { clientX: null, clientY: null }
    }

    const recordEvent = (event: Event, phase: ModalLifecycleEvent['phase']) => {
      if (!active) return
      const point = eventPoint(event)
      events.push({
        cancelable: event.cancelable,
        clientX: point.clientX,
        clientY: point.clientY,
        defaultPrevented: event.defaultPrevented,
        isTrusted: event.isTrusted,
        phase,
        pointerType: event instanceof PointerEvent ? event.pointerType : event.type.startsWith('touch') ? 'touch' : null,
        target: describe(event.target),
        time: elapsed(event.timeStamp > 0 ? event.timeStamp : performance.now()),
        type: event.type,
      })
    }

    for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'touchstart', 'touchmove', 'touchend', 'touchcancel']) {
      document.addEventListener(type, (event) => {
        recordEvent(event, 'capture')
        queueMicrotask(() => recordEvent(event, 'after'))
      }, { capture: true, passive: true })
    }

    const originalPushState = history.pushState.bind(history)
    const originalReplaceState = history.replaceState.bind(history)
    history.pushState = (...args) => {
      if (active) historyPushCount += 1
      return originalPushState(...args)
    }
    history.replaceState = (...args) => {
      if (active) historyReplaceCount += 1
      return originalReplaceState(...args)
    }

    const relevantNode = (target: Node) => {
      if (!(target instanceof Element)) return null
      return target.closest('[data-surface="hass-popup"], [data-modal-sheet-overlay], [data-base-ui-portal]') ?? (
        target.matches('[data-surface="hass-popup"], [data-modal-sheet-overlay], [data-base-ui-portal]') ? target : null
      )
    }

    const observer = new MutationObserver((records) => {
      if (!active) return
      for (const record of records) {
        const target = relevantNode(record.target)
        if (!target && record.type !== 'childList') continue
        mutations.push({
          attribute: record.attributeName,
          nodeId: nodeId(target),
          target: describe(target ?? record.target),
          time: elapsed(),
          type: record.type,
          value: record.attributeName && target ? target.getAttribute(record.attributeName) : null,
        })
      }
    })
    observer.observe(document, {
      attributeFilter: [
        'data-open',
        'data-closed',
        'data-starting-style',
        'data-ending-style',
        'data-swiping',
        'data-swipe-dismiss',
        'data-rapid-reopen',
        'data-state',
        'data-closing',
        'hidden',
        'inert',
        'style',
      ],
      attributes: true,
      childList: true,
      subtree: true,
    })

    const sample = (timestamp: number) => {
      if (!active) return
      const popup = document.querySelector<HTMLElement>('[data-surface="hass-popup"]')
      const overlay = document.querySelector<HTMLElement>('[data-modal-sheet-overlay]')
      const body = popup?.querySelector<HTMLElement>('[data-modal-sheet-body="true"]') ?? null
      const popupStyle = popup ? getComputedStyle(popup) : null
      const overlayStyle = overlay ? getComputedStyle(overlay) : null
      const transform = popupStyle?.transform ?? 'none'
      frames.push({
        animations: popup?.getAnimations().map((animation) => ({
          currentTime: typeof animation.currentTime === 'number' ? animation.currentTime : null,
          pending: animation.pending,
          playState: animation.playState,
        })) ?? [],
        bodyClientHeight: body?.clientHeight ?? null,
        bodyScrollHeight: body?.scrollHeight ?? null,
        bodyScrollTop: body?.scrollTop ?? null,
        closing: popup?.getAttribute('data-closing') ?? null,
        closed: popup?.hasAttribute('data-closed') ?? false,
        connected: popup?.isConnected ?? false,
        ending: popup?.hasAttribute('data-ending-style') ?? false,
        hash: location.hash,
        hidden: popup?.hasAttribute('hidden') ?? false,
        inert: popup?.hasAttribute('inert') ?? false,
        movementY: popup?.style.getPropertyValue('--drawer-swipe-movement-y') ?? '',
        nodeId: nodeId(popup),
        opacity: popupStyle ? Number.parseFloat(popupStyle.opacity) : null,
        open: popup?.hasAttribute('data-open') ?? false,
        overlayClosed: overlay?.hasAttribute('data-closed') ?? false,
        overlayEnding: overlay?.hasAttribute('data-ending-style') ?? false,
        overlayOpacity: overlayStyle ? Number.parseFloat(overlayStyle.opacity) : null,
        popupPresent: Boolean(popup),
        rapidReopen: popup?.getAttribute('data-rapid-reopen') ?? null,
        swipeDismiss: popup?.hasAttribute('data-swipe-dismiss') ?? false,
        starting: popup?.hasAttribute('data-starting-style') ?? false,
        state: popup?.getAttribute('data-state') ?? null,
        strength: popup?.style.getPropertyValue('--drawer-swipe-strength') ?? '',
        swiping: popup?.hasAttribute('data-swiping') ?? false,
        time: elapsed(timestamp),
        transition: popupStyle?.transition ?? null,
        translateY: popupStyle && transform !== 'none' ? new DOMMatrixReadOnly(transform).m42 : popup ? 0 : null,
      })
      animationFrame = requestAnimationFrame(sample)
    }

    const probe: ModalLifecycleProbe = {
      snapshot: () => JSON.parse(JSON.stringify({
        events,
        frames,
        historyPushCount,
        historyReplaceCount,
        mutations,
      })) as ModalLifecycleTrace,
      start: () => {
        cancelAnimationFrame(animationFrame)
        active = true
        startTime = performance.now()
        frames = []
        events = []
        mutations = []
        historyPushCount = 0
        historyReplaceCount = 0
        animationFrame = requestAnimationFrame(sample)
      },
      stop: () => {
        active = false
        cancelAnimationFrame(animationFrame)
      },
    }

    ;(window as ProbeWindow).__modalLifecycleProbe = probe
  })
}

export async function startModalLifecycleProbe(page: Page) {
  await page.evaluate(() => {
    const probe = (window as ProbeWindow).__modalLifecycleProbe
    if (!probe) throw new Error('Modal lifecycle probe is not installed')
    probe.start()
  })
}

export async function readModalLifecycleProbe(page: Page) {
  return page.evaluate(() => {
    const probe = (window as ProbeWindow).__modalLifecycleProbe
    if (!probe) throw new Error('Modal lifecycle probe is not installed')
    probe.stop()
    return probe.snapshot()
  })
}

export function assertTerminalModalLifecycle(trace: ModalLifecycleTrace) {
  const connectedClosed = trace.frames.filter((frame) => frame.popupPresent && frame.closed)
  if (connectedClosed.length === 0) throw new Error('Modal lifecycle trace never reached a connected closed state')

  const nodeIds = new Set(connectedClosed.map((frame) => frame.nodeId))
  if (nodeIds.size !== 1) throw new Error(`Modal node identity changed during close: ${[...nodeIds].join(', ')}`)

  for (const frame of connectedClosed) {
    if (
      frame.closing !== 'true'
      || frame.hash !== ''
      || !frame.inert
      || frame.open
      || !frame.overlayClosed
      || frame.rapidReopen !== 'false'
      || frame.starting
      || frame.state !== 'closed'
    ) {
      throw new Error(`Modal reopened during close at ${frame.time.toFixed(1)}ms`)
    }
  }

  for (let index = 1; index < connectedClosed.length; index += 1) {
    const previous = connectedClosed[index - 1]
    const current = connectedClosed[index]
    if ((current.translateY ?? 0) < (previous.translateY ?? 0) - 1) {
      throw new Error(`Modal transform reversed at ${current.time.toFixed(1)}ms: ${previous.translateY} -> ${current.translateY}`)
    }
    if ((current.overlayOpacity ?? 0) > (previous.overlayOpacity ?? 0) + 0.01) {
      throw new Error(`Modal overlay opacity increased at ${current.time.toFixed(1)}ms: ${previous.overlayOpacity} -> ${current.overlayOpacity}`)
    }
  }
}
