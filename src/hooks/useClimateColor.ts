import { useEntity } from '@hakit/core';

interface ClimateColorResult {
  /** CSS color string for the climate indicator */
  color: string;
  /** Background with alpha for card use */
  bgColor: string;
  /** Human-readable label */
  label: string;
  /** Numeric temperature value */
  temp: number;
  /** Unit of measurement */
  unit: string;
}

/**
 * Maps climate entity temperature to a color gradient.
 * Ports sfenton-climate-header / sfenton-climate-button module logic.
 *
 * Color scale (Fahrenheit):
 *   ≤55°F  → deep blue (very cold)
 *   56-64  → blue (cold)
 *   65-68  → teal (cool)
 *   69-72  → green (comfortable)
 *   73-76  → yellow (warm)
 *   77-80  → orange (hot)
 *   ≥81°F  → red (very hot)
 *
 * Supports an optional colorEntity (input_text) for pre-computed colors from HA.
 */
export function useClimateColor(entityId: string, colorEntity?: string): ClimateColorResult {
  const entity = useEntity(entityId);
  const colorHint = useEntity(colorEntity ?? entityId);

  const temp = parseFloat(entity?.state ?? '0');
  const unit = entity?.attributes?.unit_of_measurement ?? '°F';

  // If a color entity provides a pre-computed color, use it
  if (colorEntity && colorHint?.state && colorHint.state.startsWith('#')) {
    return {
      color: colorHint.state,
      bgColor: hexToRgba(colorHint.state, 0.3),
      label: tempLabel(temp),
      temp,
      unit,
    };
  }

  // Otherwise compute from temperature
  const color = tempToColor(temp);
  return {
    color,
    bgColor: color.replace('1)', '0.3)'),
    label: tempLabel(temp),
    temp,
    unit,
  };
}

function tempToColor(temp: number): string {
  if (isNaN(temp)) return 'rgba(150, 150, 150, 1)';
  if (temp <= 55) return 'rgba(33, 100, 209, 1)';    // deep blue
  if (temp <= 60) return 'rgba(66, 133, 244, 1)';    // blue
  if (temp <= 64) return 'rgba(0, 172, 193, 1)';     // cyan
  if (temp <= 68) return 'rgba(38, 166, 154, 1)';    // teal
  if (temp <= 72) return 'rgba(76, 175, 80, 1)';     // green
  if (temp <= 74) return 'rgba(192, 202, 51, 1)';    // lime
  if (temp <= 76) return 'rgba(251, 192, 45, 1)';    // yellow
  if (temp <= 78) return 'rgba(255, 152, 0, 1)';     // orange
  if (temp <= 80) return 'rgba(244, 81, 30, 1)';     // deep orange
  return 'rgba(229, 57, 53, 1)';                      // red
}

function tempLabel(temp: number): string {
  if (isNaN(temp)) return 'Unknown';
  if (temp <= 55) return 'Very Cold';
  if (temp <= 64) return 'Cold';
  if (temp <= 68) return 'Cool';
  if (temp <= 72) return 'Comfortable';
  if (temp <= 76) return 'Warm';
  if (temp <= 80) return 'Hot';
  return 'Very Hot';
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
