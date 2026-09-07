import { useCallback, useLayoutEffect, useState, type CSSProperties } from 'react'
import type { ModalCenteredGeometry } from './ModalSheet'
import { modalSheetPresentationForViewport, type ModalSheetPresentation } from './modalSheetPresentation'

const MODAL_SQUARE_GRID_GAP = 10
const MODAL_SQUARE_GRID_EDGE_GUTTER = 6
const MODAL_SQUARE_GRID_LANDSCAPE_MIN_CARD_SIZE = 132
export const MODAL_SQUARE_GRID_DIALOG_CARD_SIZE = 168
export const MODAL_SQUARE_GRID_MAX_COLUMNS = 4
const MODAL_SQUARE_GRID_DIALOG_HORIZONTAL_CHROME = 52
const MODAL_SQUARE_GRID_HORIZONTAL_PADDING = MODAL_SQUARE_GRID_DIALOG_HORIZONTAL_CHROME + MODAL_SQUARE_GRID_EDGE_GUTTER * 2
const MODAL_SQUARE_GRID_DESKTOP_VERTICAL_CHROME = 147

interface ModalSquareGridLayout {
  cardSize: number
  columns: number
  modalWidth: number
  rows: number
}

export type ModalSquareGridStyle = CSSProperties & {
  '--modal-square-card-size': string
  '--modal-square-cols': number
  '--modal-square-rows': number
  '--modal-square-track-width': string
}

function balancedModalSquareGridTracks(count: number) {
  const columns = Math.max(1, Math.min(MODAL_SQUARE_GRID_MAX_COLUMNS, Math.ceil(Math.sqrt(count))))
  return { columns, rows: Math.ceil(count / columns) }
}

function modalSquareGridColumnsThatFit(maxGridWidth: number, cardSize: number) {
  const availableCardWidth = Math.max(cardSize, maxGridWidth - MODAL_SQUARE_GRID_EDGE_GUTTER * 2)
  return Math.max(1, Math.floor((availableCardWidth + MODAL_SQUARE_GRID_GAP) / (cardSize + MODAL_SQUARE_GRID_GAP)))
}

function modalWidthForSquareGrid(columns: number, cardSize: number) {
  return columns * cardSize + MODAL_SQUARE_GRID_GAP * (columns - 1) + MODAL_SQUARE_GRID_HORIZONTAL_PADDING
}

function fallbackModalSquareGridLayout(count: number, cardSize: number): ModalSquareGridLayout {
  const { columns, rows } = balancedModalSquareGridTracks(count)
  return {
    cardSize,
    columns,
    modalWidth: modalWidthForSquareGrid(columns, cardSize),
    rows,
  }
}

export function modalSquareGridLayout(
  count: number,
  maxGridWidth: number,
  presentation: ModalSheetPresentation,
  edgeGutter = MODAL_SQUARE_GRID_EDGE_GUTTER,
): ModalSquareGridLayout {
  const cardSize = presentation === 'landscape-dialog'
    ? MODAL_SQUARE_GRID_LANDSCAPE_MIN_CARD_SIZE
    : MODAL_SQUARE_GRID_DIALOG_CARD_SIZE
  if (count <= 0 || maxGridWidth <= 0) return fallbackModalSquareGridLayout(Math.max(1, count), cardSize)

  if (presentation === 'landscape-dialog') {
    const availableWidth = Math.max(1, maxGridWidth - edgeGutter * 2)
    const columns = Math.max(1, Math.floor((availableWidth + MODAL_SQUARE_GRID_GAP) / (cardSize + MODAL_SQUARE_GRID_GAP)))
    // Size from row capacity, not item count: incomplete state groups keep the same
    // tracks as full rows instead of turning one or two tiles into giant cards.
    const expandedCardSize = (availableWidth - MODAL_SQUARE_GRID_GAP * (columns - 1)) / columns
    return {
      cardSize: expandedCardSize,
      columns,
      modalWidth: maxGridWidth + MODAL_SQUARE_GRID_DIALOG_HORIZONTAL_CHROME,
      rows: Math.ceil(count / columns),
    }
  }

  const balancedTracks = balancedModalSquareGridTracks(count)
  const columns = Math.min(balancedTracks.columns, modalSquareGridColumnsThatFit(maxGridWidth, cardSize))
  const rows = Math.ceil(count / columns)

  return {
    cardSize,
    columns,
    modalWidth: modalWidthForSquareGrid(columns, cardSize),
    rows,
  }
}

export function useModalSquareGridLayout(open: boolean, count: number, edgeGutter = MODAL_SQUARE_GRID_EDGE_GUTTER) {
  const [gridNode, setGridNode] = useState<HTMLElement | null>(null)
  const [measurement, setMeasurement] = useState<{ width: number; presentation: ModalSheetPresentation }>({
    width: 0,
    presentation: 'sheet',
  })
  const gridRef = useCallback((node: HTMLElement | null) => {
    setGridNode((current) => current === node ? current : node)
  }, [])
  const layout = modalSquareGridLayout(count, measurement.width, measurement.presentation, edgeGutter)

  useLayoutEffect(() => {
    if (!open || !gridNode) return undefined

    let frame = 0
    const update = () => {
      const width = gridNode.getBoundingClientRect().width
      const presentation = modalSheetPresentationForViewport(window.innerWidth, window.innerHeight)
      setMeasurement((current) => current.width === width && current.presentation === presentation
        ? current
        : { width, presentation })
    }
    const scheduleUpdate = () => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(update)
    }

    update()
    window.addEventListener('resize', scheduleUpdate)
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(scheduleUpdate)
    observer?.observe(gridNode)

    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', scheduleUpdate)
      observer?.disconnect()
    }
  }, [gridNode, open])

  return [gridRef, layout] as const
}

export function modalSquareGridStyle(layout: ModalSquareGridLayout): ModalSquareGridStyle {
  return {
    '--modal-square-card-size': `${layout.cardSize}px`,
    '--modal-square-cols': layout.columns,
    '--modal-square-rows': layout.rows,
    '--modal-square-track-width': `calc((100% - ${MODAL_SQUARE_GRID_GAP * (layout.columns - 1)}px) / ${layout.columns})`,
  }
}

export function modalSquareGridCenteredGeometry(id: string, count: number): ModalCenteredGeometry {
  const layout = fallbackModalSquareGridLayout(count, MODAL_SQUARE_GRID_DIALOG_CARD_SIZE)
  return {
    blockPolicy: 'fixed',
    blockSize: `${modalSquareGridHeight(layout) + MODAL_SQUARE_GRID_DESKTOP_VERTICAL_CHROME}px`,
    id,
    inlineSize: `${layout.modalWidth}px`,
  }
}

function modalSquareGridHeight(layout: ModalSquareGridLayout) {
  return layout.rows * layout.cardSize + MODAL_SQUARE_GRID_GAP * (layout.rows - 1)
}
