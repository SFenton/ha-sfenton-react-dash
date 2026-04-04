import { css } from '@emotion/react';
import { useHass } from '@hakit/core';
import { TimeCard } from '@hakit/components';
import { ViewHeader, PopupPanel, AreaNavCard, SwipeRow } from '../components';
import { LightPopupContent } from '../components/LightPopupContent';
import { ClimatePopupContent } from '../components/ClimatePopupContent';
import { OccupancyPopupContent } from '../components/OccupancyPopupContent';
import { ContactPopupContent } from '../components/ContactPopupContent';
import { AqiPopupContent } from '../components/AqiPopupContent';
import { CameraPopupContent } from '../components/CameraPopupContent';
import { useNavigation } from '../store';
import { AREA_ROUTES } from '../routes';

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
  { label: '?? Lights', hash: 'lights-overview' },
  { label: '?? Security', hash: 'security-system' },
  { label: '?? Climate', hash: 'climate-overview' },
  { label: '?? Occupancy', hash: 'occupancy-overview' },
  { label: '?? Contact Sensors', hash: 'contact-sensors-overview' },
  { label: '?? Air Quality', hash: 'aqi-overview' },
  { label: '?? Front Door', hash: 'camera-front-door' },
  { label: '?? Driveway', hash: 'camera-driveway' },
  { label: '?? Upper Deck', hash: 'camera-upper-deck' },
  { label: '?? Lower Deck', hash: 'camera-lower-deck' },
];

export function OverviewView() {
  const { openPopup } = useNavigation();
  const { getAllEntities } = useHass.getState().helpers;
  const entityCount = Object.keys(getAllEntities()).length;

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
        <LightPopupContent
          title="House Lights"
          sections={[
            {
              title: 'Living Room',
              toggleEntity: 'light.living_room',
              lights: [
                { entityId: 'light.living_room_front_left_light', name: 'Front Left' },
                { entityId: 'light.living_room_front_right_light', name: 'Front Right' },
                { entityId: 'light.living_room_back_left_light', name: 'Back Left' },
                { entityId: 'light.living_room_back_right_light', name: 'Back Right' },
              ],
            },
            {
              title: 'Master Bedroom',
              toggleEntity: 'light.master_bedroom',
              lights: [
                { entityId: 'light.master_bedroom_window_light', name: 'Window Light' },
                { entityId: 'light.master_bedroom_bathroom_light', name: 'Bathroom Light' },
                { entityId: 'light.master_bedroom_door_light', name: 'Door Light' },
                { entityId: 'light.stephen_nightstand_light', name: 'Stephen Nightstand' },
                { entityId: 'light.steph_nightstand_light', name: 'Steph Nightstand' },
                { entityId: 'light.master_bedroom_closet_light', name: 'Closet Light' },
              ],
            },
            {
              title: 'Guest Room',
              toggleEntity: 'light.guest_room',
              lights: [
                { entityId: 'light.guest_room_tv_light', name: 'TV Light' },
                { entityId: 'light.guest_room_bed_light', name: 'Bed Light' },
              ],
            },
            {
              title: 'Kitchen',
              toggleEntity: 'light.kitchen',
              lights: [
                { entityId: 'light.kitchen_main_light', name: 'Main Light' },
                { entityId: 'light.kitchen_island_light', name: 'Island Light' },
              ],
            },
            {
              title: 'Office',
              lights: [
                { entityId: 'light.office_light', name: 'Office Light' },
              ],
            },
            {
              title: 'Gym',
              lights: [
                { entityId: 'light.gym_light', name: 'Gym Light' },
              ],
            },
            {
              title: 'Hallway',
              toggleEntity: 'light.hallway',
              lights: [
                { entityId: 'light.hallway_entry_light', name: 'Entry Light' },
                { entityId: 'light.hallway_gym_light', name: 'Gym Light' },
                { entityId: 'light.hallway_guest_room_light', name: 'Guest Room Light' },
                { entityId: 'light.hallway_office_light', name: 'Office Light' },
              ],
            },
          ]}
        />
      </PopupPanel>

      <PopupPanel hash="security-system">
        <p style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Security System</p>
        <p style={{ opacity: 0.5 }}>Alarm panel + lock controls — wired in Phase 6.</p>
      </PopupPanel>

      <PopupPanel hash="climate-overview">
        <ClimatePopupContent
          title="Climate Overview"
          sensors={[
            { entityId: 'sensor.living_room_temperature', name: 'Living Room' },
            { entityId: 'sensor.master_bedroom_temperature', name: 'Master Bedroom' },
            { entityId: 'sensor.guest_room_temperature', name: 'Guest Room' },
            { entityId: 'sensor.office_temperature', name: 'Office' },
            { entityId: 'sensor.kitchen_temperature', name: 'Kitchen' },
            { entityId: 'sensor.gym_temperature', name: 'Gym' },
          ]}
        />
      </PopupPanel>

      <PopupPanel hash="occupancy-overview">
        <OccupancyPopupContent
          title="Occupancy Overview"
          sensors={[
            { entityId: 'binary_sensor.living_room_occupancy', name: 'Living Room' },
            { entityId: 'binary_sensor.master_bedroom_occupancy', name: 'Master Bedroom' },
            { entityId: 'binary_sensor.guest_room_occupancy', name: 'Guest Room' },
            { entityId: 'binary_sensor.office_occupancy', name: 'Office' },
            { entityId: 'binary_sensor.kitchen_occupancy', name: 'Kitchen' },
            { entityId: 'binary_sensor.gym_occupancy', name: 'Gym' },
            { entityId: 'binary_sensor.hallway_occupancy', name: 'Hallway' },
          ]}
        />
      </PopupPanel>

      <PopupPanel hash="contact-sensors-overview">
        <ContactPopupContent
          title="Contact Sensors"
          doors={[
            { entityId: 'binary_sensor.front_door_contact', name: 'Front Door' },
            { entityId: 'binary_sensor.back_door_contact', name: 'Back Door' },
            { entityId: 'binary_sensor.garage_door_contact', name: 'Garage Door' },
          ]}
          windows={[
            { entityId: 'binary_sensor.living_room_window_contact', name: 'Living Room' },
            { entityId: 'binary_sensor.master_bedroom_window_contact', name: 'Master Bedroom' },
            { entityId: 'binary_sensor.guest_room_window_contact', name: 'Guest Room' },
            { entityId: 'binary_sensor.office_window_contact', name: 'Office' },
          ]}
        />
      </PopupPanel>

      <PopupPanel hash="aqi-overview">
        <AqiPopupContent
          title="Air Quality"
          sensors={[
            { entityId: 'sensor.living_room_air_quality', name: 'Living Room' },
            { entityId: 'sensor.master_bedroom_air_quality', name: 'Master Bedroom' },
            { entityId: 'sensor.office_air_quality', name: 'Office' },
          ]}
        />
      </PopupPanel>

      <PopupPanel hash="camera-front-door">
        <CameraPopupContent title="Front Door Camera" entityId="camera.front_door" />
      </PopupPanel>

      <PopupPanel hash="camera-driveway">
        <CameraPopupContent title="Driveway Camera" entityId="camera.driveway" />
      </PopupPanel>

      <PopupPanel hash="camera-upper-deck">
        <CameraPopupContent title="Upper Deck Camera" entityId="camera.upper_deck" />
      </PopupPanel>

      <PopupPanel hash="camera-lower-deck">
        <CameraPopupContent title="Lower Deck Camera" entityId="camera.lower_deck" />
      </PopupPanel>
    </>
  );
}
