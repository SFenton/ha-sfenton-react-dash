import { css } from '@emotion/react';
import { ViewHeader, ErrorBoundary, SwipeRow, PopupPanel } from '../components';
import { LightPopupContent } from '../components/LightPopupContent';
import { ClimatePopupContent } from '../components/ClimatePopupContent';
import { OccupancyPopupContent } from '../components/OccupancyPopupContent';
import { ContactPopupContent } from '../components/ContactPopupContent';
import { VentPopupContent } from '../components/VentPopupContent';
import { AqiPopupContent } from '../components/AqiPopupContent';
import { useNavigation } from '../store';
import type { AreaRoute } from '../routes';
import { AREA_ROUTES } from '../routes';
import { AREA_ENTITIES } from '../areaEntities';

const chipStyles = css`
  flex-shrink: 0;
  padding: 8px 16px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(15px);
  -webkit-backdrop-filter: blur(15px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: white;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.2s;
  white-space: nowrap;

  &:hover {
    background: rgba(255, 255, 255, 0.2);
  }
`;

interface AreaDetailViewProps {
  area: AreaRoute;
}

export function AreaDetailView({ area }: AreaDetailViewProps) {
  const areaInfo = AREA_ROUTES.find((a) => a.route === area);
  const title = areaInfo?.label ?? area;
  const config = AREA_ENTITIES[area];
  const { openPopup } = useNavigation();

  // Build chip list based on what this room actually has
  const chips: { label: string; hash: string }[] = [];
  if (config.lights.length > 0) chips.push({ label: '💡 Lights', hash: `${area}-lights` });
  if (config.climate.length > 0) chips.push({ label: '🌡 Climate', hash: `${area}-climate` });
  if (config.occupancy.length > 0) chips.push({ label: '👤 Occupancy', hash: `${area}-occupancy` });
  if (config.doors.length > 0 || config.windows.length > 0) chips.push({ label: '🚪 Contacts', hash: `${area}-contacts` });
  if (config.vents.length > 0) chips.push({ label: '🌀 Vents', hash: `${area}-vents` });
  if (config.aqi.length > 0) chips.push({ label: '🌬 Air Quality', hash: `${area}-aqi` });

  return (
    <>
      <ViewHeader title={title} showBack />

      {/* Chip bar for room-specific popups */}
      {chips.length > 0 && (
        <SwipeRow>
          {chips.map(({ label, hash }) => (
            <button key={hash} css={chipStyles} onClick={() => openPopup(hash)}>
              {label}
            </button>
          ))}
        </SwipeRow>
      )}

      {/* ===== Room-specific Popup Panels ===== */}

      {config.lights.length > 0 && (
        <PopupPanel hash={`${area}-lights`}>
          <LightPopupContent
            title={`${title} Lights`}
            sections={[{
              title,
              toggleEntity: config.groupLight,
              lights: config.lights.map((l) => ({ entityId: l.entityId, name: l.name })),
            }]}
          />
        </PopupPanel>
      )}

      {config.climate.length > 0 && (
        <PopupPanel hash={`${area}-climate`}>
          <ClimatePopupContent
            title={`${title} Climate`}
            sensors={config.climate}
          />
        </PopupPanel>
      )}

      {config.occupancy.length > 0 && (
        <PopupPanel hash={`${area}-occupancy`}>
          <OccupancyPopupContent
            title={`${title} Occupancy`}
            sensors={config.occupancy}
          />
        </PopupPanel>
      )}

      {(config.doors.length > 0 || config.windows.length > 0) && (
        <PopupPanel hash={`${area}-contacts`}>
          <ContactPopupContent
            title={`${title} Contact Sensors`}
            doors={config.doors}
            windows={config.windows}
          />
        </PopupPanel>
      )}

      {config.vents.length > 0 && (
        <PopupPanel hash={`${area}-vents`}>
          <VentPopupContent
            title={`${title} Vents`}
            vents={config.vents}
          />
        </PopupPanel>
      )}

      {config.aqi.length > 0 && (
        <PopupPanel hash={`${area}-aqi`}>
          <AqiPopupContent
            title={`${title} Air Quality`}
            sensors={config.aqi}
          />
        </PopupPanel>
      )}
    </>
  );
}
