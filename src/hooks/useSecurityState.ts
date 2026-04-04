import { useEntity } from '@hakit/core';

interface SecurityStateResult {
  /** Alarm state: armed_away, armed_home, armed_night, disarmed, pending, triggered */
  state: string;
  /** CSS color for the security indicator */
  color: string;
  /** Background color */
  bgColor: string;
  /** Human-readable label */
  label: string;
  /** Icon suggestion */
  icon: string;
  /** Whether the system is in an armed state */
  isArmed: boolean;
  /** Whether the system is in alert (triggered/pending) */
  isAlert: boolean;
}

/**
 * Formats alarm_control_panel state with colors and labels.
 * Ports sfenton-security-header module logic.
 *
 * State colors:
 *   disarmed    → green (safe)
 *   armed_home  → blue (home mode)
 *   armed_away  → blue-purple (away mode)
 *   armed_night → indigo (night mode)
 *   pending     → yellow (arming/disarming)
 *   triggered   → red (alarm!)
 */
export function useSecurityState(entityId: string): SecurityStateResult {
  const entity = useEntity(entityId);
  const state = entity?.state ?? 'unavailable';

  return {
    state,
    ...stateToVisuals(state),
    isArmed: state.startsWith('armed'),
    isAlert: state === 'triggered' || state === 'pending',
  };
}

function stateToVisuals(state: string): { color: string; bgColor: string; label: string; icon: string } {
  switch (state) {
    case 'disarmed':
      return {
        color: 'rgb(76, 175, 80)',
        bgColor: 'rgba(76, 175, 80, 0.15)',
        label: 'Disarmed',
        icon: 'mdi:shield-off',
      };
    case 'armed_home':
      return {
        color: 'rgb(66, 165, 245)',
        bgColor: 'rgba(66, 165, 245, 0.15)',
        label: 'Armed Home',
        icon: 'mdi:shield-home',
      };
    case 'armed_away':
      return {
        color: 'rgb(126, 87, 194)',
        bgColor: 'rgba(126, 87, 194, 0.15)',
        label: 'Armed Away',
        icon: 'mdi:shield-lock',
      };
    case 'armed_night':
      return {
        color: 'rgb(92, 107, 192)',
        bgColor: 'rgba(92, 107, 192, 0.15)',
        label: 'Armed Night',
        icon: 'mdi:shield-moon',
      };
    case 'pending':
      return {
        color: 'rgb(255, 193, 7)',
        bgColor: 'rgba(255, 193, 7, 0.15)',
        label: 'Pending',
        icon: 'mdi:shield-alert',
      };
    case 'triggered':
      return {
        color: 'rgb(244, 67, 54)',
        bgColor: 'rgba(244, 67, 54, 0.25)',
        label: 'TRIGGERED',
        icon: 'mdi:shield-alert',
      };
    case 'arming':
      return {
        color: 'rgb(255, 193, 7)',
        bgColor: 'rgba(255, 193, 7, 0.15)',
        label: 'Arming...',
        icon: 'mdi:shield',
      };
    default:
      return {
        color: 'rgba(255, 255, 255, 0.3)',
        bgColor: 'rgba(255, 255, 255, 0.04)',
        label: state === 'unavailable' ? 'Unavailable' : state,
        icon: 'mdi:shield-outline',
      };
  }
}
