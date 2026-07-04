import type { ModalSheetStyle } from '../core/ModalSheet'
import { titleCaseState } from './entityState'

export const SECURITY_SYSTEM_MODAL_STYLE: ModalSheetStyle = {
  '--modal-desktop-height': 'auto',
  '--modal-desktop-max-width': '500px',
  '--modal-desktop-width': '500px',
}

export function securitySystemModalSubtitle(state: string | undefined) {
  return titleCaseState(state)
}
