import { useRef, type Dispatch, type RefObject, type SetStateAction } from 'react'
import { useModalDetailPageScroll } from './useModalDetailPageScroll'

interface ScheduleDetailPageOptions<T> {
  getPageKey?: (detail: T) => string | number
}

export function useScheduleDetailPage<T>(
  detail: T | null,
  setDetail: Dispatch<SetStateAction<T | null>>,
  additionalScrollRef?: RefObject<HTMLElement | null>,
  options: ScheduleDetailPageOptions<T> = {},
) {
  const detailOpen = detail !== null
  const historyRef = useRef<(T | null)[]>([])
  const pageKey = detail === null ? null : options.getPageKey?.(detail) ?? true
  const { bodyElementRef, enterDetailPage, leaveDetailPage, resetDetailPageScroll } = useModalDetailPageScroll(pageKey, additionalScrollRef)

  const openDetailPage = (nextDetail: T, returnFocusKey: string) => {
    enterDetailPage(returnFocusKey)
    historyRef.current.push(detail)
    setDetail(nextDetail)
  }

  const closeDetailPage = () => {
    const previousDetail = historyRef.current.length > 0 ? historyRef.current.pop() ?? null : null
    leaveDetailPage()
    setDetail(previousDetail)
  }

  const closeAllDetailPages = () => {
    historyRef.current = []
    leaveDetailPage(true)
    setDetail(null)
  }

  const resetDetailPage = () => {
    historyRef.current = []
    resetDetailPageScroll()
    setDetail(null)
  }

  return {
    bodyElementRef,
    closeAllDetailPages,
    closeDetailPage,
    detailOpen,
    openDetailPage,
    resetDetailPage,
  }
}
