import { css } from '@emotion/react';
import { VentButton } from './VentButton';
import { twoColumnGrid } from '../styles';

const popupTitleStyles = css`
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 16px;
  color: white;
`;

interface VentEntry {
  entityId: string;
  name: string;
}

interface VentPopupContentProps {
  title: string;
  vents: VentEntry[];
}

export function VentPopupContent({ title, vents }: VentPopupContentProps) {
  return (
    <>
      <p css={popupTitleStyles}>{title}</p>
      <div css={twoColumnGrid}>
        {vents.map((v) => (
          <VentButton key={v.entityId} entityId={v.entityId} name={v.name} />
        ))}
      </div>
    </>
  );
}
