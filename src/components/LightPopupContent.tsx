import { css } from '@emotion/react';
import { LightSlider } from './LightSlider';
import { Separator } from './Separator';
import { twoColumnGrid } from '../styles';

const popupTitleStyles = css`
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 16px;
  color: white;
`;

interface LightEntry {
  entityId: string;
  name: string;
}

interface LightSection {
  title: string;
  toggleEntity?: string;
  lights: LightEntry[];
}

interface LightPopupContentProps {
  title: string;
  sections: LightSection[];
}

export function LightPopupContent({ title, sections }: LightPopupContentProps) {
  return (
    <>
      <p css={popupTitleStyles}>{title}</p>
      {sections.map((section) => (
        <div key={section.title}>
          <Separator title={section.title} toggleEntity={section.toggleEntity} />
          <div css={twoColumnGrid}>
            {section.lights.map((light) => (
              <LightSlider key={light.entityId} entityId={light.entityId} name={light.name} />
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
