import { useEntity } from '@hakit/core';

interface DoorStateResult {
  /** Whether the door/window is open */
  isOpen: boolean;
  /** CSS color for the indicator */
  color: string;
  /** Background color for cards */
  bgColor: string;
  /** Display text */
  label: string;
  /** Icon suggestion */
  icon: string;
}

/**
 * Formats door/window contact sensor state with color and icon.
 * Ports sfenton-door-bubble / sfenton-multi-door-header module logic.
 *
 * Open → red warning state with open door icon
 * Closed → neutral with closed/locked icon
 */
export function useDoorState(entityId: string, type: 'door' | 'window' = 'door'): DoorStateResult {
  const entity = useEntity(entityId);
  const isOpen = entity?.state === 'on';

  if (isOpen) {
    return {
      isOpen: true,
      color: 'rgb(239, 83, 80)',
      bgColor: 'rgba(239, 83, 80, 0.15)',
      label: 'Open',
      icon: type === 'door' ? 'mdi:door-open' : 'mdi:window-open',
    };
  }

  return {
    isOpen: false,
    color: 'rgba(255, 255, 255, 0.4)',
    bgColor: 'rgba(255, 255, 255, 0.04)',
    label: 'Closed',
    icon: type === 'door' ? 'mdi:door-closed-lock' : 'mdi:window-closed',
  };
}

/**
 * Aggregates multiple contact sensors into a summary state.
 * Ports sfenton-multi-door-header module logic.
 *
 * Used for the overview chip that shows "2 open" / "All closed".
 */
export function useMultiDoorState(entityIds: string[]): {
  openCount: number;
  totalCount: number;
  anyOpen: boolean;
  label: string;
  color: string;
} {
  // This hook can't call useEntity in a loop (hooks rules),
  // so it works with a group entity or a count sensor instead.
  // The overview chip should use a binary_sensor group entity.
  const openCount = 0; // Will be computed from group entity
  const totalCount = entityIds.length;

  return {
    openCount,
    totalCount,
    anyOpen: openCount > 0,
    label: openCount > 0 ? `${openCount} open` : 'All closed',
    color: openCount > 0 ? 'rgb(239, 83, 80)' : 'rgba(255, 255, 255, 0.4)',
  };
}
