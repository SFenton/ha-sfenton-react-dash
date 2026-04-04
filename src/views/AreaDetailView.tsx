import { css } from '@emotion/react';
import { ViewHeader } from '../components/ViewHeader';
import type { AreaRoute } from '../routes';
import { AREA_ROUTES } from '../routes';

const sectionStyles = css`
  margin-bottom: 24px;
`;

const sectionTitleStyles = css`
  font-size: 14px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.5);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0 0 12px;
`;

const placeholderStyles = css`
  padding: 16px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px dashed rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.3);
  font-size: 13px;
`;

interface AreaDetailViewProps {
  area: AreaRoute;
}

export function AreaDetailView({ area }: AreaDetailViewProps) {
  const areaInfo = AREA_ROUTES.find((a) => a.route === area);
  const title = areaInfo?.label ?? area;

  return (
    <>
      <ViewHeader title={title} showBack />

      <div css={sectionStyles}>
        <p css={sectionTitleStyles}>Lights</p>
        <div css={placeholderStyles}>Light controls — Phase 5</div>
      </div>

      <div css={sectionStyles}>
        <p css={sectionTitleStyles}>Climate</p>
        <div css={placeholderStyles}>Climate sensors — Phase 5</div>
      </div>

      <div css={sectionStyles}>
        <p css={sectionTitleStyles}>Occupancy</p>
        <div css={placeholderStyles}>Occupancy sensors — Phase 5</div>
      </div>

      <div css={sectionStyles}>
        <p css={sectionTitleStyles}>Contact Sensors</p>
        <div css={placeholderStyles}>Door/window sensors — Phase 5</div>
      </div>

      <div css={sectionStyles}>
        <p css={sectionTitleStyles}>Vents</p>
        <div css={placeholderStyles}>Vent controls — Phase 5</div>
      </div>
    </>
  );
}
