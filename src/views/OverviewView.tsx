import { css } from '@emotion/react';
import { useHass } from '@hakit/core';
import { TimeCard, WeatherCard } from '@hakit/components';
import { ViewHeader } from '../components/ViewHeader';
import { PopupPanel } from '../components/PopupPanel';
import { useNavigation } from '../store';
import { AREA_ROUTES } from '../routes';

const chipBarStyles = css`
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 4px 0 12px;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }
`;

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

const areaCardStyles = css`
  padding: 20px 16px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(15px);
  -webkit-backdrop-filter: blur(15px);
  border: 1px solid rgba(255, 255, 255, 0.06);
  cursor: pointer;
  transition: background 0.2s, transform 0.15s;
  color: white;

  &:hover {
    background: rgba(255, 255, 255, 0.12);
    transform: scale(1.02);
  }
`;

const areaNameStyles = css`
  font-size: 14px;
  font-weight: 600;
`;

const weatherRowStyles = css`
  margin-bottom: 16px;
`;

const popupTitleStyles = css`
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 16px;
  color: white;
`;

const OVERVIEW_CHIPS = [
  { label: 'Lights', hash: 'lights-overview' },
  { label: 'Security', hash: 'security-system' },
  { label: 'Climate', hash: 'climate-overview' },
  { label: 'Occupancy', hash: 'occupancy-overview' },
  { label: 'Contact Sensors', hash: 'contact-sensors-overview' },
  { label: 'Air Quality', hash: 'aqi-overview' },
];

const CAMERA_CHIPS = [
  { label: 'Front Door', hash: 'camera-front-door' },
  { label: 'Driveway', hash: 'camera-driveway' },
  { label: 'Upper Deck', hash: 'camera-upper-deck' },
  { label: 'Lower Deck', hash: 'camera-lower-deck' },
];

export function OverviewView() {
  const { openPopup, navigate } = useNavigation();
  const { getAllEntities } = useHass.getState().helpers;
  const entityCount = Object.keys(getAllEntities()).length;

  return (
    <>
      <ViewHeader title="Home" />

      <div css={weatherRowStyles}>
        <TimeCard />
      </div>

      {/* Chip bar — horizontal scroll */}
      <div css={chipBarStyles}>
        {OVERVIEW_CHIPS.map(({ label, hash }) => (
          <button key={hash} css={chipStyles} onClick={() => openPopup(hash)}>
            {label}
          </button>
        ))}
        {CAMERA_CHIPS.map(({ label, hash }) => (
          <button key={hash} css={chipStyles} onClick={() => openPopup(hash)}>
            📷 {label}
          </button>
        ))}
      </div>

      {/* Area grid */}
      <div css={areaGridStyles}>
        {AREA_ROUTES.map(({ route, label }) => (
          <div key={route} css={areaCardStyles} onClick={() => navigate(route)}>
            <span css={areaNameStyles}>{label}</span>
          </div>
        ))}
      </div>

      <p style={{ marginTop: 24, opacity: 0.4, fontSize: 12 }}>
        {entityCount} entities connected
      </p>

      {/* Popup panels */}
      <PopupPanel hash="lights-overview">
        <p css={popupTitleStyles}>House Lights</p>
        <p style={{ opacity: 0.5 }}>Light controls will be rendered here.</p>
      </PopupPanel>

      <PopupPanel hash="security-system">
        <p css={popupTitleStyles}>Security System</p>
        <p style={{ opacity: 0.5 }}>Alarm panel will be rendered here.</p>
      </PopupPanel>

      <PopupPanel hash="climate-overview">
        <p css={popupTitleStyles}>Climate Overview</p>
        <p style={{ opacity: 0.5 }}>Climate sensors grid will be rendered here.</p>
      </PopupPanel>

      <PopupPanel hash="occupancy-overview">
        <p css={popupTitleStyles}>Occupancy Overview</p>
        <p style={{ opacity: 0.5 }}>Occupancy sensors will be rendered here.</p>
      </PopupPanel>

      <PopupPanel hash="contact-sensors-overview">
        <p css={popupTitleStyles}>Contact Sensors</p>
        <p style={{ opacity: 0.5 }}>Door/window sensors will be rendered here.</p>
      </PopupPanel>

      <PopupPanel hash="aqi-overview">
        <p css={popupTitleStyles}>Air Quality</p>
        <p style={{ opacity: 0.5 }}>AQI readings will be rendered here.</p>
      </PopupPanel>

      {CAMERA_CHIPS.map(({ label, hash }) => (
        <PopupPanel key={hash} hash={hash}>
          <p css={popupTitleStyles}>{label} Camera</p>
          <p style={{ opacity: 0.5 }}>Camera stream will be rendered here.</p>
        </PopupPanel>
      ))}
    </>
  );
}
