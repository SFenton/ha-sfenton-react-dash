import { useLayoutEffect, useRef, type RefObject } from 'react'

type DetailPageKey = string | number | boolean | null

interface DetailPageSnapshot {
  additionalScrollTop: number
  bodyScrollTop: number
  focusElement: HTMLElement | null
  focusKey?: string
}

function modalDetailFocusTarget(element: HTMLElement | null | undefined) {
  if (!element) return null
  if (element.hasAttribute('data-modal-detail-autofocus') && element.hasAttribute('tabindex')) return element
  if (element.matches('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')) return element
  return element.querySelector<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') ?? element
}

export function useModalDetailPageScroll(pageKey: DetailPageKey, additionalScrollRef?: RefObject<HTMLElement | null>) {
  const bodyElementRef = useRef<HTMLDivElement | null>(null)
  const pageSnapshotsRef = useRef<DetailPageSnapshot[]>([])
  const pendingEnterRef = useRef(false)
  const pendingRestoreRef = useRef<DetailPageSnapshot | null>(null)

  useLayoutEffect(() => {
    const pendingRestore = pendingRestoreRef.current
    if (pendingRestore) {
      if (bodyElementRef.current) bodyElementRef.current.scrollTop = pendingRestore.bodyScrollTop
      if (additionalScrollRef?.current) additionalScrollRef.current.scrollTop = pendingRestore.additionalScrollTop
      const resolveFocusTarget = () => {
        if (!pendingRestore.focusKey) return modalDetailFocusTarget(pendingRestore.focusElement)
        const focusScope = bodyElementRef.current?.closest('[role="dialog"]') ?? bodyElementRef.current
        const detailTriggers = [...(focusScope?.querySelectorAll<HTMLElement>('[data-modal-detail-trigger]') ?? [])]
        return modalDetailFocusTarget(
          detailTriggers.find((element) => element.dataset.modalDetailTrigger === pendingRestore.focusKey)
            ?? detailTriggers.at(-1),
        )
      }
      let restoredTarget: HTMLElement | null = null
      let focusMoved = false
      const restoreFocus = (initial = false) => {
        const focusTarget = resolveFocusTarget()
        const activeElement = document.activeElement
        const focusWasLost = activeElement === document.body || !activeElement?.isConnected || activeElement === restoredTarget
        restoredTarget = focusTarget
        if (focusTarget?.isConnected && !focusMoved && (initial || focusWasLost)) focusTarget.focus({ preventScroll: true })
      }
      restoreFocus(true)
      pendingRestoreRef.current = null
      const focusScope = bodyElementRef.current?.closest('[role="dialog"]') ?? bodyElementRef.current
      const onFocusIn = (event: Event) => {
        if (event.target !== restoredTarget) focusMoved = true
      }
      focusScope?.addEventListener('focusin', onFocusIn)
      let settleFrame = 0
      let remainingFrames = 3
      const settle = () => {
        restoreFocus()
        remainingFrames -= 1
        if (remainingFrames > 0) settleFrame = window.requestAnimationFrame(settle)
      }
      settleFrame = window.requestAnimationFrame(settle)
      return () => {
        focusScope?.removeEventListener('focusin', onFocusIn)
        if (settleFrame) window.cancelAnimationFrame(settleFrame)
      }
    }

    if (!pendingEnterRef.current) return
    if (bodyElementRef.current) bodyElementRef.current.scrollTop = 0
    if (additionalScrollRef?.current) additionalScrollRef.current.scrollTop = 0
    modalDetailFocusTarget(bodyElementRef.current?.querySelector<HTMLElement>('[data-modal-detail-autofocus="true"]'))?.focus({ preventScroll: true })
    pendingEnterRef.current = false
  }, [additionalScrollRef, pageKey])

  const enterDetailPage = (returnFocusKey?: string) => {
    pageSnapshotsRef.current.push({
      additionalScrollTop: additionalScrollRef?.current?.scrollTop ?? 0,
      bodyScrollTop: bodyElementRef.current?.scrollTop ?? 0,
      focusElement: document.activeElement instanceof HTMLElement ? document.activeElement : null,
      focusKey: returnFocusKey,
    })
    pendingRestoreRef.current = null
    pendingEnterRef.current = true
  }

  const leaveDetailPage = (allPages = false) => {
    const snapshots = pageSnapshotsRef.current
    const snapshot = allPages ? snapshots[0] : snapshots.at(-1)
    pageSnapshotsRef.current = allPages ? [] : snapshots.slice(0, -1)
    pendingEnterRef.current = false
    pendingRestoreRef.current = snapshot ?? null
  }

  const resetDetailPageScroll = () => {
    pageSnapshotsRef.current = []
    pendingEnterRef.current = false
    pendingRestoreRef.current = null
  }

  return { bodyElementRef, enterDetailPage, leaveDetailPage, resetDetailPageScroll }
}
