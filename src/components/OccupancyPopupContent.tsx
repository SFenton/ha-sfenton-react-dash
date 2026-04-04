import { css } from '@emotion/react';
import { OccupancySensor } from './OccupancySensor';
import { ErrorBoundary } from './ErrorBoundary';
import { twoColumnGrid } from '../styles';

const popupTitleStyles = css`
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 16px;
  color: white;
`;

interface OccupancyEntry {
  entityId: string;
  name: string;
}

interface OccupancyPopupContentProps {
  title: string;
  sensors: OccupancyEntry[];
}

export function OccupancyPopupContent({ title, sensors }: OccupancyPopupContentProps) {
  return (
    <>
      <p css={popupTitleStyles}>{title}</p>
      <div css={twoColumnGrid}>
        {sensors.map((sensor) => (
          <ErrorBoundary key={sensor.entityId}>
            <OccupancySensor entityId={sensor.entityId} name={sensor.name} />
          </ErrorBoundary>
        ))}
      </div>
    </>
  );
}
