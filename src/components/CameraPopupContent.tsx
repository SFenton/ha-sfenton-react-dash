import { css } from '@emotion/react';
import { CameraCard } from '@hakit/components';

const popupTitleStyles = css`
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 16px;
  color: white;
`;

const cameraWrapperStyles = css`
  border-radius: 12px;
  overflow: hidden;
`;

interface CameraPopupContentProps {
  title: string;
  entityId: string;
}

export function CameraPopupContent({ title, entityId }: CameraPopupContentProps) {
  return (
    <>
      <p css={popupTitleStyles}>{title}</p>
      <div css={cameraWrapperStyles}>
        <CameraCard entity={entityId as `camera.${string}`} />
      </div>
    </>
  );
}
