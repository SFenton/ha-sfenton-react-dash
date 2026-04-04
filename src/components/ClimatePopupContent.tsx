import { css } from '@emotion/react';
import { ClimateSensor } from './ClimateSensor';
import { ErrorBoundary } from './ErrorBoundary';
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
          <ErrorBoundary key={sensor.entityId}>
            <ClimateSensor
              entityId={sensor.entityId}
              name={sensor.name}
              colorEntity={sensor.colorEntity}
            />
          </ErrorBoundary>
        ))}
      </div>
    </>
  );
}
