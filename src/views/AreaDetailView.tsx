import { css } from '@emotion/react';
import { ViewHeader, Separator, LightSlider, ClimateSensor, OccupancySensor, DoorSensor, WindowSensor, VentButton } from '../components';
import { twoColumnGrid } from '../styles';
import type { AreaRoute } from '../routes';
import { AREA_ROUTES } from '../routes';

const sectionStyles = css`
  margin-bottom: 20px;
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

/**
 * Area detail view — shows entity sections for a specific room.
 * Entity IDs follow HA naming conventions: domain.{area}_{sensor_type}
 * These will be populated with real entity IDs per-room in Phase 5.
 * For now, we render the component structure with placeholder entity patterns.
 */
export function AreaDetailView({ area }: AreaDetailViewProps) {
  const areaInfo = AREA_ROUTES.find((a) => a.route === area);
  const title = areaInfo?.label ?? area;
  const prefix = area.replace(/-/g, '_');

  return (
    <>
      <ViewHeader title={title} showBack />

      <div css={sectionStyles}>
        <Separator title="Lights" toggleEntity={`light.${prefix}`} />
        <div css={twoColumnGrid}>
          <LightSlider entityId={`light.${prefix}_light`} name={`${title} Light`} />
        </div>
      </div>

      <div css={sectionStyles}>
        <Separator title="Climate" />
        <div css={twoColumnGrid}>
          <ClimateSensor entityId={`sensor.${prefix}_temperature`} name={title} />
        </div>
      </div>

      <div css={sectionStyles}>
        <Separator title="Occupancy" />
        <div css={twoColumnGrid}>
          <OccupancySensor entityId={`binary_sensor.${prefix}_occupancy`} name={title} />
        </div>
      </div>

      <div css={sectionStyles}>
        <Separator title="Contact Sensors" />
        <div css={twoColumnGrid}>
          <DoorSensor entityId={`binary_sensor.${prefix}_door_contact`} name={`${title} Door`} />
          <WindowSensor entityId={`binary_sensor.${prefix}_window_contact`} name={`${title} Window`} />
        </div>
      </div>

      <div css={sectionStyles}>
        <Separator title="Vents" />
        <div css={twoColumnGrid}>
          <VentButton entityId={`cover.${prefix}_vent`} name={`${title} Vent`} />
        </div>
      </div>
    </>
  );
}
