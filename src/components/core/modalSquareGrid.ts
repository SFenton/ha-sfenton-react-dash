import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import type { ModalSheetStyle } from './ModalSheet'

const MODAL_SQUARE_GRID_GAP = 10
const MODAL_SQUARE_GRID_EDGE_GUTTER = 6
const MODAL_SQUARE_GRID_CARD_SIZE = 168
const MODAL_SQUARE_GRID_HORIZONTAL_PADDING = 48 + MODAL_SQUARE_GRID_EDGE_GUTTER * 2
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
}

type ModalSquareGridModalStyle = ModalSheetStyle & {
  '--modal-desktop-width': string
  '--modal-desktop-height'?: string
}

function balancedModalSquareGridTracks(count: number) {
  const columns = Math.max(1, Math.ceil(Math.sqrt(count)))
  return { columns, rows: Math.ceil(count / columns) }
}

function modalSquareGridColumnsThatFit(maxGridWidth: number) {
  return Math.max(1, Math.floor((maxGridWidth + MODAL_SQUARE_GRID_GAP) / (MODAL_SQUARE_GRID_CARD_SIZE + MODAL_SQUARE_GRID_GAP)))
}

function modalWidthForSquareGrid(columns: number) {
  return columns * MODAL_SQUARE_GRID_CARD_SIZE + MODAL_SQUARE_GRID_GAP * (columns - 1) + MODAL_SQUARE_GRID_HORIZONTAL_PADDING
}

function fallbackModalSquareGridLayout(count: number): ModalSquareGridLayout {
  const { columns, rows } = balancedModalSquareGridTracks(count)
  return {
    cardSize: MODAL_SQUARE_GRID_CARD_SIZE,
    columns,
    modalWidth: modalWidthForSquareGrid(columns),
    rows,
  }
}

function chooseModalSquareGridLayout(count: number): ModalSquareGridLayout {
  if (count <= 0) return fallbackModalSquareGridLayout(1)

  const balancedTracks = balancedModalSquareGridTracks(count)
  const maxModalWidth = Math.min(window.innerWidth * 0.9, window.innerWidth - 64)
  const maxGridWidth = Math.max(MODAL_SQUARE_GRID_CARD_SIZE, maxModalWidth - MODAL_SQUARE_GRID_HORIZONTAL_PADDING)
  const columns = Math.min(balancedTracks.columns, modalSquareGridColumnsThatFit(maxGridWidth))
  const rows = Math.ceil(count / columns)

  return {
    cardSize: MODAL_SQUARE_GRID_CARD_SIZE,
    columns,
    modalWidth: Math.min(maxModalWidth, modalWidthForSquareGrid(columns)),
    rows,
  }
}

export function useModalSquareGridLayout(open: boolean, count: number) {
  const [layoutVersion, setLayoutVersion] = useState(0)
  const gridRef = useCallback((node: HTMLElement | null) => {
    void node
  }, [])
  void layoutVersion
  const layout = typeof window === 'undefined' ? fallbackModalSquareGridLayout(count) : chooseModalSquareGridLayout(count)

  useEffect(() => {
    if (!open) return undefined

    let frame = 0
    const scheduleUpdate = () => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => setLayoutVersion((version) => version + 1))
    }

    scheduleUpdate()
    window.addEventListener('resize', scheduleUpdate)

    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', scheduleUpdate)
    }
  }, [open])

  return [gridRef, layout] as const
}

export function modalSquareGridStyle(layout: ModalSquareGridLayout): ModalSquareGridStyle {
  return {
    '--modal-square-card-size': `${layout.cardSize}px`,
    '--modal-square-cols': layout.columns,
    '--modal-square-rows': layout.rows,
  }
}

export function modalSquareGridModalStyle(layout: ModalSquareGridLayout): ModalSquareGridModalStyle {
  return {
    '--modal-desktop-width': `${layout.modalWidth}px`,
    '--modal-desktop-height': `${modalSquareGridHeight(layout) + MODAL_SQUARE_GRID_DESKTOP_VERTICAL_CHROME}px`,
  }
}

function modalSquareGridHeight(layout: ModalSquareGridLayout) {
  return layout.rows * layout.cardSize + MODAL_SQUARE_GRID_GAP * (layout.rows - 1)
}

function modalAdaptiveSquareGridModalStyle(layout: ModalSquareGridLayout): ModalSquareGridModalStyle {
  return {
    ...modalSquareGridModalStyle(layout),
    '--modal-desktop-height': 'auto',
  }
}

export function modalSquareGridModalStyleForHash(hash: string, layout: ModalSquareGridLayout) {
  if (hash === '#aqi-overview') return modalAdaptiveSquareGridModalStyle(layout)
  return modalSquareGridModalStyle(layout)
}
