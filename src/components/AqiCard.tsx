import { css } from '@emotion/react';
import { frostedGlass } from '../styles';
import { useAqiColor } from '../hooks';

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

const valueStyles = css`
  font-size: 16px;
  font-weight: 700;
`;

const subStyles = css`
  font-size: 11px;
  opacity: 0.5;
`;

interface AqiCardProps {
  entityId: string;
  name: string;
  /** Optional PM2.5 entity for secondary reading */
  pm25Entity?: string;
}

export function AqiCard({ entityId, name, pm25Entity }: AqiCardProps) {
  const { color, bgColor, aqi, pm25, label } = useAqiColor(entityId, pm25Entity);

  return (
    <div css={cardStyles}>
      <div css={iconStyles(bgColor)}>🌬</div>
      <div css={infoStyles}>
        <div css={nameStyles}>{name}</div>
        <div css={valueStyles}>
          {Math.round(aqi)} AQI
        </div>
        {pm25 !== null && (
          <div css={subStyles}>PM2.5: {pm25} µg/m³</div>
        )}
        <div css={subStyles}>{label}</div>
      </div>
    </div>
  );
}
