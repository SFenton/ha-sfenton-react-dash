import { css } from '@emotion/react';
import { ViewHeader, Separator, LightSlider, ClimateSensor, OccupancySensor, DoorSensor, WindowSensor, VentButton, AqiCard, ErrorBoundary } from '../components';
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
              <ErrorBoundary key={l.entityId}>
                <LightSlider entityId={l.entityId} name={l.name} interactive={!l.readonly} />
              </ErrorBoundary>
            ))}
          </div>
        </div>
      )}

      {config.climate.length > 0 && (
        <div css={sectionStyles}>
          <Separator title="Climate" />
          <div css={twoColumnGrid}>
            {config.climate.map((c) => (
              <ErrorBoundary key={c.entityId}>
                <ClimateSensor entityId={c.entityId} name={c.name} colorEntity={c.colorEntity} />
              </ErrorBoundary>
            ))}
          </div>
        </div>
      )}

      {config.occupancy.length > 0 && (
        <div css={sectionStyles}>
          <Separator title="Occupancy" />
          <div css={twoColumnGrid}>
            {config.occupancy.map((o) => (
              <ErrorBoundary key={o.entityId}>
                <OccupancySensor entityId={o.entityId} name={o.name} />
              </ErrorBoundary>
            ))}
          </div>
        </div>
      )}

      {(config.doors.length > 0 || config.windows.length > 0) && (
        <div css={sectionStyles}>
          <Separator title="Contact Sensors" />
          <div css={twoColumnGrid}>
            {config.doors.map((d) => (
              <ErrorBoundary key={d.entityId}>
                <DoorSensor entityId={d.entityId} name={d.name} />
              </ErrorBoundary>
            ))}
            {config.windows.map((w) => (
              <ErrorBoundary key={w.entityId}>
                <WindowSensor entityId={w.entityId} name={w.name} />
              </ErrorBoundary>
            ))}
          </div>
        </div>
      )}

      {config.vents.length > 0 && (
        <div css={sectionStyles}>
          <Separator title="Vents" />
          <div css={twoColumnGrid}>
            {config.vents.map((v) => (
              <ErrorBoundary key={v.entityId}>
                <VentButton entityId={v.entityId} name={v.name} />
              </ErrorBoundary>
            ))}
          </div>
        </div>
      )}

      {config.aqi.length > 0 && (
        <div css={sectionStyles}>
          <Separator title="Air Quality" />
          <div css={twoColumnGrid}>
            {config.aqi.map((a) => (
              <ErrorBoundary key={a.entityId}>
                <AqiCard entityId={a.entityId} name={a.name} pm25Entity={a.pm25Entity} />
              </ErrorBoundary>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
