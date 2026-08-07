import { createContext, useContext, type RefObject } from 'react'

export type PageScrollerRef = RefObject<HTMLDivElement | null>

export const PageScrollerContext = createContext<PageScrollerRef | null>(null)
export const PageScrollToTopContext = createContext<(() => void) | null>(null)

export function usePageScroller() {
  return useContext(PageScrollerContext)
}

export function usePageScrollToTop() {
  return useContext(PageScrollToTopContext)
}
