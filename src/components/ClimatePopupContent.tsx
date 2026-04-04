import { css } from '@emotion/react';
import { ClimateSensor } from './ClimateSensor';
import { twoColumnGrid } from '../styles';

const popupTitleStyles = css`
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 16px;
  color: white;
`;

interface ClimateEntry {
  entityId: string;
  name: string;
  colorEntity?: string;
}

interface ClimatePopupContentProps {
  title: string;
  sensors: ClimateEntry[];
}

export function ClimatePopupContent({ title, sensors }: ClimatePopupContentProps) {
  return (
    <>
      <p css={popupTitleStyles}>{title}</p>
      <div css={twoColumnGrid}>
        {sensors.map((sensor) => (
          <ClimateSensor
            key={sensor.entityId}
            entityId={sensor.entityId}
            name={sensor.name}
            colorEntity={sensor.colorEntity}
          />
        ))}
      </div>
    </>
  );
}
