import { css } from '@emotion/react';
import { LightSlider } from './LightSlider';
import { Separator } from './Separator';
import { ErrorBoundary } from './ErrorBoundary';
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
              <ErrorBoundary key={light.entityId} fallback={<EntityError name={light.name} />}>
                <LightSlider entityId={light.entityId} name={light.name} />
              </ErrorBoundary>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

function EntityError({ name }: { name: string }) {
  return (
    <div css={css`
      padding: 12px;
      border-radius: 16px;
      background: rgba(255, 255, 255, 0.04);
      border: 1px dashed rgba(255, 255, 255, 0.1);
      color: rgba(255, 255, 255, 0.3);
      font-size: 12px;
    `}>
      {name} — unavailable
    </div>
  );
}
