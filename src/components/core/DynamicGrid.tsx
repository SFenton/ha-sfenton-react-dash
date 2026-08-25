import {
  Children,
  isValidElement,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type AriaRole,
  type CSSProperties,
  type ReactNode,
} from 'react'
import {
  centeredDynamicGridStarts,
  equivalentDynamicGridColumnCount,
  normalizedDynamicGridColumns,
  packDynamicGridSpans,
  responsiveDynamicGridColumnCount,
} from './dynamicGridLayout'
import styles from './DynamicGrid.module.css'

const LABEL_SELECTOR = '[data-dynamic-grid-label="true"]'
const LABEL_CONTAINER_SELECTOR = '[data-dynamic-grid-label-container="true"]'
const MEASUREMENT_TOLERANCE_PX = 0.5

type DynamicGridStyle = CSSProperties & {
  '--dynamic-grid-base-columns': string
  '--dynamic-grid-gap': string
  '--dynamic-grid-max-width'?: string
  '--dynamic-grid-rendered-columns'?: string
}

type DynamicGridCellStyle = CSSProperties & {
  '--dynamic-grid-span': string
}

interface DynamicGridLayout {
  columns: number
  expanded: boolean
  itemSizing: DynamicGridItemSizing
  spans: number[]
  starts: number[]
  wrapLabels: boolean[]
}

export type DynamicGridLastRow = 'center' | 'fill' | 'fill-minimum' | 'start'
export type DynamicGridLayoutMode = 'bounded' | 'fill'
export type DynamicGridItemSizing = 'content-aware' | 'uniform'

interface DynamicGridProps {
  ariaLabel?: string
  children: ReactNode
  className?: string
  columns: number
  fillRows?: boolean
  forceEquivalentColumnCount?: boolean
  gap?: number
  itemSizing?: DynamicGridItemSizing
  itemSizingMinWidth?: number
  justify?: 'center' | 'start'
  lastRow?: DynamicGridLastRow
  layout?: DynamicGridLayoutMode
  maxCellWidth?: number
  maxColumns?: number
  onColumnsChange?: (columns: number) => void
  role?: AriaRole
}

function layoutsMatch(current: DynamicGridLayout, next: DynamicGridLayout) {
  return current.columns === next.columns
    && current.expanded === next.expanded
    && current.itemSizing === next.itemSizing
    && current.spans.length === next.spans.length
    && current.spans.every((span, index) => span === next.spans[index])
    && current.starts.length === next.starts.length
    && current.starts.every((start, index) => start === next.starts[index])
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

function initialLayout(itemCount: number, columns: number, fillRows: boolean, itemSizing: DynamicGridItemSizing): DynamicGridLayout {
  return {
    columns,
    expanded: false,
    itemSizing,
    spans: fillRows
      ? packDynamicGridSpans(Array.from({ length: itemCount }, () => 1), columns)
      : Array.from({ length: itemCount }, () => 1),
    starts: Array.from({ length: itemCount }, () => 0),
    wrapLabels: Array.from({ length: itemCount }, () => false),
  }
}

function measuredLayout(
  grid: HTMLElement,
  fallbackColumns: number,
  forceEquivalentColumnCount: boolean,
  fillRows: boolean,
  gap: number,
  itemSizing: DynamicGridItemSizing,
  itemSizingMinWidth: number | undefined,
  lastRow: DynamicGridLastRow,
  layout: DynamicGridLayoutMode,
  maxCellWidth?: number,
  maxColumns?: number,
): DynamicGridLayout {
  const configured = configuredColumns(grid, fallbackColumns)
  const cells = Array.from(grid.children).filter((child): child is HTMLElement =>
    child instanceof HTMLElement && child.dataset.dynamicGridCell === 'true',
  )
  const gridWidth = layout === 'bounded'
    ? grid.parentElement?.clientWidth ?? grid.clientWidth
    : grid.clientWidth
  const effectiveItemSizing = itemSizingMinWidth !== undefined && gridWidth < itemSizingMinWidth
    ? 'content-aware'
    : itemSizing
  const requestedColumns = maxCellWidth
    ? responsiveDynamicGridColumnCount(
      gridWidth,
      gap,
      configured,
      maxCellWidth,
      maxColumns,
    )
    : configured
  const expanded = requestedColumns > configured
  const columns = layout === 'bounded' && expanded
    ? Math.max(1, Math.min(requestedColumns, Math.max(1, cells.length)))
    : requestedColumns

  if (gridWidth <= 0 || cells.length === 0) return initialLayout(cells.length, columns, fillRows, effectiveItemSizing)

  const columnWidth = (gridWidth - gap * (columns - 1)) / columns
  if (columnWidth <= 0) return initialLayout(cells.length, columns, fillRows, effectiveItemSizing)

  const minimumSpans = cells.map((cell) => {
    if (effectiveItemSizing === 'uniform') return 1

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

  const renderedColumns = forceEquivalentColumnCount
    ? equivalentDynamicGridColumnCount(minimumSpans, columns)
    : columns
  const fillMeasuredRows = lastRow === 'fill'
    || (lastRow === 'fill-minimum' && !expanded)
  const spans = forceEquivalentColumnCount
    ? (
      fillMeasuredRows
        ? packDynamicGridSpans(Array.from({ length: cells.length }, () => 1), renderedColumns)
        : Array.from({ length: cells.length }, () => 1)
    )
    : (fillMeasuredRows ? packDynamicGridSpans(minimumSpans, columns) : minimumSpans)
  const starts = lastRow === 'center'
    ? centeredDynamicGridStarts(spans, renderedColumns)
    : Array.from({ length: cells.length }, () => 0)
  const wrapLabels = effectiveItemSizing === 'uniform'
    ? cells.map(() => false)
    : cells.map((cell, index) => {
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

  return { columns: renderedColumns, expanded, itemSizing: effectiveItemSizing, spans, starts, wrapLabels }
}

export function DynamicGrid({
  ariaLabel,
  children,
  className,
  columns,
  fillRows = true,
  forceEquivalentColumnCount = false,
  gap = 10,
  itemSizing = 'content-aware',
  itemSizingMinWidth,
  justify = 'start',
  lastRow,
  layout: layoutMode = 'fill',
  maxCellWidth,
  maxColumns,
  onColumnsChange,
  role,
}: DynamicGridProps) {
  const items = Children.toArray(children)
  const baseColumns = normalizedDynamicGridColumns(columns)
  const resolvedLastRow: DynamicGridLastRow = lastRow ?? (fillRows ? 'fill' : 'start')
  const gridRef = useRef<HTMLDivElement | null>(null)
  const [layout, setLayout] = useState<DynamicGridLayout>(() => initialLayout(
    items.length,
    baseColumns,
    fillRows,
    itemSizingMinWidth === undefined ? itemSizing : 'content-aware',
  ))
  const measure = useCallback(() => {
    const grid = gridRef.current
    if (!grid) return
    const nextLayout = measuredLayout(
      grid,
      baseColumns,
      forceEquivalentColumnCount,
      fillRows,
      gap,
      itemSizing,
      itemSizingMinWidth,
      resolvedLastRow,
      layoutMode,
      maxCellWidth,
      maxColumns,
    )
    setLayout((currentLayout) => layoutsMatch(currentLayout, nextLayout) ? currentLayout : nextLayout)
  }, [baseColumns, fillRows, forceEquivalentColumnCount, gap, itemSizing, itemSizingMinWidth, layoutMode, maxCellWidth, maxColumns, resolvedLastRow])

  useLayoutEffect(() => {
    const grid = gridRef.current
    if (!grid) return undefined

    measure()
    window.addEventListener('resize', measure)

    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    resizeObserver?.observe(grid)
    if (layoutMode === 'bounded' && grid.parentElement) resizeObserver?.observe(grid.parentElement)
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
  }, [items.length, layoutMode, measure])

  const activeLayout = layout.spans.length === items.length
    ? layout
    : initialLayout(items.length, layout.columns, fillRows, layout.itemSizing)
  useLayoutEffect(() => {
    onColumnsChange?.(activeLayout.columns)
  }, [activeLayout.columns, onColumnsChange])
  const gridStyle: DynamicGridStyle = {
    '--dynamic-grid-base-columns': String(baseColumns),
    '--dynamic-grid-gap': `${gap}px`,
    '--dynamic-grid-max-width': layoutMode === 'bounded' && activeLayout.expanded && maxCellWidth
      ? `${activeLayout.columns * maxCellWidth + Math.max(0, activeLayout.columns - 1) * gap}px`
      : undefined,
    '--dynamic-grid-rendered-columns': forceEquivalentColumnCount || maxCellWidth
      ? String(activeLayout.columns)
      : undefined,
  }

  return (
    <div
      aria-label={ariaLabel}
      className={[styles.grid, className].filter(Boolean).join(' ')}
      data-dynamic-grid="true"
      data-dynamic-grid-columns={activeLayout.columns}
      data-dynamic-grid-force-equivalent-column-count={forceEquivalentColumnCount ? 'true' : undefined}
      data-dynamic-grid-item-sizing={activeLayout.itemSizing}
      data-dynamic-grid-item-sizing-min-width={itemSizingMinWidth}
      data-dynamic-grid-justify={justify}
      data-dynamic-grid-last-row={resolvedLastRow}
      data-dynamic-grid-layout={layoutMode}
      data-dynamic-grid-max-cell-width={maxCellWidth}
      data-dynamic-grid-max-columns={maxColumns}
      ref={gridRef}
      role={role ?? (ariaLabel ? 'group' : undefined)}
      style={gridStyle}
    >
      {items.map((child, index) => {
        const span = activeLayout.spans[index] ?? 1
        const start = activeLayout.starts[index] ?? 0
        const cellStyle: DynamicGridCellStyle = {
          '--dynamic-grid-span': String(span),
          gridColumnStart: start > 0 ? start : undefined,
        }
        const key = isValidElement(child) ? child.key ?? index : index

        return (
          <div
            className={styles.cell}
            data-dynamic-grid-cell="true"
            data-dynamic-grid-span={span}
            data-dynamic-grid-start={start > 0 ? start : undefined}
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
