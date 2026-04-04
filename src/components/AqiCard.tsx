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

const valueStyles = css`
  font-size: 16px;
  font-weight: 700;
`;

const subStyles = css`
  font-size: 11px;
  opacity: 0.5;
`;

/** Map AQI value to color (EPA scale) */
function aqiToColor(aqi: number): string {
  if (aqi <= 50) return 'rgba(76, 175, 80, 0.6)';     // Good - green
  if (aqi <= 100) return 'rgba(255, 235, 59, 0.6)';   // Moderate - yellow
  if (aqi <= 150) return 'rgba(255, 152, 0, 0.6)';    // USG - orange
  if (aqi <= 200) return 'rgba(244, 67, 54, 0.6)';    // Unhealthy - red
  if (aqi <= 300) return 'rgba(156, 39, 176, 0.6)';   // Very Unhealthy - purple
  return 'rgba(126, 0, 35, 0.6)';                      // Hazardous - maroon
}

function aqiLabel(aqi: number): string {
  if (aqi <= 50) return 'Good';
  if (aqi <= 100) return 'Moderate';
  if (aqi <= 150) return 'Unhealthy (SG)';
  if (aqi <= 200) return 'Unhealthy';
  if (aqi <= 300) return 'Very Unhealthy';
  return 'Hazardous';
}

interface AqiCardProps {
  entityId: string;
  name: string;
  /** Optional PM2.5 entity for secondary reading */
  pm25Entity?: string;
}

export function AqiCard({ entityId, name, pm25Entity }: AqiCardProps) {
  const entity = useEntity(entityId);
  const pm25 = useEntity(pm25Entity ?? entityId);
  const aqi = parseFloat(entity?.state ?? '0');
  const color = aqiToColor(isNaN(aqi) ? 0 : aqi);
  const hasPm25 = pm25Entity && pm25Entity !== entityId;
  const pm25Value = hasPm25 ? pm25?.state : undefined;

  return (
    <div css={cardStyles}>
      <div css={iconStyles(color)}>🌬</div>
      <div css={infoStyles}>
        <div css={nameStyles}>{name}</div>
        <div css={valueStyles}>
          {isNaN(aqi) ? entity?.state ?? '—' : Math.round(aqi)} AQI
        </div>
        {hasPm25 && pm25Value && (
          <div css={subStyles}>PM2.5: {pm25Value} µg/m³</div>
        )}
        <div css={subStyles}>{aqiLabel(isNaN(aqi) ? 0 : aqi)}</div>
      </div>
    </div>
  );
}
