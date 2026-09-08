import { useEffect, useRef, useState } from 'react'
import type { WeatherHourlyMode } from '../../constants/surfaceSemantics'

export function useWeatherModeTransition(selectedMode: WeatherHourlyMode) {
  const [displayMode, setDisplayMode] = useState(selectedMode)
  const [transitionPhase, setTransitionPhase] = useState<'idle' | 'out' | 'in'>('idle')
  const previousSelectedModeRef = useRef(selectedMode)

  useEffect(() => {
    if (selectedMode === previousSelectedModeRef.current) return undefined
    previousSelectedModeRef.current = selectedMode
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      const frame = window.requestAnimationFrame(() => {
        setDisplayMode(selectedMode)
        setTransitionPhase('idle')
      })
      return () => window.cancelAnimationFrame(frame)
    }

    const started = performance.now()
    let animationFrame = 0
    let settleTimer = 0
    const exitTimer = window.setTimeout(() => setTransitionPhase('out'), 0)
    const swapTimer = window.setTimeout(() => {
      setDisplayMode(selectedMode)
      animationFrame = window.requestAnimationFrame(() => {
        setTransitionPhase('in')
        // A delayed frame must not set "in" after an earlier timer already settled.
        settleTimer = window.setTimeout(() => setTransitionPhase('idle'), Math.max(0, 320 - (performance.now() - started)))
      })
    }, 140)
    return () => {
      window.clearTimeout(exitTimer)
      window.clearTimeout(swapTimer)
      window.clearTimeout(settleTimer)
      if (animationFrame) window.cancelAnimationFrame(animationFrame)
    }
  }, [selectedMode])

  return { displayMode, transitionPhase }
}
