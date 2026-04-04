import { css } from '@emotion/react';
import { ClimateCard } from '@hakit/components';
import { ViewHeader, Separator, ClimateSensor, EcobeeRoom, VentButton } from '../components';
import { twoColumnGrid } from '../styles';

const sectionStyles = css`
  margin-bottom: 24px;
`;

const thermostatStyles = css`
  border-radius: 16px;
  overflow: hidden;
  margin-bottom: 24px;
`;

const roomGridStyles = css`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 8px;
`;

const ECOBEE_ROOMS = [
  { entityId: 'sensor.living_room_temperature', name: 'Living Room', colorEntity: 'input_text.living_room_ecobee_climate_color' },
  { entityId: 'sensor.bedroom_temperature', name: 'Master Bedroom', colorEntity: 'input_text.master_bedroom_ecobee_climate_color' },
  { entityId: 'sensor.guest_room_temperature', name: 'Guest Room', colorEntity: 'input_text.guest_room_ecobee_climate_color' },
  { entityId: 'sensor.office_temperature', name: 'Office', colorEntity: 'input_text.office_ecobee_climate_color' },
  { entityId: 'sensor.kitchen_temperature', name: 'Kitchen', colorEntity: 'input_text.kitchen_ecobee_climate_color' },
  { entityId: 'sensor.gym_temperature', name: 'Gym', colorEntity: 'input_text.gym_ecobee_climate_color' },
  { entityId: 'sensor.music_room_temperature', name: 'Music Room', colorEntity: 'input_text.music_room_ecobee_climate_color' },
  { entityId: 'sensor.theater_room_temperature', name: 'Theater Room', colorEntity: 'input_text.theater_room_ecobee_climate_color' },
  { entityId: 'sensor.dining_room_temperature', name: 'Dining Room', colorEntity: 'input_text.dining_room_ecobee_climate_color' },
  { entityId: 'sensor.guest_bathroom_temperature', name: 'Guest Bathroom', colorEntity: 'input_text.guest_bathroom_ecobee_climate_color' },
  { entityId: 'sensor.master_bathroom_temperature', name: 'Master Bathroom', colorEntity: 'input_text.master_bathroom_ecobee_climate_color' },
  { entityId: 'sensor.home_current_temperature', name: 'Hallway', colorEntity: 'input_text.hallway_ecobee_climate_color' },
];

const VENTS = [
  { entityId: 'cover.living_room_vents', name: 'Living Room' },
  { entityId: 'cover.master_bedroom_vents', name: 'Master Bedroom' },
  { entityId: 'cover.guest_room_vent_vent', name: 'Guest Room' },
  { entityId: 'cover.office_vent_vent', name: 'Office' },
  { entityId: 'cover.kitchen_vent_vent', name: 'Kitchen' },
  { entityId: 'cover.gym_vent_vent', name: 'Gym' },
  { entityId: 'cover.music_room_vent_vent', name: 'Music Room' },
  { entityId: 'cover.theater_room_vents', name: 'Theater Room' },
  { entityId: 'cover.dining_room_vent_vent', name: 'Dining Room' },
  { entityId: 'cover.guest_bathroom_vent_vent', name: 'Guest Bathroom' },
  { entityId: 'cover.master_bathroom_vent_vent', name: 'Master Bathroom' },
];

export function EcobeeView() {
  return (
    <>
      <ViewHeader title="Ecobee" />

      <div css={thermostatStyles}>
        <ClimateCard entity={'climate.home' as `climate.${string}`} />
      </div>

      <div css={sectionStyles}>
        <Separator title="Room Temperatures" />
        <div css={twoColumnGrid}>
          {ECOBEE_ROOMS.map((r) => (
            <ClimateSensor key={r.entityId} entityId={r.entityId} name={r.name} colorEntity={r.colorEntity} />
          ))}
        </div>
      </div>

      <div css={sectionStyles}>
        <Separator title="Smart Vents" />
        <div css={twoColumnGrid}>
          {VENTS.map((v) => (
            <VentButton key={v.entityId} entityId={v.entityId} name={v.name} />
          ))}
        </div>
      </div>
    </>
  );
}
