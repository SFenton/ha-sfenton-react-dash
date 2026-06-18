import type { ModalSheetStyle } from '../core/ModalSheet'
import { VACUUM_MODAL_STYLE } from './vacuumModalStyle'

export const MEDIA_REMOTE_MODAL_STYLE: ModalSheetStyle = {
  ...VACUUM_MODAL_STYLE,
  '--modal-desktop-height': 'min(760px, calc(100dvh - 32px))',
  '--modal-desktop-max-height': 'calc(100dvh - 32px)',
  '--modal-mobile-height': '100dvh',
  '--modal-mobile-max-height': '100dvh',
}
