import type { ModalCenteredGeometry } from '../core/ModalSheet'
import { titleCaseState } from './entityState'

export const SECURITY_SYSTEM_CENTERED_GEOMETRY = {
  blockPolicy: 'fixed',
  blockSize: '360px',
  id: 'security-system',
  inlineSize: '500px',
} satisfies ModalCenteredGeometry

export function securitySystemModalSubtitle(state: string | undefined) {
  return titleCaseState(state)
}
