import {
  Children,
  isValidElement,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { normalizedDynamicGridColumns, packDynamicGridSpans } from './dynamicGridLayout'
import styles from './DynamicGrid.module.css'

const LABEL_SELECTOR = '[data-dynamic-grid-label="true"]'
const LABEL_CONTAINER_SELECTOR = '[data-dynamic-grid-label-container="true"]'
const MEASUREMENT_TOLERANCE_PX = 0.5

type DynamicGridStyle = CSSProperties & {
  '--dynamic-grid-base-columns': string
  '--dynamic-grid-gap': string
}

type DynamicGridCellStyle = CSSProperties & {
  '--dynamic-grid-span': string
}

interface DynamicGridLayout {
  columns: number
  spans: number[]
  wrapLabels: boolean[]
}

interface DynamicGridProps {
  ariaLabel?: string
  children: ReactNode
  className?: string
  columns: number
  gap?: number
}

function layoutsMatch(current: DynamicGridLayout, next: DynamicGridLayout) {
  return current.columns === next.columns
    && current.spans.length === next.spans.length
    && current.spans.every((span, index) => span === next.spans[index])
    && current.wrapLabels.length === next.wrapLabels.length
    && current.wrapLabels.every((wrap, index) => wrap === next.wrapLabels[index])
}

function configuredColumns(element: HTMLElement, fallbackColumns: number) {
  const computedStyle = window.getComputedStyle(element)
  const responsiveColumns = Number.parseFloat(computedStyle.getPropertyValue('--dynamic-grid-columns'))
  if (Number.isFinite(responsiveColumns) && responsiveColumns > 0) return normalizedDynamicGridColumns(responsiveColumns)

  const baseColumns = Number.parseFloat(computedStyle.getPropertyValue('--dynamic-grid-base-columns'))
  if (Number.isFinite(baseColumns) && baseColumns > 0) return normalizedDynamicGridColumns(baseColumns)

  return normalizedDynamicGridColumns(fallbackColumns)
}

function initialLayout(itemCount: number, columns: number): DynamicGridLayout {
  return {
    columns,
    spans: packDynamicGridSpans(Array.from({ length: itemCount }, () => 1), columns),
    wrapLabels: Array.from({ length: itemCount }, () => false),
  }
}

function measuredLayout(grid: HTMLElement, fallbackColumns: number, gap: number): DynamicGridLayout {
  const columns = configuredColumns(grid, fallbackColumns)
  const cells = Array.from(grid.children).filter((child): child is HTMLElement =>
    child instanceof HTMLElement && child.dataset.dynamicGridCell === 'true',
  )
  const gridWidth = grid.clientWidth

  if (gridWidth <= 0 || cells.length === 0) return initialLayout(cells.length, columns)

  const columnWidth = (gridWidth - gap * (columns - 1)) / columns
  if (columnWidth <= 0) return initialLayout(cells.length, columns)

  const minimumSpans = cells.map((cell) => {
    const cellWidth = cell.clientWidth
    let minimumSpan = 1

    for (const label of cell.querySelectorAll<HTMLElement>(LABEL_SELECTOR)) {
      const labelContainer = label.closest<HTMLElement>(LABEL_CONTAINER_SELECTOR)
      if (!labelContainer || !cell.contains(labelContainer)) continue

      const naturalLabelWidth = label.scrollWidth
      const availableLabelWidth = labelContainer.clientWidth
      if (cellWidth <= 0 || naturalLabelWidth <= 0 || availableLabelWidth <= 0) continue

      const nonLabelWidth = Math.max(0, cellWidth - availableLabelWidth)
      let fittingSpan = columns

      for (let candidateSpan = 1; candidateSpan <= columns; candidateSpan += 1) {
        const candidateCellWidth = columnWidth * candidateSpan + gap * (candidateSpan - 1)
        const candidateLabelWidth = Math.max(0, candidateCellWidth - nonLabelWidth)
        if (naturalLabelWidth <= candidateLabelWidth + MEASUREMENT_TOLERANCE_PX) {
          fittingSpan = candidateSpan
          break
        }
      }

      minimumSpan = Math.max(minimumSpan, fittingSpan)
    }

    return minimumSpan
  })

  const spans = packDynamicGridSpans(minimumSpans, columns)
  const wrapLabels = cells.map((cell, index) => {
    if (minimumSpans[index] < columns) return false

    const cellWidth = cell.clientWidth
    return Array.from(cell.querySelectorAll<HTMLElement>(LABEL_SELECTOR)).some((label) => {
      const labelContainer = label.closest<HTMLElement>(LABEL_CONTAINER_SELECTOR)
      if (!labelContainer || !cell.contains(labelContainer)) return false

      const nonLabelWidth = Math.max(0, cellWidth - labelContainer.clientWidth)
      const fullWidthLabelSpace = gridWidth - nonLabelWidth
      return label.scrollWidth > fullWidthLabelSpace + MEASUREMENT_TOLERANCE_PX
    })
  })

  return { columns, spans, wrapLabels }
}

export function DynamicGrid({
  ariaLabel,
  children,
  className,
  columns,
  gap = 10,
}: DynamicGridProps) {
  const items = Children.toArray(children)
  const baseColumns = normalizedDynamicGridColumns(columns)
  const gridRef = useRef<HTMLDivElement | null>(null)
  const [layout, setLayout] = useState<DynamicGridLayout>(() => initialLayout(items.length, baseColumns))
  const measure = useCallback(() => {
    const grid = gridRef.current
    if (!grid) return
    const nextLayout = measuredLayout(grid, baseColumns, gap)
    setLayout((currentLayout) => layoutsMatch(currentLayout, nextLayout) ? currentLayout : nextLayout)
  }, [baseColumns, gap])

  useLayoutEffect(() => {
    const grid = gridRef.current
    if (!grid) return undefined

    measure()
    window.addEventListener('resize', measure)

    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    resizeObserver?.observe(grid)
    for (const label of grid.querySelectorAll<HTMLElement>(`${LABEL_SELECTOR}, ${LABEL_CONTAINER_SELECTOR}`)) {
      resizeObserver?.observe(label)
    }

    const mutationObserver = typeof MutationObserver === 'undefined'
      ? null
      : new MutationObserver(measure)
    mutationObserver?.observe(grid, { characterData: true, childList: true, subtree: true })

    let active = true
    void document.fonts?.ready.then(() => {
      if (active) measure()
    })

    return () => {
      active = false
      resizeObserver?.disconnect()
      mutationObserver?.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [items.length, measure])

  const activeLayout = layout.spans.length === items.length
    ? layout
    : initialLayout(items.length, layout.columns)
  const gridStyle: DynamicGridStyle = {
    '--dynamic-grid-base-columns': String(baseColumns),
    '--dynamic-grid-gap': `${gap}px`,
  }

  return (
    <div
      aria-label={ariaLabel}
      className={[styles.grid, className].filter(Boolean).join(' ')}
      data-dynamic-grid="true"
      data-dynamic-grid-columns={activeLayout.columns}
      ref={gridRef}
      role={ariaLabel ? 'group' : undefined}
      style={gridStyle}
    >
      {items.map((child, index) => {
        const span = activeLayout.spans[index] ?? 1
        const cellStyle: DynamicGridCellStyle = { '--dynamic-grid-span': String(span) }
        const key = isValidElement(child) ? child.key ?? index : index

        return (
          <div
            className={styles.cell}
            data-dynamic-grid-cell="true"
            data-dynamic-grid-span={span}
            data-dynamic-grid-wrap={activeLayout.wrapLabels[index] ? 'true' : undefined}
            key={key}
            style={cellStyle}
          >
            {child}
          </div>
        )
      })}
    </div>
  )
}
