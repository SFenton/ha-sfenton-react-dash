import { css } from '@emotion/react';
import { frostedGlass } from '../styles';
import { useClimateColor } from '../hooks';

const cardStyles = css`
  ${frostedGlass};
  padding: 12px;
  display: flex;
  align-items: center;
  gap: 10px;
`;

const iconStyles = (color: string) => css`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: ${color};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  flex-shrink: 0;
`;

const infoStyles = css`
  flex: 1;
  min-width: 0;
`;

const nameStyles = css`
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const tempStyles = css`
  font-size: 18px;
  font-weight: 700;
`;

interface ClimateSensorProps {
  entityId: string;
  name: string;
  /** Optional entity that provides a color hint (input_text with rgb) */
  colorEntity?: string;
}

export function ClimateSensor({ entityId, name, colorEntity }: ClimateSensorProps) {
  const { color, bgColor, temp, unit, label } = useClimateColor(entityId, colorEntity);
  const displayTemp = isNaN(temp) ? '—' : `${Math.round(temp)}${unit}`;

  return (
    <div css={cardStyles}>
      <div css={iconStyles(color)}>🌡</div>
      <div css={infoStyles}>
        <div css={nameStyles}>{name}</div>
        <div css={tempStyles}>{displayTemp}</div>
      </div>
    </div>
  );
}
