import { useEntity } from '@hakit/core';

interface AqiColorResult {
  /** CSS color string */
  color: string;
  /** Background with alpha */
  bgColor: string;
  /** EPA category label */
  label: string;
  /** Numeric AQI value */
  aqi: number;
  /** PM2.5 value if available */
  pm25: number | null;
}

/**
 * Maps AQI entity value to EPA color scale.
 * Ports sfenton-aqi-header module logic.
 *
 * EPA AQI Scale:
 *   0-50    → Green (Good)
 *   51-100  → Yellow (Moderate)
 *   101-150 → Orange (Unhealthy for Sensitive Groups)
 *   151-200 → Red (Unhealthy)
 *   201-300 → Purple (Very Unhealthy)
 *   301+    → Maroon (Hazardous)
 */
export function useAqiColor(entityId: string, pm25Entity?: string): AqiColorResult {
  const entity = useEntity(entityId);
  const pm25Ent = useEntity(pm25Entity ?? entityId);

  const aqi = parseFloat(entity?.state ?? '0');
  const pm25 = pm25Entity ? parseFloat(pm25Ent?.state ?? '0') : null;

  const { color, bgColor } = aqiToColors(isNaN(aqi) ? 0 : aqi);

  return {
    color,
    bgColor,
    label: aqiLabel(isNaN(aqi) ? 0 : aqi),
    aqi: isNaN(aqi) ? 0 : aqi,
    pm25: pm25 !== null && !isNaN(pm25) ? pm25 : null,
  };
}

function aqiToColors(aqi: number): { color: string; bgColor: string } {
  if (aqi <= 50) return { color: 'rgb(76, 175, 80)', bgColor: 'rgba(76, 175, 80, 0.25)' };
  if (aqi <= 100) return { color: 'rgb(255, 235, 59)', bgColor: 'rgba(255, 235, 59, 0.25)' };
  if (aqi <= 150) return { color: 'rgb(255, 152, 0)', bgColor: 'rgba(255, 152, 0, 0.25)' };
  if (aqi <= 200) return { color: 'rgb(244, 67, 54)', bgColor: 'rgba(244, 67, 54, 0.25)' };
  if (aqi <= 300) return { color: 'rgb(156, 39, 176)', bgColor: 'rgba(156, 39, 176, 0.25)' };
  return { color: 'rgb(126, 0, 35)', bgColor: 'rgba(126, 0, 35, 0.25)' };
}

function aqiLabel(aqi: number): string {
  if (aqi <= 50) return 'Good';
  if (aqi <= 100) return 'Moderate';
  if (aqi <= 150) return 'Unhealthy (SG)';
  if (aqi <= 200) return 'Unhealthy';
  if (aqi <= 300) return 'Very Unhealthy';
  return 'Hazardous';
}
