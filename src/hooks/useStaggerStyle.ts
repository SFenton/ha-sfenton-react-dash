import { useCallback, useMemo, type AnimationEvent, type CSSProperties } from 'react'

export function staggerMs(index: number, step: number, offset = 0, base = 0) {
  return base + offset + index * step
}

export function buildStaggerStyle(delayMs: number | null): CSSProperties | undefined {
  if (delayMs === null) return undefined
  return {
    opacity: 0,
    willChange: 'transform, opacity',
    animation: `fadeInUp 420ms cubic-bezier(.2,.9,.2,1) ${delayMs}ms forwards`,
  }
}

export function useStaggerStyle(delayMs: number | null) {
  const style = useMemo(() => buildStaggerStyle(delayMs), [delayMs])
  const onAnimationEnd = useCallback((event: AnimationEvent<HTMLElement>) => {
    event.currentTarget.style.opacity = ''
    event.currentTarget.style.animation = ''
    event.currentTarget.style.willChange = ''
  }, [])

  return { style, onAnimationEnd }
}