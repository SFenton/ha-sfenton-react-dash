import { useEffect, useRef, useState } from 'react'
import { precipitationLabelCadence, precipitationLabelIndices } from './precipitationTimeline'

function sameNumbers(left: readonly number[], right: readonly number[]) {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

function measuredWidth(element: HTMLElement) {
  return element.getBoundingClientRect().width || element.scrollWidth
}

export function useResponsiveWeatherChartLabels({
  measurementKey,
  pointCount,
}: {
  measurementKey: string
  pointCount: number
}) {
  const plotRef = useRef<HTMLSpanElement>(null)
  const measurementRef = useRef<HTMLSpanElement>(null)
  const [labelIndices, setLabelIndices] = useState<number[]>(() => precipitationLabelIndices(pointCount, Math.max(1, Math.ceil(pointCount / 4))))

  useEffect(() => {
    let frame = 0
    let active = true

    const measure = () => {
      frame = 0
      const measurementRoot = measurementRef.current
      if (!measurementRoot) return

      const plot = plotRef.current
      if (plot) {
        const measurementWidths = Array.from(measurementRoot.querySelectorAll<HTMLElement>('[data-weather-chart-label-measure]')).map(measuredWidth)
        const widestLabel = Math.max(0, ...measurementWidths)
        const cadence = precipitationLabelCadence(pointCount, measuredWidth(plot), widestLabel)
        const nextLabelIndices = precipitationLabelIndices(pointCount, cadence)
        setLabelIndices((current) => sameNumbers(current, nextLabelIndices) ? current : nextLabelIndices)
      } else {
        setLabelIndices([])
      }
    }

    const scheduleMeasure = () => {
      if (!active) return
      if (frame) window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(measure)
    }

    scheduleMeasure()
    const ResizeObserverConstructor = window.ResizeObserver
    const observer = typeof ResizeObserverConstructor === 'undefined' ? null : new ResizeObserverConstructor(scheduleMeasure)
    if (observer) {
      if (plotRef.current) observer.observe(plotRef.current)
    } else {
      window.addEventListener('resize', scheduleMeasure)
    }
    void document.fonts?.ready.then(scheduleMeasure)

    return () => {
      active = false
      if (frame) window.cancelAnimationFrame(frame)
      observer?.disconnect()
      if (!observer) window.removeEventListener('resize', scheduleMeasure)
    }
  }, [measurementKey, pointCount])

  return {
    labelIndices,
    measurementRef,
    plotRef,
  }
}
