import { css } from '@emotion/react';

/** Standard frosted glass card styling used across all entity cards */
export const frostedGlass = css`
  background: rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(15px);
  -webkit-backdrop-filter: blur(15px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  color: white;
  transition: background 0.2s;
`;

export const frostedGlassHover = css`
  &:hover {
    background: rgba(255, 255, 255, 0.1);
  }
`;

/** Icon container with semi-transparent background */
export const iconContainer = css`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
`;

/** Active state glow for entities that are "on" */
export const activeGlow = (color: string = 'rgba(255, 200, 50, 0.3)') => css`
  box-shadow: 0 0 20px ${color};
  background: rgba(255, 255, 255, 0.12);
`;

/** Two-column grid for entity cards */
export const twoColumnGrid = css`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
`;

/** Full-width section separator */
export const sectionSeparator = css`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  margin-top: 8px;
`;

export const sectionTitle = css`
  font-size: 14px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.7);
`;
