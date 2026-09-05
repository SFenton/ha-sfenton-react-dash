import { useSyncExternalStore } from 'react'

export type ModalSheetPresentation = 'dialog' | 'landscape-dialog' | 'sheet'
export type ModalBodyTier = 'compact' | 'fields' | 'standard' | 'wide'

export const MODAL_SHEET_DIALOG_MIN_WIDTH = 760
export const MODAL_SHEET_DIALOG_MIN_HEIGHT = 560
export const MODAL_SHEET_LANDSCAPE_DIALOG_MIN_WIDTH = 560
export const MODAL_BODY_FIELDS_MIN_INLINE_SIZE = 480
export const MODAL_BODY_STANDARD_MIN_INLINE_SIZE = 620
export const MODAL_BODY_WIDE_MIN_INLINE_SIZE = 680

export function modalBodyTierForInlineSize(inlineSize: number): ModalBodyTier {
  if (inlineSize >= MODAL_BODY_WIDE_MIN_INLINE_SIZE) return 'wide'
  if (inlineSize >= MODAL_BODY_STANDARD_MIN_INLINE_SIZE) return 'standard'
  if (inlineSize >= MODAL_BODY_FIELDS_MIN_INLINE_SIZE) return 'fields'
  return 'compact'
}

export function modalSheetPresentationForViewport(
  width: number,
  height: number,
): ModalSheetPresentation {
  if (width >= MODAL_SHEET_DIALOG_MIN_WIDTH && height >= MODAL_SHEET_DIALOG_MIN_HEIGHT) {
    return 'dialog'
  }
  if (
    width >= MODAL_SHEET_LANDSCAPE_DIALOG_MIN_WIDTH
    && width > height
    && height < MODAL_SHEET_DIALOG_MIN_HEIGHT
  ) {
    return 'landscape-dialog'
  }
  return 'sheet'
}

function currentModalSheetPresentation() {
  if (typeof window === 'undefined') return 'sheet'
  return modalSheetPresentationForViewport(window.innerWidth, window.innerHeight)
}

function subscribeToModalViewport(onChange: () => void) {
  window.addEventListener('resize', onChange)
  window.addEventListener('orientationchange', onChange)
  return () => {
    window.removeEventListener('resize', onChange)
    window.removeEventListener('orientationchange', onChange)
  }
}

export function useModalSheetPresentation() {
  return useSyncExternalStore(subscribeToModalViewport, currentModalSheetPresentation, () => 'sheet' as const)
}
