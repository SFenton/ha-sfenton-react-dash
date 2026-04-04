import { css } from '@emotion/react';
import { useEntity, useService, useHass } from '@hakit/core';
import { ViewHeader, Separator, EntityToggle, ErrorBoundary, PopupPanel, TodoListCard } from '../components';
import { useNavigation } from '../store';
import { frostedGlass, frostedGlassHover } from '../styles';

const sectionStyles = css`
  margin-bottom: 24px;
`;

const btnGridStyles = css`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 8px;
`;

const btnStyles = css`
  ${frostedGlass};
  ${frostedGlassHover};
  padding: 14px 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 10px;
  transition: background 0.2s, transform 0.15s;
  &:active { transform: scale(0.97); }
`;

const btnIconStyles = css`font-size: 18px;`;
const btnLabelStyles = css`font-size: 13px; font-weight: 500;`;
const infoStyles = css`
  ${frostedGlass};
  padding: 14px 16px;
  margin-bottom: 8px;
  font-size: 13px;
  opacity: 0.6;
`;

const descStyles = css`
  ${frostedGlass};
  padding: 14px 16px;
  margin-bottom: 12px;
  font-size: 13px;
  opacity: 0.7;
  line-height: 1.5;
`;

const toggleGridStyles = css`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 8px;
`;

const PRESENCE_SWITCHES = [
  { entity: 'switch.living_room_presence_living_room_lights_presence_allowed', name: 'Living Room' },
  { entity: 'switch.kitchen_presence_kitchen_lights_presence_allowed', name: 'Kitchen' },
  { entity: 'switch.hallway_presence_hallway_lights_presence_allowed', name: 'Hallway' },
  { entity: 'switch.gym_presence_gym_light_presence_allowed', name: 'Gym' },
  { entity: 'switch.guest_bathroom_presence_guest_bathroom_dimmer_switch_presence_allowed', name: 'Guest Bathroom' },
  { entity: 'switch.guest_room_presence_guest_room_presence_allowed', name: 'Guest Room' },
  { entity: 'switch.office_presence_office_light_presence_allowed', name: 'Office' },
  { entity: 'switch.master_bedroom_presence_master_bedroom_presence_allowed', name: 'Master Bedroom' },
  { entity: 'switch.master_bathroom_presence_master_bathroom_dimmer_switch_presence_allowed', name: 'Master Bathroom' },
  { entity: 'switch.dining_room_presence_dining_room_dimmer_switch_presence_allowed', name: 'Dining Room' },
  { entity: 'switch.theater_room_presence_theater_room_presence_allowed', name: 'Theater Room' },
  { entity: 'switch.downstairs_hallway_presence_downstairs_hallway_light_presence_allowed', name: 'Downstairs Hallway' },
  { entity: 'switch.music_room_presence_music_room_lights_presence_allowed', name: 'Music Room' },
  { entity: 'switch.upper_deck_presence_back_deck_lights_presence_allowed', name: 'Upper Deck' },
];

const AUTO_REENABLE_SWITCHES = [
  { entity: 'switch.living_room_auto_re_enable_presence_lighting', name: 'Living Room' },
  { entity: 'switch.kitchen_auto_re_enable_presence_lighting', name: 'Kitchen' },
  { entity: 'switch.hallway_auto_re_enable_presence_lighting', name: 'Hallway' },
  { entity: 'switch.gym_auto_re_enable_presence_lighting', name: 'Gym' },
  { entity: 'switch.guest_bathroom_auto_re_enable_presence_lighting', name: 'Guest Bathroom' },
  { entity: 'switch.guest_room_auto_re_enable_presence_lighting', name: 'Guest Room' },
  { entity: 'switch.office_auto_re_enable_presence_lighting', name: 'Office' },
  { entity: 'switch.master_bedroom_auto_re_enable_presence_lighting', name: 'Master Bedroom' },
  { entity: 'switch.master_bathroom_auto_re_enable_presence_lighting', name: 'Master Bathroom' },
  { entity: 'switch.dining_room_auto_re_enable_presence_lighting', name: 'Dining Room' },
  { entity: 'switch.theater_room_auto_re_enable_presence_lighting', name: 'Theater Room' },
  { entity: 'switch.downstairs_hallway_auto_re_enable_presence_lighting', name: 'Downstairs Hallway' },
  { entity: 'switch.music_room_auto_re_enable_presence_lighting', name: 'Music Room' },
  { entity: 'switch.upper_deck_auto_re_enable_presence_lighting', name: 'Upper Deck' },
];

// ============================================================
// Admin
// ============================================================
export function AdminView() {
  const { openPopup } = useNavigation();

  return (
    <>
      <ViewHeader title="Admin" showBack />

      <div css={sectionStyles}>
        <Separator title="Security Controls" />
        <div css={descStyles}>
          Disables automatic locking of the front door. Useful for when contractors
          are over, or we have people frequently entering/leaving the home.
        </div>
        <ErrorBoundary>
          <EntityToggle entityId="input_boolean.front_door_auto_lock" name="Front Door Auto-Lock" />
        </ErrorBoundary>
      </div>

      <div css={sectionStyles}>
        <Separator title="Presence-Based Light Overrides" />
        <div css={descStyles}>
          Enable or disable presence-based lighting in specific rooms. Useful for
          when we have company, or need to quickly keep lights on or off without
          using the voice commands.
        </div>
        <div css={btnGridStyles}>
          <div css={btnStyles} onClick={() => openPopup('presence-based-overrides')}>
            <span css={btnIconStyles}>💡</span>
            <span css={btnLabelStyles}>Open Overrides</span>
          </div>
        </div>
      </div>

      <div css={sectionStyles}>
        <Separator title="Show Specific Controls" />
        <div css={descStyles}>
          Shows the outdoor faucets in our Home Assistant pages. Useful to disable
          during the winter, when we aren't using them.
        </div>
        <div css={btnGridStyles}>
          <ErrorBoundary>
            <EntityToggle entityId="input_boolean.show_outdoor_faucets" name="Outdoor Faucets" />
          </ErrorBoundary>
          <ErrorBoundary>
            <EntityToggle entityId="input_boolean.show_christmas_lights" name="Christmas Lights" />
          </ErrorBoundary>
        </div>
      </div>

      <div css={sectionStyles}>
        <Separator title="Automatic Presence Setting Overrides" />
        <div css={descStyles}>
          Sometimes, we disable automatic presence-based lighting in rooms that we'd
          otherwise want to wake up and have that presence-based lighting active.
        </div>
        <div css={descStyles}>
          If a toggle here is enabled, it means that in the morning, before we usually
          wake up, if the room has been cleared for a sufficient amount of time during
          the night, we'll re-enable presence-based lighting in that room.
        </div>
        <div css={btnGridStyles}>
          <div css={btnStyles} onClick={() => openPopup('presence-based-overrides-auto')}>
            <span css={btnIconStyles}>🔄</span>
            <span css={btnLabelStyles}>Auto-Reset Config</span>
          </div>
        </div>
      </div>

      {/* Presence Override Popup — 14 room toggles */}
      <PopupPanel hash="presence-based-overrides">
        <p style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Presence-Based Overrides</p>
        <div css={toggleGridStyles}>
          {PRESENCE_SWITCHES.map((s) => (
            <ErrorBoundary key={s.entity}>
              <EntityToggle entityId={s.entity} name={s.name} />
            </ErrorBoundary>
          ))}
        </div>
      </PopupPanel>

      {/* Auto Re-enable Popup — 14 room toggles */}
      <PopupPanel hash="presence-based-overrides-auto">
        <p style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Presence-Based Overrides Auto-Reset</p>
        <div css={toggleGridStyles}>
          {AUTO_REENABLE_SWITCHES.map((s) => (
            <ErrorBoundary key={s.entity}>
              <EntityToggle entityId={s.entity} name={s.name} />
            </ErrorBoundary>
          ))}
        </div>
      </PopupPanel>
    </>
  );
}

// ============================================================
// Guests Staying Over
// ============================================================
export function GuestsView() {
  const { callService } = useService();

  return (
    <>
      <ViewHeader title="Guests Staying Over" showBack />

      <div css={sectionStyles}>
        <Separator title="Guest Controls" />
        <div css={infoStyles}>Enable guest mode for specific rooms.</div>
        <div css={btnGridStyles}>
          {['Guest Room', 'Music Room', 'Theater Room'].map((room) => (
            <div key={room} css={btnStyles}>
              <span css={btnIconStyles}>🏠</span>
              <span css={btnLabelStyles}>{room}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ============================================================
// To-Do (single todo list)
// ============================================================
export function TodoView() {
  return (
    <>
      <ViewHeader title="To-Do" showBack />
      <TodoListCard entityId="todo.groceries" title="Grocery List" />
    </>
  );
}

// ============================================================
// Groceries
// ============================================================
export function GroceriesView() {
  return (
    <>
      <ViewHeader title="Groceries" showBack />
      <Separator title="Grocery List" />
      <TodoListCard entityId="todo.shopping_list" title="Shopping List" />
    </>
  );
}

// ============================================================
// Stephen's Chores
// ============================================================
export function StephensChoresView() {
  return (
    <>
      <ViewHeader title="Stephen's Tasks" showBack />
      <TodoListCard entityId="todo.stephen_s_past_due" title="Past Due" />
      <TodoListCard entityId="todo.stephen_s_due_today" title="Due Today" />
      <TodoListCard entityId="todo.stephen_s_upcoming" title="Upcoming" />
      <TodoListCard entityId="todo.stephen_s_no_due_date" title="No Due Date" />
    </>
  );
}

// ============================================================
// Steph's Chores
// ============================================================
export function StephsChoresView() {
  return (
    <>
      <ViewHeader title="Steph's Tasks" showBack />
      <TodoListCard entityId="todo.steph_s_past_due" title="Past Due" />
      <TodoListCard entityId="todo.steph_s_due_today" title="Due Today" />
      <TodoListCard entityId="todo.steph_s_upcoming" title="Upcoming" />
      <TodoListCard entityId="todo.steph_s_no_due_date" title="No Due Date" />
    </>
  );
}

// ============================================================
// Unassigned Chores
// ============================================================
export function UnassignedChoresView() {
  return (
    <>
      <ViewHeader title="Unassigned Tasks" showBack />
      <TodoListCard entityId="todo.unassigned_past_due" title="Past Due" />
      <TodoListCard entityId="todo.unassigned_due_today" title="Due Today" />
      <TodoListCard entityId="todo.unassigned_upcoming" title="Upcoming" />
      <TodoListCard entityId="todo.unassigned_no_due_date" title="No Due Date" />
    </>
  );
}

// ============================================================
// Home Improvement Chores
// ============================================================
export function HomeImprovementChoresView() {
  return (
    <>
      <ViewHeader title="Home Improvement Tasks" showBack />
      <TodoListCard entityId="todo.home_improvement_s_past_due" title="Past Due" />
      <TodoListCard entityId="todo.home_improvement_s_due_today" title="Due Today" />
      <TodoListCard entityId="todo.home_improvement_s_upcoming" title="Upcoming" />
      <TodoListCard entityId="todo.home_improvement_s_no_due_date" title="No Due Date" />
    </>
  );
}

// ============================================================
// Mach-E
// ============================================================
export function MachEView() {
  return (
    <>
      <ViewHeader title="Mach-E" showBack />

      <div css={sectionStyles}>
        <ErrorBoundary>
          <EntityToggle entityId="binary_sensor.mach_e_charge_status" name="Charge Status" />
        </ErrorBoundary>
      </div>

      <div css={sectionStyles}>
        <Separator title="Car Controls" />
        <div css={btnGridStyles}>
          {[
            { label: 'Doors', icon: '🚪' },
            { label: "Driver's Seat", icon: '💺' },
            { label: "Passenger Seat", icon: '💺' },
            { label: 'Climate', icon: '🌡' },
          ].map((item) => (
            <div key={item.label} css={btnStyles}>
              <span css={btnIconStyles}>{item.icon}</span>
              <span css={btnLabelStyles}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ============================================================
// Vacuums
// ============================================================
export function VacuumsView() {
  const { openPopup } = useNavigation();

  return (
    <>
      <ViewHeader title="Robot Vacuums" showBack />

      <div css={sectionStyles}>
        <Separator title="Robot Vacuums" />
        <div css={btnGridStyles}>
          {[
            { label: 'Main Floor', hash: 'main-floor-robot-vacuum' },
            { label: 'Music Room', hash: 'music-room-robot-vacuum' },
            { label: 'Theater Room', hash: 'theater-room-robot-vacuum' },
          ].map((v) => (
            <div key={v.hash} css={btnStyles} onClick={() => openPopup(v.hash)}>
              <span css={btnIconStyles}>🤖</span>
              <span css={btnLabelStyles}>{v.label}</span>
            </div>
          ))}
        </div>
      </div>

      {['main-floor-robot-vacuum', 'music-room-robot-vacuum', 'theater-room-robot-vacuum'].map((hash) => (
        <PopupPanel key={hash} hash={hash}>
          <p style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>
            {hash.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
          </p>
          <p style={{ opacity: 0.5, fontSize: 13 }}>
            Vacuum map and zone controls — requires valetudo-map-card integration.
          </p>
        </PopupPanel>
      ))}
    </>
  );
}

// ============================================================
// Media
// ============================================================
export function MediaView() {
  const { openPopup } = useNavigation();

  return (
    <>
      <ViewHeader title="Media" showBack />

      <div css={sectionStyles}>
        <Separator title="Living Room" />
        <div css={btnGridStyles}>
          <div css={btnStyles} onClick={() => openPopup('living-room-shield')}>
            <span css={btnIconStyles}>🎮</span>
            <span css={btnLabelStyles}>SHIELD</span>
          </div>
        </div>
      </div>

      <div css={sectionStyles}>
        <Separator title="Theater Room" />
        <div css={btnGridStyles}>
          <div css={btnStyles} onClick={() => openPopup('theater-room-shield')}>
            <span css={btnIconStyles}>🎮</span>
            <span css={btnLabelStyles}>SHIELD</span>
          </div>
          <div css={btnStyles} onClick={() => openPopup('theater-room-switch')}>
            <span css={btnIconStyles}>🕹</span>
            <span css={btnLabelStyles}>Nintendo Switch</span>
          </div>
        </div>
      </div>

      {['living-room-shield', 'theater-room-shield', 'theater-room-switch'].map((hash) => (
        <PopupPanel key={hash} hash={hash}>
          <p style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>
            {hash.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
          </p>
          <p style={{ opacity: 0.5, fontSize: 13 }}>Remote controls + volume — requires media player entities.</p>
        </PopupPanel>
      ))}
    </>
  );
}

// ============================================================
// Custom Lights
// ============================================================
export function CustomLightsView() {
  return (
    <>
      <ViewHeader title="Custom Lights" showBack />

      <div css={sectionStyles}>
        <Separator title="Front Yard" />
        <ErrorBoundary>
          <EntityToggle entityId="input_boolean.manually_control_front_yard_lights" name="Manual Front Yard Control" />
        </ErrorBoundary>
        <div css={infoStyles}>Bollard light controls will be rendered here when manual mode is enabled.</div>
      </div>
    </>
  );
}
