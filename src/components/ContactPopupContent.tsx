import { css } from '@emotion/react';
import { DoorSensor, WindowSensor } from './ContactSensor';
import { Separator } from './Separator';
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
              <DoorSensor key={d.entityId} entityId={d.entityId} name={d.name} />
            ))}
          </div>
        </>
      )}
      {windows.length > 0 && (
        <>
          <Separator title="Windows" />
          <div css={twoColumnGrid}>
            {windows.map((w) => (
              <WindowSensor key={w.entityId} entityId={w.entityId} name={w.name} />
            ))}
          </div>
        </>
      )}
    </>
  );
}
