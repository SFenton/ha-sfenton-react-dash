import { css } from '@emotion/react';
import { useEntity } from '@hakit/core';
import { frostedGlass } from '../styles';

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

/** Map temperature to a color gradient (blue=cold → orange=warm → red=hot) */
function tempToColor(temp: number): string {
  if (temp <= 60) return 'rgba(66, 133, 244, 0.6)';   // cold blue
  if (temp <= 68) return 'rgba(52, 168, 83, 0.6)';    // cool green
  if (temp <= 72) return 'rgba(251, 188, 4, 0.6)';    // comfortable yellow
  if (temp <= 76) return 'rgba(234, 134, 0, 0.6)';    // warm orange
  return 'rgba(234, 67, 53, 0.6)';                     // hot red
}

interface ClimateSensorProps {
  entityId: string;
  name: string;
  /** Optional entity that provides a color hint (input_text with rgb) */
  colorEntity?: string;
}

export function ClimateSensor({ entityId, name, colorEntity }: ClimateSensorProps) {
  const entity = useEntity(entityId);
  const colorHint = useEntity(colorEntity ?? entityId);
  const temp = parseFloat(entity?.state ?? '0');
  const unit = entity?.attributes?.unit_of_measurement ?? '°F';
  const displayTemp = isNaN(temp) ? entity?.state ?? '—' : `${Math.round(temp)}${unit}`;
  const color = tempToColor(temp);

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
