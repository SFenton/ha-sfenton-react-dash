import { useEntity } from '@hakit/core';

interface OccupancyStateResult {
  /** Whether any occupancy is detected */
  isDetected: boolean;
  /** CSS color for the indicator */
  color: string;
  /** Background color for cards */
  bgColor: string;
  /** Display text */
  label: string;
  /** Count of occupants if available from attributes */
  count: number | null;
}

/**
 * Formats occupancy state with color and label.
 * Ports sfenton-occupancy-header module logic.
 *
 * Supports both binary_sensor (on/off) and sensor (numeric count) entities.
 */
export function useOccupancyState(entityId: string): OccupancyStateResult {
  const entity = useEntity(entityId);
  const state = entity?.state;

  // Binary sensor style
  if (state === 'on' || state === 'off') {
    const isDetected = state === 'on';
    return {
      isDetected,
      color: isDetected ? 'rgb(76, 175, 80)' : 'rgba(255, 255, 255, 0.3)',
      bgColor: isDetected ? 'rgba(76, 175, 80, 0.15)' : 'rgba(255, 255, 255, 0.04)',
      label: isDetected ? 'Detected' : 'Clear',
      count: null,
    };
  }

  // Numeric sensor (count of active sensors)
  const count = parseInt(state ?? '0', 10);
  const isDetected = count > 0;
  return {
    isDetected,
    color: isDetected ? 'rgb(76, 175, 80)' : 'rgba(255, 255, 255, 0.3)',
    bgColor: isDetected ? 'rgba(76, 175, 80, 0.15)' : 'rgba(255, 255, 255, 0.04)',
    label: isDetected ? `${count} active` : 'Clear',
    count: isNaN(count) ? null : count,
  };
}
