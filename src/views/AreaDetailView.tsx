import { css } from '@emotion/react';
import { ViewHeader, Separator, LightSlider, ClimateSensor, OccupancySensor, DoorSensor, WindowSensor, VentButton, AqiCard } from '../components';
import { twoColumnGrid } from '../styles';
import type { AreaRoute } from '../routes';
import { AREA_ROUTES } from '../routes';
import { AREA_ENTITIES } from '../areaEntities';

const sectionStyles = css`
  margin-bottom: 20px;
`;

interface AreaDetailViewProps {
  area: AreaRoute;
}

export function AreaDetailView({ area }: AreaDetailViewProps) {
  const areaInfo = AREA_ROUTES.find((a) => a.route === area);
  const title = areaInfo?.label ?? area;
  const config = AREA_ENTITIES[area];

  return (
    <>
      <ViewHeader title={title} showBack />

      {config.lights.length > 0 && (
        <div css={sectionStyles}>
          <Separator title="Lights" toggleEntity={config.groupLight} />
          <div css={twoColumnGrid}>
            {config.lights.map((l) => (
              <LightSlider key={l.entityId} entityId={l.entityId} name={l.name} interactive={!l.readonly} />
            ))}
          </div>
        </div>
      )}

      {config.climate.length > 0 && (
        <div css={sectionStyles}>
          <Separator title="Climate" />
          <div css={twoColumnGrid}>
            {config.climate.map((c) => (
              <ClimateSensor key={c.entityId} entityId={c.entityId} name={c.name} colorEntity={c.colorEntity} />
            ))}
          </div>
        </div>
      )}

      {config.occupancy.length > 0 && (
        <div css={sectionStyles}>
          <Separator title="Occupancy" />
          <div css={twoColumnGrid}>
            {config.occupancy.map((o) => (
              <OccupancySensor key={o.entityId} entityId={o.entityId} name={o.name} />
            ))}
          </div>
        </div>
      )}

      {(config.doors.length > 0 || config.windows.length > 0) && (
        <div css={sectionStyles}>
          <Separator title="Contact Sensors" />
          <div css={twoColumnGrid}>
            {config.doors.map((d) => (
              <DoorSensor key={d.entityId} entityId={d.entityId} name={d.name} />
            ))}
            {config.windows.map((w) => (
              <WindowSensor key={w.entityId} entityId={w.entityId} name={w.name} />
            ))}
          </div>
        </div>
      )}

      {config.vents.length > 0 && (
        <div css={sectionStyles}>
          <Separator title="Vents" />
          <div css={twoColumnGrid}>
            {config.vents.map((v) => (
              <VentButton key={v.entityId} entityId={v.entityId} name={v.name} />
            ))}
          </div>
        </div>
      )}

      {config.aqi.length > 0 && (
        <div css={sectionStyles}>
          <Separator title="Air Quality" />
          <div css={twoColumnGrid}>
            {config.aqi.map((a) => (
              <AqiCard key={a.entityId} entityId={a.entityId} name={a.name} pm25Entity={a.pm25Entity} />
            ))}
          </div>
        </div>
      )}
    </>
  );
}
