import type { ModalSheetStyle } from '../core/ModalSheet'

export const HUMIDIFIER_MODAL_STYLE: ModalSheetStyle = {
  '--modal-desktop-body-overflow-y': 'hidden',
  '--modal-desktop-height': 'auto',
  '--modal-desktop-max-width': '980px',
  '--modal-desktop-width': '980px',
}

export const HUMIDIFIER_MODAL_SCHEDULES_STYLE: ModalSheetStyle = {
  ...HUMIDIFIER_MODAL_STYLE,
  '--modal-body-footer-padding-bottom': '0px',
}

export const HUMIDIFIER_MODAL_DETAIL_STYLE: ModalSheetStyle = {
  ...HUMIDIFIER_MODAL_STYLE,
  '--modal-desktop-body-overflow-y': 'auto',
}
