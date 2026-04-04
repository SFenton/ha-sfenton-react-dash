import { css } from '@emotion/react';
import { useHass } from '@hakit/core';
import { TimeCard } from '@hakit/components';
import { ViewHeader, PopupPanel, AreaNavCard, SwipeRow } from '../components';
import { LightPopupContent } from '../components/LightPopupContent';
import { ClimatePopupContent } from '../components/ClimatePopupContent';
import { OccupancyPopupContent } from '../components/OccupancyPopupContent';
import { ContactPopupContent } from '../components/ContactPopupContent';
import { AqiPopupContent } from '../components/AqiPopupContent';
import { useNavigation } from '../store';
import { AREA_ROUTES } from '../routes';
import { AREA_ENTITIES } from '../areaEntities';
import type { AreaRoute } from '../routes';

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

const areaGridStyles = css`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 12px;
  margin-top: 16px;
`;

const weatherRowStyles = css`
  margin-bottom: 16px;
`;

const OVERVIEW_CHIPS = [
  { label: '💡 Lights', hash: 'lights-overview' },
  { label: '🛡 Security', hash: 'security-system' },
  { label: '🌡 Climate', hash: 'climate-overview' },
  { label: '👤 Occupancy', hash: 'occupancy-overview' },
  { label: '🚪 Contact Sensors', hash: 'contact-sensors-overview' },
  { label: '🌬 Air Quality', hash: 'aqi-overview' },
];

/** Build popup data from real AREA_ENTITIES */
function buildLightSections() {
  return (Object.entries(AREA_ENTITIES) as [AreaRoute, typeof AREA_ENTITIES[AreaRoute]][])
    .filter(([, config]) => config.lights.length > 0)
    .map(([area, config]) => {
      const label = AREA_ROUTES.find((a) => a.route === area)?.label ?? area;
      return {
        title: label,
        toggleEntity: config.groupLight,
        lights: config.lights.map((l) => ({ entityId: l.entityId, name: l.name })),
      };
    });
}

function buildClimateSensors() {
  const sensors: { entityId: string; name: string; colorEntity?: string }[] = [];
  for (const [area, config] of Object.entries(AREA_ENTITIES) as [AreaRoute, typeof AREA_ENTITIES[AreaRoute]][]) {
    const label = AREA_ROUTES.find((a) => a.route === area)?.label ?? area;
    // Pick the first ecobee sensor if available, otherwise first sensor
    const ecobee = config.climate.find((c) => c.name === 'Ecobee');
    const primary = ecobee ?? config.climate[0];
    if (primary) {
      sensors.push({ entityId: primary.entityId, name: label, colorEntity: primary.colorEntity });
    }
  }
  return sensors;
}

function buildOccupancySensors() {
  const sensors: { entityId: string; name: string }[] = [];
  for (const [area, config] of Object.entries(AREA_ENTITIES) as [AreaRoute, typeof AREA_ENTITIES[AreaRoute]][]) {
    const label = AREA_ROUTES.find((a) => a.route === area)?.label ?? area;
    if (config.occupancy.length > 0) {
      sensors.push({ entityId: config.occupancy[0].entityId, name: label });
    }
  }
  return sensors;
}

function buildContactSensors() {
  const doors: { entityId: string; name: string }[] = [];
  const windows: { entityId: string; name: string }[] = [];
  for (const [, config] of Object.entries(AREA_ENTITIES)) {
    for (const d of config.doors) doors.push(d);
    for (const w of config.windows) windows.push(w);
  }
  return { doors, windows };
}

function buildAqiSensors() {
  const sensors: { entityId: string; name: string; pm25Entity?: string }[] = [];
  for (const [, config] of Object.entries(AREA_ENTITIES)) {
    for (const a of config.aqi) sensors.push(a);
  }
  return sensors;
}

export function OverviewView() {
  const { openPopup } = useNavigation();
  const { getAllEntities } = useHass.getState().helpers;
  const entityCount = Object.keys(getAllEntities()).length;

  const lightSections = buildLightSections();
  const climateSensors = buildClimateSensors();
  const occupancySensors = buildOccupancySensors();
  const { doors, windows } = buildContactSensors();
  const aqiSensors = buildAqiSensors();

  return (
    <>
      <ViewHeader title="Home" />

      <div css={weatherRowStyles}>
        <TimeCard />
      </div>

      {/* Chip bar */}
      <SwipeRow>
        {OVERVIEW_CHIPS.map(({ label, hash }) => (
          <button key={hash} css={chipStyles} onClick={() => openPopup(hash)}>
            {label}
          </button>
        ))}
      </SwipeRow>

      {/* Area grid */}
      <div css={areaGridStyles}>
        {AREA_ROUTES.map(({ route, label }) => (
          <AreaNavCard key={route} area={route} label={label} />
        ))}
      </div>

      <p style={{ marginTop: 24, opacity: 0.4, fontSize: 12 }}>
        {entityCount} entities connected
      </p>

      {/* ===== Popup Panels ===== */}

      <PopupPanel hash="lights-overview">
        <LightPopupContent title="House Lights" sections={lightSections} />
      </PopupPanel>

      <PopupPanel hash="security-system">
        <p style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Security System</p>
        <p style={{ opacity: 0.5 }}>Use the Security tab for full alarm controls.</p>
      </PopupPanel>

      <PopupPanel hash="climate-overview">
        <ClimatePopupContent title="Climate Overview" sensors={climateSensors} />
      </PopupPanel>

      <PopupPanel hash="occupancy-overview">
        <OccupancyPopupContent title="Occupancy Overview" sensors={occupancySensors} />
      </PopupPanel>

      <PopupPanel hash="contact-sensors-overview">
        <ContactPopupContent title="Contact Sensors" doors={doors} windows={windows} />
      </PopupPanel>

      <PopupPanel hash="aqi-overview">
        <AqiPopupContent title="Air Quality" sensors={aqiSensors} />
      </PopupPanel>
    </>
  );
}
