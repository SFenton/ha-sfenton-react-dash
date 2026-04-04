import { css } from '@emotion/react';
import { AqiCard } from './AqiCard';
import { ErrorBoundary } from './ErrorBoundary';
import { twoColumnGrid } from '../styles';

const popupTitleStyles = css`
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 16px;
  color: white;
`;

interface AqiEntry {
  entityId: string;
  name: string;
  pm25Entity?: string;
}

interface AqiPopupContentProps {
  title: string;
  sensors: AqiEntry[];
}

export function AqiPopupContent({ title, sensors }: AqiPopupContentProps) {
  return (
    <>
      <p css={popupTitleStyles}>{title}</p>
      <div css={twoColumnGrid}>
        {sensors.map((s) => (
          <ErrorBoundary key={s.entityId}>
            <AqiCard entityId={s.entityId} name={s.name} pm25Entity={s.pm25Entity} />
          </ErrorBoundary>
        ))}
      </div>
    </>
  );
}
