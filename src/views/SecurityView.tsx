import { css } from '@emotion/react';
import { useService } from '@hakit/core';
import { AlarmCard, CameraCard } from '@hakit/components';
import { ViewHeader, Separator, EntityToggle } from '../components';
import { useSecurityState } from '../hooks';
import { frostedGlass, twoColumnGrid } from '../styles';

const alarmContainerStyles = css`
  margin-bottom: 24px;
  border-radius: 16px;
  overflow: hidden;
`;

const statusBannerStyles = (bgColor: string) => css`
  ${frostedGlass};
  padding: 16px;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  background: ${bgColor};
`;

const statusLabelStyles = css`
  font-size: 20px;
  font-weight: 700;
`;

const statusSubStyles = css`
  font-size: 12px;
  opacity: 0.6;
`;

const sectionStyles = css`
  margin-bottom: 24px;
`;

const cameraGridStyles = css`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
`;

const cameraWrapperStyles = css`
  border-radius: 12px;
  overflow: hidden;
`;

const ALARM_ENTITY = 'alarm_control_panel.aqara_hub_m3_0056_security_system_2';
const LOCK_ENTITY = 'lock.aqara_smart_lock_u100';

export function SecurityView() {
  const security = useSecurityState(ALARM_ENTITY);

  return (
    <>
      <ViewHeader title="Security" />

      <div css={statusBannerStyles(security.bgColor)}>
        <span style={{ fontSize: 28 }}>🛡</span>
        <div>
          <div css={statusLabelStyles}>{security.label}</div>
          <div css={statusSubStyles}>{security.state}</div>
        </div>
      </div>

      <div css={sectionStyles}>
        <Separator title="Alarm" />
        <div css={alarmContainerStyles}>
          <AlarmCard entity={ALARM_ENTITY as `alarm_control_panel.${string}`} />
        </div>
      </div>

      <div css={sectionStyles}>
        <Separator title="Locks" />
        <div css={twoColumnGrid}>
          <EntityToggle entityId={LOCK_ENTITY} name="Front Door Lock" />
        </div>
      </div>

      <div css={sectionStyles}>
        <Separator title="Garage Doors" />
        <div css={twoColumnGrid}>
          <EntityToggle entityId="cover.left_door" name="Left Garage Door" />
          <EntityToggle entityId="cover.right_door" name="Right Garage Door" />
        </div>
      </div>

      <div css={sectionStyles}>
        <Separator title="Cameras" />
        <div css={cameraGridStyles}>
          <div css={cameraWrapperStyles}>
            <CameraCard entity={'camera.front_door' as `camera.${string}`} />
          </div>
          <div css={cameraWrapperStyles}>
            <CameraCard entity={'camera.driveway' as `camera.${string}`} />
          </div>
          <div css={cameraWrapperStyles}>
            <CameraCard entity={'camera.upper_deck' as `camera.${string}`} />
          </div>
          <div css={cameraWrapperStyles}>
            <CameraCard entity={'camera.lower_deck' as `camera.${string}`} />
          </div>
        </div>
      </div>
    </>
  );
}
