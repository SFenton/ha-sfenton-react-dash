import type { ModalSheetStyle } from '../core/ModalSheet'

export const VACUUM_MODAL_STYLE: ModalSheetStyle = {
  '--modal-desktop-body-overflow-y': 'auto',
  '--modal-desktop-height': 'auto',
  '--modal-desktop-max-width': '980px',
  '--modal-desktop-width': '980px',
}

export const VACUUM_OUTCOME_MODAL_STYLE: ModalSheetStyle = {
  ...VACUUM_MODAL_STYLE,
  '--modal-desktop-height': 'min(760px, calc(100dvh - 64px))',
}

export const VACUUM_AREA_EDITOR_MODAL_STYLE: ModalSheetStyle = {
  ...VACUUM_MODAL_STYLE,
  '--modal-body-overflow-y': 'hidden',
  '--modal-desktop-body-overflow-y': 'hidden',
  '--modal-desktop-height': 'min(760px, calc(100dvh - 64px))',
}
