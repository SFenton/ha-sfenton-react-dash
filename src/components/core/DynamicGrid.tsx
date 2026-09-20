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
  normalizedDynamicGridColumns,
  packDynamicGridSpans,
  responsiveDynamicGridColumnCount,
  uniformDynamicGridColumnCount,
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
  availableColumns: number
  columns: number
  expanded: boolean
  itemSizing: DynamicGridItemSizing
  spans: number[]
  starts: number[]
  wrapLabels: boolean[]
}

export type DynamicGridLastRow = 'center' | 'fill' | 'fill-minimum' | 'start'
export type DynamicGridLayoutMode = 'bounded' | 'fill'
export type DynamicGridItemSizing = 'content-aware' | 'fixed' | 'uniform'
export type DynamicGridRowFill = boolean | 'except-last'

interface DynamicGridProps {
  ariaLabel?: string
  children: ReactNode
  className?: string
  columns: number
  fillRows?: DynamicGridRowFill
  gap?: number
  itemSizing?: DynamicGridItemSizing
  justify?: 'center' | 'start'
  lastRow?: DynamicGridLastRow
  layout?: DynamicGridLayoutMode
  maxCellWidth?: number
  maxColumns?: number
  onColumnsChange?: (columns: number) => void
  role?: AriaRole
}

function layoutsMatch(current: DynamicGridLayout, next: DynamicGridLayout) {
  return current.availableColumns === next.availableColumns
    && current.columns === next.columns
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

function naturalLabelWidth(label: HTMLElement) {
  const clone = label.cloneNode(true) as HTMLElement
  const computedStyle = window.getComputedStyle(label)
  clone.removeAttribute('id')
  Object.assign(clone.style, {
    display: 'block',
    font: computedStyle.font,
    inset: '0 auto auto -10000px',
    letterSpacing: computedStyle.letterSpacing,
    maxWidth: 'none',
    pointerEvents: 'none',
    position: 'fixed',
    textTransform: computedStyle.textTransform,
    visibility: 'hidden',
    whiteSpace: 'nowrap',
    width: 'max-content',
  })
  document.body.append(clone)
  const width = clone.scrollWidth
  clone.remove()
  return width
}

function naturalLabelContainerWidth(labelContainer: HTMLElement) {
  const clone = labelContainer.cloneNode(true) as HTMLElement
  const labels = Array.from(labelContainer.querySelectorAll<HTMLElement>(LABEL_SELECTOR))
  const clonedLabels = Array.from(clone.querySelectorAll<HTMLElement>(LABEL_SELECTOR))
  clone.removeAttribute('id')
  for (const descendant of clone.querySelectorAll<HTMLElement>('[id]')) descendant.removeAttribute('id')
  Object.assign(clone.style, {
    bottom: 'auto',
    height: 'auto',
    left: '-10000px',
    maxWidth: 'none',
    minWidth: '0',
    pointerEvents: 'none',
    position: 'fixed',
    right: 'auto',
    top: '0',
    visibility: 'hidden',
    width: 'max-content',
  })
  for (const [index, label] of clonedLabels.entries()) {
    const sourceLabel = labels[index]
    if (!sourceLabel) continue
    const computedStyle = window.getComputedStyle(sourceLabel)
    Object.assign(label.style, {
      clip: 'auto',
      font: computedStyle.font,
      fontFeatureSettings: computedStyle.fontFeatureSettings,
      fontKerning: computedStyle.fontKerning,
      fontVariationSettings: computedStyle.fontVariationSettings,
      height: 'auto',
      letterSpacing: computedStyle.letterSpacing,
      maxWidth: 'none',
      overflow: 'visible',
      position: 'static',
      textTransform: computedStyle.textTransform,
      visibility: 'hidden',
      whiteSpace: 'nowrap',
      width: 'max-content',
    })
  }
  const measurementParent = labelContainer.parentElement ?? document.body
  measurementParent.append(clone)
  const width = Math.max(clone.getBoundingClientRect().width, clone.scrollWidth)
  clone.remove()

  if (width > 0) return width

  return Math.max(
    0,
    ...Array.from(labelContainer.querySelectorAll<HTMLElement>(LABEL_SELECTOR), naturalLabelWidth),
  )
}

function requiredCellWidth(cell: HTMLElement, columnWidth: number) {
  const grid = cell.parentElement
  const measurementGrid = grid?.cloneNode(false) as HTMLElement | undefined
  const clone = cell.cloneNode(true) as HTMLElement
  clone.removeAttribute('id')
  for (const descendant of clone.querySelectorAll<HTMLElement>('[id]')) descendant.removeAttribute('id')
  if (measurementGrid) {
    measurementGrid.removeAttribute('id')
    measurementGrid.removeAttribute('aria-label')
    measurementGrid.removeAttribute('role')
    Object.assign(measurementGrid.style, {
      display: 'block',
      height: '0',
      left: '-10000px',
      overflow: 'visible',
      pointerEvents: 'none',
      position: 'fixed',
      top: '0',
      visibility: 'hidden',
      width: `${columnWidth}px`,
    })
  }
  Object.assign(clone.style, {
    boxSizing: 'border-box',
    gridColumn: 'auto',
    maxWidth: 'none',
    pointerEvents: 'none',
    visibility: 'hidden',
    width: `${columnWidth}px`,
  })
  const measurementParent = grid?.parentElement ?? document.body
  if (measurementGrid) {
    measurementGrid.append(clone)
    measurementParent.append(measurementGrid)
  } else {
    measurementParent.append(clone)
  }

  let requiredWidth = 0
  const labelContainers = new Set(
    Array.from(clone.querySelectorAll<HTMLElement>(LABEL_SELECTOR))
      .map((label) => label.closest<HTMLElement>(LABEL_CONTAINER_SELECTOR))
      .filter((container): container is HTMLElement => Boolean(container && clone.contains(container))),
  )

  for (const labelContainer of labelContainers) {
    const labelContainerWidth = labelContainer.getBoundingClientRect().width || labelContainer.clientWidth
    const naturalWidth = naturalLabelContainerWidth(labelContainer)
    if (naturalWidth <= 0 || labelContainerWidth <= 0) continue

    const nonLabelWidth = Math.max(0, columnWidth - labelContainerWidth)
    requiredWidth = Math.max(requiredWidth, naturalWidth + nonLabelWidth)
  }

  const measuredTree = measurementGrid ?? clone
  measuredTree.remove()
  return requiredWidth
}

function initialLayout(itemCount: number, columns: number, fillRows: DynamicGridRowFill, itemSizing: DynamicGridItemSizing): DynamicGridLayout {
  return {
    availableColumns: columns,
    columns,
    expanded: false,
    itemSizing,
    spans: fillRows
      ? packDynamicGridSpans(Array.from({ length: itemCount }, () => 1), columns, fillRows === 'except-last' ? 'except-last' : 'all')
      : Array.from({ length: itemCount }, () => 1),
    starts: Array.from({ length: itemCount }, () => 0),
    wrapLabels: Array.from({ length: itemCount }, () => false),
  }
}

function measuredLayout(
  grid: HTMLElement,
  fallbackColumns: number,
  fillRows: DynamicGridRowFill,
  gap: number,
  itemSizing: DynamicGridItemSizing,
  lastRow: DynamicGridLastRow,
  layout: DynamicGridLayoutMode,
  maxCellWidth?: number,
  maxColumns?: number,
): DynamicGridLayout {
  const configured = configuredColumns(grid, fallbackColumns)
  const cells = Array.from(grid.children).filter((child): child is HTMLElement =>
    child instanceof HTMLElement && child.dataset.dynamicGridCell === 'true',
  )
  const containerWidth = layout === 'bounded'
    ? grid.parentElement?.clientWidth ?? grid.clientWidth
    : grid.clientWidth
  const requestedColumns = maxCellWidth
    ? responsiveDynamicGridColumnCount(
      containerWidth,
      gap,
      configured,
      maxCellWidth,
      maxColumns,
    )
    : configured
  const expanded = requestedColumns > configured
  const availableColumns = layout === 'bounded' && expanded
    ? Math.max(1, Math.min(requestedColumns, Math.max(1, cells.length)))
    : requestedColumns
  const gridWidth = layout === 'bounded' && expanded && maxCellWidth
    ? Math.min(
      containerWidth,
      availableColumns * maxCellWidth + Math.max(0, availableColumns - 1) * gap,
    )
    : containerWidth

  if (gridWidth <= 0 || cells.length === 0) return initialLayout(cells.length, availableColumns, fillRows, itemSizing)

  const columnWidth = (gridWidth - gap * (availableColumns - 1)) / availableColumns
  if (columnWidth <= 0) return initialLayout(cells.length, availableColumns, fillRows, itemSizing)

  const requiredCellWidths = itemSizing === 'fixed'
    ? cells.map(() => 0)
    : cells.map((cell) => requiredCellWidth(cell, columnWidth))

  const columns = itemSizing === 'uniform'
    ? uniformDynamicGridColumnCount(
      requiredCellWidths,
      gridWidth,
      gap,
      availableColumns,
      MEASUREMENT_TOLERANCE_PX,
    )
    : availableColumns
  const minimumSpans = itemSizing === 'content-aware'
    ? requiredCellWidths.map((requiredCellWidth) => {
        let fittingSpan = availableColumns

        for (let candidateSpan = 1; candidateSpan <= availableColumns; candidateSpan += 1) {
          const candidateCellWidth = columnWidth * candidateSpan + gap * (candidateSpan - 1)
          if (requiredCellWidth <= candidateCellWidth + MEASUREMENT_TOLERANCE_PX) {
            fittingSpan = candidateSpan
            break
          }
        }

        return fittingSpan
      })
    : cells.map(() => 1)
  const fillFinalRow = lastRow === 'fill'
    || (lastRow === 'fill-minimum' && !expanded)
  const rowFill = fillFinalRow ? 'all' : 'except-last'
  const fillMeasuredRows = fillRows !== false || fillFinalRow
  const spans = itemSizing !== 'content-aware'
    ? (
      fillMeasuredRows
        ? packDynamicGridSpans(Array.from({ length: cells.length }, () => 1), columns, rowFill)
        : Array.from({ length: cells.length }, () => 1)
    )
    : (fillMeasuredRows ? packDynamicGridSpans(minimumSpans, availableColumns, rowFill) : minimumSpans)
  const starts = lastRow === 'center'
    ? centeredDynamicGridStarts(spans, columns)
    : Array.from({ length: cells.length }, () => 0)
  const wrapLabels = requiredCellWidths.map((requiredCellWidth, index) => {
    if (itemSizing === 'fixed') return false
    if (itemSizing === 'content-aware' && minimumSpans[index] < availableColumns) return false
    if (itemSizing === 'uniform' && columns > 1) return false
    return requiredCellWidth > gridWidth + MEASUREMENT_TOLERANCE_PX
  })

  return { availableColumns, columns, expanded, itemSizing, spans, starts, wrapLabels }
}

export function DynamicGrid({
  ariaLabel,
  children,
  className,
  columns,
  fillRows = true,
  gap = 10,
  itemSizing = 'content-aware',
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
  const resolvedLastRow: DynamicGridLastRow = lastRow ?? (fillRows === true ? 'fill' : 'start')
  const gridRef = useRef<HTMLDivElement | null>(null)
  const [layout, setLayout] = useState<DynamicGridLayout>(() => initialLayout(
    items.length,
    baseColumns,
    fillRows,
    itemSizing,
  ))
  const measure = useCallback(() => {
    const grid = gridRef.current
    if (!grid) return
    const nextLayout = measuredLayout(
      grid,
      baseColumns,
      fillRows,
      gap,
      itemSizing,
      resolvedLastRow,
      layoutMode,
      maxCellWidth,
      maxColumns,
    )
    setLayout((currentLayout) => layoutsMatch(currentLayout, nextLayout) ? currentLayout : nextLayout)
  }, [baseColumns, fillRows, gap, itemSizing, layoutMode, maxCellWidth, maxColumns, resolvedLastRow])

  useLayoutEffect(() => {
    const grid = gridRef.current
    if (!grid) return undefined

    measure()
    window.addEventListener('resize', measure)

    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    resizeObserver?.observe(grid)
    if (layoutMode === 'bounded' && grid.parentElement) resizeObserver?.observe(grid.parentElement)

    let mutationObserver: MutationObserver | null = null
    if (itemSizing !== 'fixed') {
      for (const label of grid.querySelectorAll<HTMLElement>(`${LABEL_SELECTOR}, ${LABEL_CONTAINER_SELECTOR}`)) {
        resizeObserver?.observe(label)
      }

      mutationObserver = typeof MutationObserver === 'undefined'
        ? null
        : new MutationObserver(measure)
      mutationObserver?.observe(grid, { characterData: true, childList: true, subtree: true })
    }

    let active = itemSizing !== 'fixed'
    if (active) {
      void document.fonts?.ready.then(() => {
        if (active) measure()
      })
    }

    return () => {
      active = false
      resizeObserver?.disconnect()
      mutationObserver?.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [itemSizing, items.length, layoutMode, measure])

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
      ? `${activeLayout.availableColumns * maxCellWidth + Math.max(0, activeLayout.availableColumns - 1) * gap}px`
      : undefined,
    '--dynamic-grid-rendered-columns': String(activeLayout.columns),
  }

  return (
    <div
      aria-label={ariaLabel}
      className={[styles.grid, className].filter(Boolean).join(' ')}
      data-dynamic-grid-available-columns={activeLayout.availableColumns}
      data-dynamic-grid="true"
      data-dynamic-grid-columns={activeLayout.columns}
      data-dynamic-grid-fill-rows={String(fillRows)}
      data-dynamic-grid-item-sizing={activeLayout.itemSizing}
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
