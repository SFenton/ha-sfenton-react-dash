import { css } from '@emotion/react';
import { DoorSensor, WindowSensor } from './ContactSensor';
import { Separator } from './Separator';
import { ErrorBoundary } from './ErrorBoundary';
import { twoColumnGrid } from '../styles';

const popupTitleStyles = css`
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 16px;
  color: white;
`;

interface ContactEntry {
  entityId: string;
  name: string;
}

interface ContactPopupContentProps {
  title: string;
  doors?: ContactEntry[];
  windows?: ContactEntry[];
}

export function ContactPopupContent({ title, doors = [], windows = [] }: ContactPopupContentProps) {
  return (
    <>
      <p css={popupTitleStyles}>{title}</p>
      {doors.length > 0 && (
        <>
          <Separator title="Doors" />
          <div css={twoColumnGrid}>
            {doors.map((d) => (
              <ErrorBoundary key={d.entityId}>
                <DoorSensor entityId={d.entityId} name={d.name} />
              </ErrorBoundary>
            ))}
          </div>
        </>
      )}
      {windows.length > 0 && (
        <>
          <Separator title="Windows" />
          <div css={twoColumnGrid}>
            {windows.map((w) => (
              <ErrorBoundary key={w.entityId}>
                <WindowSensor entityId={w.entityId} name={w.name} />
              </ErrorBoundary>
            ))}
          </div>
        </>
      )}
    </>
  );
}
