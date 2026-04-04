import { useEntity } from '@hakit/core';

interface LightGlowResult {
  /** Whether the light is on */
  isOn: boolean;
  /** Brightness 0-100 */
  brightnessPct: number;
  /** Glow color for box-shadow (warm yellow, intensity varies with brightness) */
  glowColor: string;
  /** Background tint color (subtle warmth when on) */
  bgTint: string;
  /** Icon opacity (brighter = more opaque) */
  iconOpacity: number;
  /** CSS color for the light icon */
  iconColor: string;
}

/**
 * Computes light glow effects based on entity state and brightness.
 * Ports sfenton-light-header / sfenton-light-bubble module logic.
 *
 * When light is on:
 *   - Box shadow glow with warm yellow, intensity proportional to brightness
 *   - Background tint with low-alpha warm color
 *   - Icon turns warm white/yellow
 *
 * When light is off:
 *   - No glow, neutral gray icon, dimmed background
 */
export function useLightGlow(entityId: string): LightGlowResult {
  const entity = useEntity(entityId);
  const isOn = entity?.state === 'on';
  const brightness = entity?.attributes?.brightness ?? 0;
  const brightnessPct = Math.round((brightness / 255) * 100);

  if (!isOn) {
    return {
      isOn: false,
      brightnessPct: 0,
      glowColor: 'transparent',
      bgTint: 'rgba(255, 255, 255, 0.04)',
      iconOpacity: 0.4,
      iconColor: 'rgba(255, 255, 255, 0.4)',
    };
  }

  // Scale glow intensity with brightness (0.05 at min → 0.4 at max)
  const glowAlpha = 0.05 + (brightnessPct / 100) * 0.35;
  // Scale background tint (0.02 at min → 0.12 at max)
  const bgAlpha = 0.02 + (brightnessPct / 100) * 0.10;
  // Icon warm color shifts from dim amber to bright warm white
  const warmR = 255;
  const warmG = Math.round(180 + (brightnessPct / 100) * 55); // 180→235
  const warmB = Math.round(50 + (brightnessPct / 100) * 150);  // 50→200

  return {
    isOn: true,
    brightnessPct,
    glowColor: `rgba(255, 200, 50, ${glowAlpha})`,
    bgTint: `rgba(255, 200, 50, ${bgAlpha})`,
    iconOpacity: 0.7 + (brightnessPct / 100) * 0.3,
    iconColor: `rgb(${warmR}, ${warmG}, ${warmB})`,
  };
}
