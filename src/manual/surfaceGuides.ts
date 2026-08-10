import { ROOM_PAGE_CONFIGS } from '../constants/roomPages'
import type {
  ManualArticle,
  ManualSurfaceGuide,
  ManualSurfaceGuideArticle,
  ManualSurfaceGuideNavigationItem,
} from './types'

const ROOM_ROUTE_PATHS = Object.values(ROOM_PAGE_CONFIGS).map((room) => room.path)

function item(surfaceId: string, label: string, explanation: string): ManualSurfaceGuideNavigationItem {
  return { explanation, label, surfaceId }
}

export const MANUAL_SURFACE_GUIDE_PAYLOADS_BY_ARTICLE_ID: Readonly<Record<string, ManualSurfaceGuide>> = {
  'status-chips': {
    howToOpen: [
      'Open Home and swipe the horizontal status row when a chip is off-screen. Select Climate, Occupancy, Contact Sensors, or Air Quality to open that focused household overview.',
      'Contact Sensors can also be opened from the Security status row. The same canonical contact overview is used instead of creating a second source of truth.',
    ],
    contents: [
      'Climate groups room temperature ranges and current heating, cooling, idle, or unavailable state, then allows a room-level drilldown.',
      'Occupancy groups live room presence state and opens the contributing sensors for one room without changing them.',
      'Contact Sensors groups doors and windows, highlights open counts, and opens the exact contacts behind a room summary.',
      'Air Quality lists each configured room AQI and PM2.5 reading. It is a read-only comparison surface rather than a purifier power control.',
    ],
    navigation: {
      explanation: 'These overviews do not use tabs. Climate, Occupancy, and Contact Sensors replace the overview with a room detail in the same sheet; Back restores the group list and its scroll position. Air Quality remains a single overview.',
      tabs: [],
      detailPages: [
        item('home.climate-room-detail', 'Room climate detail', 'Shows the selected room climate sources and their reported temperature or action state, then returns to the household climate list with Back.'),
        item('home.occupancy-room-detail', 'Room occupancy detail', 'Shows the sensors contributing to one room occupancy summary; the rows report state and do not toggle occupancy.'),
        item('home.contact-room-detail', 'Room contact detail', 'Shows the exact doors or windows behind a room count so an open aggregate can be traced safely.'),
      ],
      wizardSteps: [],
    },
    closeBackCancelBehavior: 'Use Back only after opening a room detail; it returns to the overview inside the same sheet. The X, backdrop, swipe, or browser hash clear closes the sheet through the shared exit animation. Closing never changes a sensor, climate target, or purifier mode.',
    homeAssistantOwnership: 'Home Assistant owns every displayed sensor, climate, contact, and air-quality value. The app groups and formats those states, but opening or closing an overview sends no service call. Device or automation changes made elsewhere appear when Home Assistant publishes the new state.',
    stateAndDisabledBehavior: 'Active colors and counts describe persistent live state, not tap feedback. Unknown or unavailable sources are muted and must not be interpreted as clear, closed, comfortable, or safe. A room detail opener is disabled when its primary summary cannot be read reliably.',
    safetyAndLimitations: {
      title: 'A compact status is not a physical inspection',
      text: 'Open the room detail before acting on an unusual count or color. Contact and occupancy sensors can lag or fail, climate ranges do not prove comfort everywhere, and AQI or PM2.5 cannot identify every smoke, gas, or health hazard. Use dedicated alarms and inspect the room when the result matters.',
    },
    troubleshootingChecks: [
      'If a chip seems missing, swipe the status row horizontally and verify the Home Assistant entity is available.',
      'If a room total and detail disagree, close and reopen the sheet, then compare the individual sources rather than repeating another command.',
      'If Back is not shown, confirm that a room detail was actually opened; single-level Air Quality intentionally has no detail navigation.',
      'If a value stays Unknown or Unavailable, troubleshoot the owning integration or sensor instead of assuming the neutral state.',
    ],
    screenshotIds: [
      'home-status-rail-start',
      'home-status-rail-end',
      'home-climate-overview',
      'home-climate-room-detail',
      'home-occupancy-overview',
      'home-occupancy-room-detail',
      'home-contact-overview',
      'home-contact-room-detail',
      'home-air-quality-overview',
    ],
    relatedArticleIds: ['status-lights', 'thermostat-page-guide', 'presence-based-lighting', 'security-page-guide'],
  },
  'status-lights': {
    howToOpen: [
      'Open Home, select the Lights status chip, and choose a room from the overview. The room opens as a detail page inside the same sheet.',
      'A room page Lights card opens the room-focused version directly; it uses the same light group and Home Assistant state without first showing every room.',
    ],
    contents: [
      'The overview ranks rooms with active lights first and shows each room group as a stable summary rather than an immediate whole-room toggle.',
      'The room detail lists the individual lights behind that group and exposes their supported power or brightness controls.',
      'The header reports the current active-light total from Home Assistant and updates as individual lights confirm their state.',
    ],
    navigation: {
      explanation: 'The Lights sheet has no tabs. Selecting a room enters one nested detail page while preserving the overview in the same sheet. Back returns to the room grid and restores the prior scroll and focus position.',
      tabs: [],
      detailPages: [
        item('home.lights-room-detail', 'Room light detail', 'Lists the selected group members and keeps individual light commands separate from the household summary.'),
      ],
      wizardSteps: [],
    },
    closeBackCancelBehavior: 'Back returns from a room to the room overview. X, backdrop, swipe, or clearing the modal hash closes the entire sheet through the shared exit animation. Closing a detail does not turn lights off, cancel a command already sent, or reset brightness.',
    homeAssistantOwnership: 'Home Assistant owns light state, brightness, color support, group membership, and any automation side effects. The app sends the selected supported service and may temporarily show the intended value while waiting; the persistent result always comes from the live entity state.',
    stateAndDisabledBehavior: 'Active rooms and lights use persistent light-state color. Off lights remain muted. Unknown or unavailable members are disabled instead of accepting a blind command, and a mixed group should be opened before assuming every member shares the same state.',
    safetyAndLimitations: {
      title: 'Group summaries can hide one unusual light',
      text: 'The household count and room tile are condensed. Open the room detail before troubleshooting or changing an important area. A reported On state does not prove the fixture is physically illuminated, and manual commands can later be superseded by presence, schedules, scenes, or other Home Assistant automation.',
    },
    troubleshootingChecks: [
      'If a room is absent, confirm that the configured light group still belongs to the Home overview inventory.',
      'If a light changes briefly and reverts, wait for Home Assistant confirmation and check the automation or integration that owns it.',
      'If Back closes the sheet instead of returning to rooms, reopen Lights and select a room before using the in-sheet Back control.',
      'If one light is unavailable, troubleshoot that entity without assuming the complete room group is offline.',
    ],
    screenshotIds: ['status-lights-overview', 'status-lights-detail'],
    relatedArticleIds: ['status-chips', 'custom-lights-page-guide', 'presence-based-lighting', 'room-card-family-light'],
  },
  'security-system-modes': {
    howToOpen: [
      'Open Security System from the Home Quick Link, the Home Security chip, the Security status chip, or the Security page tile.',
      'Read the modal subtitle and current highlighted mode before choosing Home, Away, Night, or Disarmed.',
    ],
    contents: [
      'Four mode choices send the matching alarm command through Home Assistant while keeping the current confirmed alarm state visible.',
      'Pending, arming, triggered, unknown, and unavailable states remain visible so they are not mistaken for a completed mode change.',
    ],
    navigation: {
      explanation: 'Security System is a single-level sheet with no tabs, nested detail page, or wizard. Each mode is an action in the current destination rather than another page.',
      tabs: [],
      detailPages: [],
      wizardSteps: [],
    },
    closeBackCancelBehavior: 'Close with X, backdrop, swipe, or the hash-clearing route action. There is no in-sheet Back because there is no nested page. Closing does not undo an arm or disarm service that has already been accepted by Home Assistant.',
    homeAssistantOwnership: 'Home Assistant owns the alarm entity, code requirements, transition timing, triggered state, and downstream automations. The app requests one mode and reflects the returned state; it does not locally arm sensors, lock doors, close garages, or decide whether an alarm transition is safe.',
    stateAndDisabledBehavior: 'The confirmed mode remains persistently selected. A requested mode may appear temporarily while Home Assistant catches up, then reverts if confirmation never arrives. Unknown or unavailable alarm state disables unsafe assumptions, and a triggered or pending state should be read before another command.',
    safetyAndLimitations: {
      title: 'Confirm people, pets, doors, and the current alarm state',
      text: 'Arming can change real household security behavior. Choose a mode only after checking who remains inside and whether openings or access points need attention. Disarming or closing this sheet does not resolve a triggered sensor, and the dashboard does not replace the alarm panel or emergency procedure.',
    },
    troubleshootingChecks: [
      'If no mode becomes active, wait for the current transition to finish and inspect the alarm entity before selecting again.',
      'If a mode is disabled or unavailable, verify the Home Assistant alarm integration and any required code or condition.',
      'If the subtitle says Triggered or Pending, stop and identify the cause instead of cycling through modes.',
      'If a Home or Security opener does nothing, confirm the shared Security System destination hash is not being blocked by another open modal.',
    ],
    screenshotIds: ['section-security-modes', 'home-status-rail-start'],
    relatedArticleIds: ['security-page-guide', 'security-access-controls', 'guest-controls-page-guide', 'troubleshooting'],
  },
  'security-cameras': {
    howToOpen: [
      'Open Home or Security and select an available camera tile. The tile opens the matching camera sheet rather than issuing a recording command.',
      'Read the stream state and the camera-specific controls below it before using Snapshot, Audio, or Record.',
    ],
    contents: [
      'A WebRTC-capable live stream container remains the primary visual surface when the camera and secure browser context are available.',
      'Snapshot asks the custom camera card to save the current frame, Audio follows the card-owned mute state, and Record controls the configured manual-recording helper.',
      'Unavailable, loading, and connection-error states remain explicit and do not substitute a stale committed camera image.',
    ],
    navigation: {
      explanation: 'Each camera uses one single-level sheet. There are no tabs or nested detail pages; selecting another camera requires closing the current sheet and opening that camera tile.',
      tabs: [],
      detailPages: [],
      wizardSteps: [],
    },
    closeBackCancelBehavior: 'Close through X, backdrop, swipe, or hash clear. The sheet remains in place through its exit animation. Closing hides the camera view but does not silently stop a manual recording command that Home Assistant still reports as active.',
    homeAssistantOwnership: 'Home Assistant and the custom WebRTC camera card own stream transport, mute state, screenshots, and manual-recording state. The app sends the documented camera requests and listens for the card response; it never triggers a hidden volume control or invents a separate mute source of truth.',
    stateAndDisabledBehavior: 'A recording pill or active action reflects persistent Home Assistant state. Audio follows the latest webrtc-audio-state event. Unavailable cameras and unsupported secure-context states disable or replace live controls instead of pretending that a blank area is a usable stream.',
    safetyAndLimitations: {
      title: 'Camera controls affect private live media',
      text: 'Confirm the intended camera before taking a snapshot, enabling audio, or starting manual recording. Follow household privacy rules and applicable law. App Manual screenshots contain only synthetic control chrome and never live camera frames, private conversations, or household recordings.',
    },
    troubleshootingChecks: [
      'If the sheet opens without video, verify the camera entity, WebRTC card, network path, and secure browser context.',
      'If mute state looks wrong, wait for the camera card event rather than repeatedly toggling Audio.',
      'If Record does not settle, inspect the camera-specific recording helper and script in Home Assistant.',
      'If Snapshot fails, confirm the custom card supports the screenshot event for that camera and the browser can download or save it.',
    ],
    screenshotIds: ['security-camera-controls'],
    relatedArticleIds: ['security-page-guide', 'security-and-cameras', 'integration-catalog', 'troubleshooting'],
  },
  'presence-based-lighting': {
    howToOpen: [
      'Open Settings, Admin Controls, and Presence-Based Overrides. Choose a room to replace the overview with its four-state detail page.',
      'Open Presence-Based Overrides Auto-Reset separately when you need to change whether a room may return to normal automatic lighting during its overnight window.',
    ],
    contents: [
      'The room detail distinguishes Enabled, Disabled, Paused, and Quieted instead of reducing every nonautomatic condition to Off.',
      'The auto-reset sheet lists independent room eligibility switches; enabling one does not immediately resume that room.',
      'Room sensors, vacancy timing, guest safeguards, and relay behavior remain contextual Home Assistant facts rather than editable local rules.',
    ],
    navigation: {
      explanation: 'Presence-Based Overrides uses one same-sheet detail page per room. Back returns to the room grid. Auto-Reset is a separate single-level destination and does not nest inside the room detail.',
      tabs: [],
      detailPages: [
        item('settings.presence-detail', 'Presence lighting room detail', 'Shows the four semantic states for the selected room and sends the dedicated Home Assistant command for the chosen state.'),
      ],
      wizardSteps: [],
    },
    closeBackCancelBehavior: 'Back restores the Presence-Based Overrides room list and focus. X, backdrop, swipe, or hash clear closes the active sheet with the shared animation. Closing does not resume a paused room, cancel a confirmed command, or alter auto-reset eligibility.',
    homeAssistantOwnership: 'Home Assistant owns occupancy evaluation, off delays, overnight reset windows, guest guards, and multi-entity lighting side effects. The app sends the room and requested household state, then waits for the corresponding helper or integration state to confirm.',
    stateAndDisabledBehavior: 'The selected state remains highlighted only when the live state or a temporary requested state supports it. An unavailable room cannot accept a new override. Auto-Reset On means eligible for a later restore, not already restored, and active guest safeguards can still prevent the scheduled reset.',
    safetyAndLimitations: {
      title: 'Paused and Quieted are intentionally different',
      text: 'Paused preserves the current light state until explicitly resumed. Quieted keeps the room dark and rearms only after the configured clearing behavior. Choose the state that matches the room, and remember that a physically unpowered smart bulb cannot be recovered by presence automation alone.',
    },
    troubleshootingChecks: [
      'If a room stays dark, open its detail and distinguish Disabled, Paused, and Quieted before changing sensors.',
      'If Auto-Reset did not run, verify eligibility, the overnight window, vacancy duration, and any matching guest guard.',
      'If a state changes back, wait for Home Assistant confirmation and inspect the presence integration or another admin command.',
      'If Back is unavailable, confirm that a room detail is open rather than the separate Auto-Reset sheet.',
    ],
    screenshotIds: ['presence-lighting-states', 'presence-overrides-overview', 'presence-auto-reset'],
    relatedArticleIds: ['admin-page-guide', 'guest-controls-page-guide', 'room-card-family-occupancy', 'automation-catalog'],
  },
  'wake-alarms': {
    howToOpen: [
      'Open Master Bedroom and select Stephen’s Bed or Steph’s Bed. The selected side opens its own SleepyPod sheet and never edits the other side.',
      'Choose Alarms to browse days, open a day group, add an alarm, or edit an existing alarm. Temperature changes during a scheduled stage can open the Tonight or All Nights scope prompt.',
    ],
    contents: [
      'Temperature or Sleep Schedule shows the active stage and target for the selected side; the legacy-compatible presentation can also expose Settings.',
      'Special Modes contains temporary thermal behavior such as Hot Flash Mode. Alarms manages wake records, while Status reports availability, temperature, schedule phase, sleep data, and active alarm state.',
      'Alarm day and editor pages stay inside the same open sheet, with Save or Delete actions anchored in the footer.',
    ],
    navigation: {
      explanation: 'The climate-adapter presentation has Temperature, Special Modes, Alarms, and Status. The legacy-compatible presentation uses Sleep Schedule and adds Settings. Alarm day and editor pages temporarily replace the tab content; Back unwinds one detail level.',
      tabs: [
        item('climate.sleepypod-tab-schedule', 'Temperature', 'Shows the selected side target and active Bedtime, Asleep, or Dawn stage in the climate-adapter presentation.'),
        item('climate.sleepypod-tab-modes', 'Special Modes', 'Contains temporary modes that do not rewrite the recurring temperature schedule.'),
        item('climate.sleepypod-tab-alarms', 'Alarms', 'Lists alarm days and opens day or editor detail pages.'),
        item('climate.sleepypod-tab-status', 'Status', 'Reports live side, schedule, sleep, and alarm state.'),
        item('climate.eight-sleep-tab-schedule', 'Sleep Schedule', 'Shows recurring Bedtime, Asleep, and Dawn stages in the legacy-compatible presentation.'),
        item('climate.eight-sleep-tab-modes', 'Legacy Special Modes', 'Provides the same temporary-mode family when the legacy adapter is active.'),
        item('climate.eight-sleep-tab-alarms', 'Legacy Alarms', 'Uses the shared alarm records and detail flow in the legacy presentation.'),
        item('climate.eight-sleep-tab-status', 'Legacy Status', 'Shows legacy-compatible side and sleep metrics.'),
        item('climate.eight-sleep-tab-settings', 'Settings', 'Contains legacy-only side settings not shown by the climate-adapter presentation.'),
      ],
      detailPages: [
        item('climate.sleepypod-alarm-day', 'Alarm day', 'Groups every alarm for one weekday and offers a day-scoped Add Alarm action.'),
        item('climate.sleepypod-alarm-editor', 'Alarm editor', 'Edits time, enabled state, and eligible days, with Save and guarded Delete actions in the footer.'),
      ],
      wizardSteps: [],
    },
    closeBackCancelBehavior: 'Back returns from an alarm editor to its day or from a day to Alarms. Cancel in the temperature-scope prompt makes no change and restores focus. Closing the bed sheet dismisses any scope prompt and detail page but does not reverse a saved alarm or temperature command.',
    homeAssistantOwnership: 'Home Assistant, the SleepyPod climate adapter, and the configured schedule connection own side power, targets, stages, alarms, snooze, stop, and sleep metrics. The app scopes every command to one side and never mirrors the schedule as an independent local source of truth.',
    stateAndDisabledBehavior: 'Unavailable sides disable thermal and alarm commands. Active alarm controls appear only for the side reporting an alarm. The Tonight or All Nights prompt closes if the schedule phase changes before confirmation, preventing a stale stage command.',
    safetyAndLimitations: {
      title: 'Thermal and alarm changes affect one sleeping person',
      text: 'Confirm the side, stage, time, and days before saving. Turning a side off or deleting an alarm uses a native confirmation. Tonight changes only the current target, while All Nights rewrites the recurring stage and tonight’s target. Do not repeatedly command an unavailable or transitioning side.',
    },
    troubleshootingChecks: [
      'If a tab is missing, determine whether the climate adapter or legacy-compatible control mode is active.',
      'If an alarm editor is stale, return to Alarms and reopen the record after Home Assistant refreshes the schedule.',
      'If a target prompt closes unexpectedly, confirm the side is available and the active schedule phase did not change.',
      'If Snooze or Stop is absent, verify that the selected side—not the other side—reports an active alarm.',
    ],
    screenshotIds: [
      'section-rooms-context',
      'sleepypod-main',
      'sleepypod-modes',
      'sleepypod-alarms',
      'sleepypod-status',
      'eight-sleep-schedule',
      'eight-sleep-modes',
      'eight-sleep-alarms',
      'eight-sleep-status',
      'eight-sleep-settings',
      'sleepypod-temperature-scope',
      'sleepypod-alarm-day',
      'sleepypod-alarm-editor',
    ],
    relatedArticleIds: ['room-master-bedroom', 'thermostat-page-guide', 'schedule-systems', 'native-inputs-and-prompts'],
  },
  'humidifier-schedule': {
    howToOpen: [
      'Open Master Bedroom, select Humidifier, and use Controls, Schedules, or Info in the sheet footer.',
      'Choose Schedules and open Add Scheduled Activity or an existing row to enter the same-sheet activity editor.',
    ],
    contents: [
      'Controls manages power, mode, target humidity, mist, warmth, display state, and a one-shot timer.',
      'Schedules lists recurring Home Assistant schedule rules and exposes name, days, start, end, operating mode, humidity, mist, warmth, and display behavior.',
      'Info reports current humidity, temperature, active humidification, low water, removed tank, and other available device state.',
    ],
    navigation: {
      explanation: 'The three footer tabs reset the body to the selected content. The activity editor replaces the normal tab content in the same open sheet; Back returns to Schedules and restores the list.',
      tabs: [
        item('climate.humidifier-tab-controls', 'Controls', 'Changes the current humidifier operation and one-shot timer.'),
        item('climate.humidifier-tab-schedules', 'Schedules', 'Lists recurring activities and their current enabled or active state.'),
        item('climate.humidifier-tab-info', 'Info', 'Reports live environmental and device condition without changing settings.'),
      ],
      detailPages: [
        item('climate.humidifier-schedule-editor', 'Activity editor', 'Adds or edits one recurring activity and validates days, times, conflicts, and device profile fields before Save.'),
      ],
      wizardSteps: [],
    },
    closeBackCancelBehavior: 'Back leaves the activity editor without saving and returns to Schedules. X, backdrop, swipe, or closing the room sheet cancels unsaved drafts. A successful Save returns through the shared schedule flow; disabling or deleting an existing activity remains a Home Assistant-owned change.',
    homeAssistantOwnership: 'Home Assistant owns the schedule helper, logical activity occurrence, restart and reconnect reconciliation, saved pre-schedule device state, verified restoration, faults, and vacation guard. The app edits the structured rule and calls the configured services; it does not run timers or reproduce recovery rules in the browser.',
    stateAndDisabledBehavior: 'Low water, a removed tank, unavailable entities, save-in-progress state, invalid time, no selected days, or schedule conflicts disable the unsafe action. An active highlight comes from the current schedule state, while the editor draft remains local until Save.',
    safetyAndLimitations: {
      title: 'A schedule cannot overcome a physical humidifier fault',
      text: 'Check water, tank seating, cleanliness, and room conditions before enabling an overnight profile. The timer affects current operation only; it is not a recurring activity. Vacation can prevent scheduled operation, and schedule restoration should not be treated as proof that the device physically responded.',
    },
    troubleshootingChecks: [
      'If Save is disabled, check the activity name, selected days, valid start and end times, and any reported conflict.',
      'If an activity does not run, verify scheduling is enabled, Vacation Mode is off, and no low-water or tank fault is active.',
      'If Home Assistant reports that apply or restore did not confirm, restore device connectivity or resolve the physical fault before retrying.',
      'If the device does not restore afterward, inspect the Home Assistant schedule reconciliation and retained saved state rather than recreating the rule.',
      'If Back is absent, confirm that an activity editor—not the ordinary Schedules tab—is open.',
    ],
    screenshotIds: ['room-humidifier-sheet', 'humidifier-schedules', 'humidifier-info', 'humidifier-schedule'],
    relatedArticleIds: ['room-card-family-humidifier', 'room-master-bedroom', 'schedule-systems', 'native-inputs-and-prompts'],
  },
  'daily-report': {
    howToOpen: [
      'Select the profile button in the app header. An attention badge counts actionable overdue chores and expired food but does not complete anything.',
      'A morning or evening notification can open a named person and request the most urgent nonempty tab. If no user is resolved, choose a person from the picker.',
    ],
    contents: [
      'Overdue Chores shows work that passed its due time, Upcoming Chores shows the remainder of today, and Expired Food shows inventory batches already past date.',
      'Task rows can open the full Donetick editor. Expired food rows can open the same inventory batch editor used on food-space pages.',
      'Vacation Mode can replace actionable lists with an away explanation without deleting source tasks or inventory.',
    ],
    navigation: {
      explanation: 'The footer switches among three report tabs. Opening a task or inventory item replaces the summary in the same sheet; Back returns to the originating report content and keeps the selected tab.',
      tabs: [
        item('chores.daily-report-tab-overdue', 'Overdue Chores', 'Lists the selected person’s overdue task source and permits completion or editing.'),
        item('chores.daily-report-tab-upcoming', 'Upcoming Chores', 'Lists the rest of today and intentionally has no attention badge.'),
        item('chores.daily-report-tab-expired-food', 'Expired Food', 'Shows expired EverShelf inventory with food detail actions when not suppressed by Vacation Mode.'),
      ],
      detailPages: [
        item('chores.daily-report-task-detail', 'Task detail', 'Loads the complete Donetick task editor, including recurrence, due fields, save, and guarded delete.'),
        item('food.daily-report-inventory-detail', 'Inventory detail', 'Edits quantity, expiration, prepared state, or deletion for the selected expired inventory batch.'),
      ],
      wizardSteps: [],
    },
    closeBackCancelBehavior: 'Back returns from detail to the daily summary. X, backdrop, swipe, or hash clear closes the complete report. Closing while a detail save or delete is busy is blocked so the open form can finish and report an error safely.',
    homeAssistantOwnership: 'Home Assistant owns personalized todo lists, inventory, vacation state, notification deep links, and every save, completion, or deletion. The app combines those sources for review and consumes a requested tab only once; it does not duplicate tasks or maintain a private report database.',
    stateAndDisabledBehavior: 'Badges appear only for actionable overdue or expired counts. Empty, loading, vacation-hidden, unavailable, and error states are distinct. Busy detail forms disable close or repeat actions until Home Assistant settles, and a temporarily hidden completed row remains subordinate to the refreshed source list.',
    safetyAndLimitations: {
      title: 'The report is a summary, not another source record',
      text: 'Editing or completing an item changes its owning Donetick or EverShelf record. Confirm the person, tab, task, batch, quantity, and expiration before saving or deleting. Vacation hiding does not mean the underlying work or food disappeared.',
    },
    troubleshootingChecks: [
      'If the wrong person opens, close the report and use the intended notification link or user picker.',
      'If a badge and tab count disagree, wait for the relevant todo or inventory source to refresh.',
      'If Back is unavailable, confirm that a task or inventory detail page is open.',
      'If Vacation hides content unexpectedly, review Vacation Mode before recreating tasks or inventory.',
    ],
    screenshotIds: ['app-layout-home', 'daily-report-overview', 'daily-report-upcoming', 'daily-report-expired-food', 'daily-report-task-detail', 'daily-report-inventory-detail'],
    relatedArticleIds: ['chore-scheduling', 'food-inventory', 'guest-and-vacation', 'app-layout'],
  },
  'chore-scheduling': {
    howToOpen: [
      'Use Add Task on a supported chore page to open Create Task, or select the pencil action on an existing DoneTick row to load Edit Task.',
      'The same structured form is also used when Daily Report opens a task detail; the current task is loaded before editing becomes available.',
    ],
    contents: [
      'The form contains task name, assignee, vacation hiding, description, due date, due time, priority, recurrence, and the conditional interval or weekday fields.',
      'Create has one submit action. Edit adds Save and a guarded Delete action while preserving the task identifier loaded from Home Assistant.',
      'Custom Interval reveals Repeat Every and Interval Unit; Specific Days reveals the multi-select weekday field.',
    ],
    navigation: {
      explanation: 'Create and Edit are single-form destinations with no tabs or wizard steps. Conditional recurrence fields appear in place, and native date or time controls open platform pickers without leaving the sheet.',
      tabs: [],
      detailPages: [],
      wizardSteps: [],
    },
    closeBackCancelBehavior: 'Close discards unsaved local form edits after the shared exit animation. Save or Create closes only after the Home Assistant request succeeds. Delete first uses a native confirmation; Cancel there returns to the form without deleting.',
    homeAssistantOwnership: 'DoneTick and Home Assistant own task identity, recurrence choices, assignment, due dates, completion, vacation metadata, and deletion. The app loads the complete record, validates required fields, and sends one create, update, or delete request rather than recreating recurrence rules.',
    stateAndDisabledBehavior: 'The primary action is disabled when the name is blank, the record is loading, or another action is busy. Edit actions remain disabled until the task has loaded. Service errors keep the form open and preserve the draft so the user can correct or retry once.',
    safetyAndLimitations: {
      title: 'Check recurrence and deletion before saving',
      text: 'A repeating task can create long-lived household behavior, and Delete removes the owning task record after confirmation. Verify assignee, due fields, recurrence type, interval or weekdays, and Hide While On Vacation. A native picker value is not saved until the form itself succeeds.',
    },
    troubleshootingChecks: [
      'If Edit remains loading, verify the DoneTick task identifier and Home Assistant service response.',
      'If recurrence fields are missing, select the recurrence type that requires Custom Interval or Specific Days.',
      'If Save or Create is disabled, enter a nonblank task name and wait for any current request to finish.',
      'If a due value looks wrong, reopen the native picker and confirm both date and time before saving.',
    ],
    screenshotIds: ['section-chores-context', 'create-task-floating-action', 'chore-schedule'],
    relatedArticleIds: ['daily-report', 'chores-page-guide', 'schedule-systems', 'native-inputs-and-prompts'],
  },
  'food-scanning': {
    howToOpen: [
      'Use Scan Item from Food, Kitchen, All Food, or a storage-space page. A storage page supplies its location as the default, while the broader entry points use the app default.',
      'Camera steps can switch to manual product-name or expiration entry when scanning is unavailable or unnecessary.',
    ],
    contents: [
      'Barcode resolves known product details or accepts a manual name. Expiration reads a printed date, offers quick dates, accepts a native date, or allows no date.',
      'Review confirms product name, quantity, storage location, expiration, and Prepared Food Item before sending the inventory command.',
      'Adding shows the Home Assistant request in progress and a final success or error state instead of closing before the result is known.',
    ],
    navigation: {
      explanation: 'The scanner is a four-state wizard. Next advances, Back returns from Expiration to Barcode or from Review to Expiration, and camera processing temporarily covers the current step without becoming a separate authored step.',
      tabs: [],
      detailPages: [],
      wizardSteps: [
        item('food.scan-barcode', 'Barcode', 'Scans or resolves identity and supports manual product-name entry before continuing.'),
        item('food.scan-expiry', 'Expiration', 'Reads, selects, enters, or skips an expiration date.'),
        item('food.scan-review', 'Review', 'Confirms the complete inventory record and storage destination before Add.'),
        item('food.scan-adding', 'Adding', 'Shows submission progress, success, or error and offers Done only after a successful add.'),
      ],
    },
    closeBackCancelBehavior: 'Back preserves the current draft while moving one wizard step. X, backdrop, or swipe closes and resets the draft when the sheet is not submitting. Done closes after success. Closing never fabricates a successful add or silently continues camera capture.',
    homeAssistantOwnership: 'Home Assistant and EverShelf own barcode lookup, storage suggestion, expiration reading, product history, inventory merging, and the final add. The app requests camera access, collects the reviewed values, and sends one service command while preserving the classification and location behavior returned by EverShelf.',
    stateAndDisabledBehavior: 'Next is disabled while resolution is running or required manual information is blank. Add requires a nonblank name, valid positive quantity, and no active expiration read. Camera unavailable, insecure context, lookup not found, and service error remain separate recoverable states.',
    safetyAndLimitations: {
      title: 'Review camera-derived values before adding',
      text: 'Barcode and printed-date recognition can be wrong. Confirm the item, quantity, location, date, and prepared-food choice before Add. The manual uses synthetic screenshots and never stores a live camera frame, product label, household text, or other private scan content.',
    },
    troubleshootingChecks: [
      'If the camera is unavailable, use HTTPS or localhost and verify browser permission, then use manual entry if needed.',
      'If a barcode is not found, enter the product name and continue rather than rescanning indefinitely.',
      'If expiration reading fails, choose a quick date, use the native date picker, or intentionally skip the date.',
      'If Add fails, keep the review open, read the error, and verify the EverShelf service before retrying once.',
    ],
    screenshotIds: ['all-food-page-context', 'food-scan-review'],
    relatedArticleIds: ['food-inventory', 'food-page-guide', 'room-kitchen', 'native-inputs-and-prompts'],
  },
  'food-inventory': {
    howToOpen: [
      'Open All Food or a storage-space page. Select a grouped row or its disclosure to inspect batches; select the pencil on a single row to open the same detail shell directly.',
      'Use the floating Search, Sort, or Filter actions after inventory content loads. Sort and Filter keep a draft until Apply, while Search updates the query inline.',
    ],
    contents: [
      'Item details separate batches by location, expiration, and prepared-food state, then allow quantity, expiration, prepared status, reset, save, and guarded deletion.',
      'Sort supports configured modes and direction. Filter focuses the inventory on the selected expiration state without changing server records.',
      'Shopping, deletion, and prepared-food actions use native quantity or confirmation prompts when the requested scope cannot be inferred safely.',
    ],
    navigation: {
      explanation: 'Inventory detail is one modal destination with single-batch and grouped-batch presentations. Sort and Filter are separate sheets with Apply and Reset. There are no tabs; Daily Report can host the same detail page inside its own sheet.',
      tabs: [],
      detailPages: [
        item('food.inventory-single-detail', 'Single inventory detail', 'Shows one editable batch and keeps quantity or expiration changes local until Save.'),
        item('food.inventory-grouped-detail', 'Grouped inventory detail', 'Lists each location, expiration, and prepared batch separately so one batch can change without rewriting the others.'),
      ],
      wizardSteps: [],
    },
    closeBackCancelBehavior: 'Closing item details discards unsaved drafts unless an action is busy. Sort or Filter close without applying when dismissed; Apply commits the selected view state and Reset restores the draft defaults. Cancel in a native prompt sends no service.',
    homeAssistantOwnership: 'EverShelf and Home Assistant own inventory IDs, grouping inputs, taxonomy, quantities, expiration updates, prepared-food splits, shopping integration, and deletion. The app preserves the returned order, edits addressable batches, and reloads the inventory after a successful service response.',
    stateAndDisabledBehavior: 'Unavailable IDs, busy actions, invalid dates, missing locations, or unsupported addressability disable the affected action. Applied sort and filter colors persist in the floating dock. Added-to-shopping feedback is temporary, while inventory quantity and dates always refresh from Home Assistant.',
    safetyAndLimitations: {
      title: 'Quantity prompts can change or remove real stock',
      text: 'Confirm the product, batch, location, date, prepared state, and requested quantity before Save or Delete. A grouped product can contain several distinct batches. Deleting part of one batch is not the same as deleting every product instance, and adding to groceries is separate from inventory already in the house.',
    },
    troubleshootingChecks: [
      'If a grouped row opens unexpected batches, compare location, expiration, and prepared state before editing.',
      'If Save is disabled, check addressability, the date format, quantity change, and whether another action is busy.',
      'If Sort or Filter seems unchanged, reopen the sheet and choose Apply rather than closing the draft.',
      'If a native quantity prompt rejects input, enter a number within the displayed available range using a period for decimals.',
    ],
    screenshotIds: ['section-food-context', 'all-food-page-context', 'inventory-grouped-detail', 'inventory-single-detail', 'inventory-sort', 'inventory-filter'],
    relatedArticleIds: ['food-scanning', 'all-food-page-guide', 'daily-report', 'native-inputs-and-prompts'],
  },
  'vacuum-area-cleaning': {
    howToOpen: [
      'Open an available Main Floor, Music Room, or Theater Room vacuum, choose Controls, change the target to Area, and select Draw Area.',
      'The vacuum sheet stays open while the map editor replaces the tab content. A previously drawn rectangle can be reopened and adjusted before the clean command.',
    ],
    contents: [
      'The map editor draws one rectangular cleaning area, supports moving and resizing that rectangle, and provides Redraw and Reset View controls.',
      'Use This Area returns to Controls with the geometry preserved so mode, fan, water, passes, and the final Start Area Clean action can be reviewed together.',
      'The editor reports whether the map and required area-cleaning service are ready and converts the selected map rectangle into the centimetre coordinates expected by Home Assistant.',
    ],
    navigation: {
      explanation: 'Area editing is a same-sheet detail page rather than a nested modal. Back returns to the vacuum Controls tab without accepting a new rectangle. Use This Area accepts the geometry and returns to Controls; it does not start cleaning by itself.',
      tabs: [],
      detailPages: [
        item('cleaning.vacuum-area-editor', 'Vacuum area editor', 'Draws, moves, resizes, zooms, and accepts one temporary rectangle for the selected robot.'),
      ],
      wizardSteps: [],
    },
    closeBackCancelBehavior: 'Back leaves the editor and returns to Controls. Redraw clears only the current rectangle; Reset View changes map zoom and pan. Closing the vacuum sheet cancels the unsent area workflow. Once Start Area Clean is sent, closing does not stop the robot.',
    homeAssistantOwnership: 'Home Assistant owns the registered clean-zone scripts, robot availability, map calibration, current cleaning settings, command ordering, and start confirmation. The app converts the drawn area, queues setting requests, and waits for confirmations before requesting the area run.',
    stateAndDisabledBehavior: 'Draw Area and Start Area Clean remain disabled when the robot state, map, area-cleaning service registration, rectangle, or pending command makes a new run unsafe. A queued clean shows progress or an error and clears its temporary requested state if settings or robot start never confirm.',
    safetyAndLimitations: {
      title: 'The editor creates one temporary rectangle',
      text: 'It does not create a permanent mapped room or freeform polygon. Inspect the physical floor for people, pets, cables, liquid, rugs, closed doors, and fragile objects. Review cleaning mode, suction, water, and passes before starting, and select the final command once.',
    },
    troubleshootingChecks: [
      'If Draw Area is unavailable, confirm the map loaded and the selected robot supports the registered area-cleaning service.',
      'If Use This Area is disabled, draw a nonempty rectangle inside the usable map and wait for editor readiness.',
      'If Start Area Clean is disabled after returning, check robot state, pending settings, selected geometry, and area-cleaning service registration.',
      'If the run fails to start, read the cleaning-controller error and verify the clean-zone script before drawing the same area again.',
    ],
    screenshotIds: ['vacuum-area-editor'],
    relatedArticleIds: ['vacuums-page-guide', 'vacuum-cleaning', 'room-card-family-vacuum', 'troubleshooting'],
  },
  recipes: {
    howToOpen: [
      'Open a suggested recipe on Food or any recipe card on Recipes. Both entry points use the same Recipe Details sheet.',
      'On Recipes, use the floating Search, Sort, and Filter actions to change the query criteria before opening a card.',
    ],
    contents: [
      'General contains grouped factual status pills, toned freshness with its compact date, equipment, and source attribution. Ingredients contains ordered provider/local sections, inventory-aware rows, and the guarded grocery-add action.',
      'Ingredient titles place the EverShelf display name and source amount on one line. Group labels remain authoritative, multiple empty labels become subdued Section headings, ungrouped ingredients remain under Other Ingredients, and only an explicit true optional flag shows Optional.',
      'Materially different source wording, quantity sufficiency, product details, and explicit Matched as identity annotations remain secondary without repeating the title amount.',
      'Instructions shows authorized local groups as labeled semantic numbered rows, falls back to one unlabeled group for older flat steps, or shows an attributed external Cookidoo link. Protected Cookidoo steps and groups are never copied into React Dash.',
      'Sort and Filter preserve server ranking rules, coverage thresholds, expiration horizon, and ranking weights without locally reranking the returned result order.',
    ],
    navigation: {
      explanation: 'Recipe Details uses three icon-only, keyboard-accessible tabs anchored in the modal footer. Their accessible names, selected state, arrow-key movement, and linked tab panels remain available even though visible text is omitted. The independently scrolling body resets for selected content. Sort and Filter are separate floating-action sheets, and detail remains in place through close so loaded content does not disappear before the exit animation.',
      tabs: [
        item('food.recipe-detail-general', 'General', 'Shows source and factual recipe details that the EverShelf integration declares available.'),
        item('food.recipe-detail-ingredients', 'Ingredients', 'Shows ordered ingredient sections, inline amounts, inventory state, optional annotations, and the missing-ingredient grocery action.'),
        item('food.recipe-detail-instructions', 'Instructions', 'Shows authorized grouped local steps as numbered lists or an external attributed Cookidoo destination.'),
      ],
      detailPages: [],
      wizardSteps: [],
    },
    closeBackCancelBehavior: 'Close Recipe Details with X, backdrop, swipe, or the owning card controller. Closing Sort or Filter discards an unapplied draft; Apply changes the active query and returns focus to the floating action. External instructions open in a separate browser context.',
    homeAssistantOwnership: 'The Home Assistant EverShelf integration owns catalog ranking, filtering, deduplication, pagination, hydration, detail capabilities, ingredient matching, and grocery submission. The app sends criteria, preserves returned order, deduplicates only by the key supplied with each result, and does not call provider or catalog services directly.',
    stateAndDisabledBehavior: 'Loading, unsupported, error, ready, grocery loading, success, and failure are explicit. The grocery action gives loading and submitted states first priority, then distinguishes truncated or absent ingredient data, temporary capability unavailability, the installed integration explicitly reporting unsupported, a legacy capability-false fallback, too many confirmed missing selections, uncertain-only ingredients, and a supported recipe with no missing ingredients. Alphabetical sort disables ranking-weight controls because those weights would have no effect.',
    safetyAndLimitations: {
      title: 'Recipe capability and source rights control what appears',
      text: 'Do not infer missing instructions or ingredient certainty. Cookidoo steps remain external, truncated details cannot be added to groceries safely, and uncertain matches are not auto-added. The current Home Assistant service status keeps recipe features marked In Development until the required services exist.',
    },
    troubleshootingChecks: [
      'If a card cannot load details, check the installed recipe-detail capability and service response.',
      'If Add Missing Ingredients is disabled, read the displayed reason before changing inventory or retrying.',
      'If Sort or Filter does not change results, confirm Apply and inspect the EverShelf query response rather than reordering cards in the app.',
      'If Instructions opens externally, treat that as the intended protected-source behavior for Cookidoo content.',
    ],
    screenshotIds: ['food-suggested-recipes', 'recipes-browse', 'recipe-detail-general', 'recipe-detail-ingredients', 'recipe-detail-instructions', 'recipe-detail', 'recipe-sort', 'recipe-filter'],
    relatedArticleIds: ['recipes-page-guide', 'food-inventory', 'work-in-development', 'integration-catalog'],
  },
}

export const MANUAL_NEW_SURFACE_GUIDE_ARTICLES: ManualSurfaceGuideArticle[] = [
  {
    id: 'thermostat-controls-guide',
    kind: 'surface-guide',
    sectionId: 'climate',
    parentId: 'thermostat-page-guide',
    title: 'Thermostat rooms, automation, and tracking',
    summary: 'Use the shared Thermostat sheet to open room controls, configure Eco and Predictive Comfort, and manage room participation rules.',
    icon: 'mdi:home-thermometer',
    status: 'current',
    aliases: ['thermostat settings', 'room thermostats', 'eco mode settings', 'room tracking'],
    visibleLabels: ['Rooms', 'Automation', 'Tracking', 'Selected Rooms', 'Critical Protection', 'Occupied Only'],
    keywords: ['thermostat modal', 'rooms', 'automation', 'eco', 'predictive comfort', 'tracking'],
    tasks: ['How do I open a room thermostat?', 'Where are Eco and Predictive Comfort settings?', 'How do I choose tracked or occupied-only rooms?'],
    coversRoutes: ['ecobee'],
    blocks: [],
    surfaceGuide: {
      howToOpen: [
        'Open Climate, review the Whole Home dial and Thermostat Hub, then use Room Thermostats, Automation, or Room Tracking to open the matching tab.',
        'An existing room hash or Predictive Comfort link opens the same sheet directly on its matching detail page instead of creating another modal.',
      ],
      contents: [
        'Rooms explains that each row shows current temperature and occupancy. Selecting a room shows its dial, vent status, and any effective Away or Vacation notice.',
        'Automation uses plain toggle and list rows instead of page-style glass tiles. Each important control has a short explanation above it, and Critical Tracking, Away Behavior, and Predictive Comfort open focused pages inside the same sheet.',
        'Tracking explains each batch rule before its row. Selected Rooms, Critical Protection, and Occupied Only each open a dynamic room grid while Home Assistant remains the source of truth.',
      ],
      navigation: {
        explanation: 'Rooms, Automation, and Tracking are fixed footer tabs. A tab change resets the body to the top. Selecting a room, option row, prediction, or tracking list replaces the tab body with one detail page; Back restores the previous tab scroll and opener focus.',
        tabs: [
          item('climate.thermostat-tab-rooms', 'Rooms', 'Explains the room list, then opens the selected thermostat detail without changing a target merely by navigating.'),
          item('climate.thermostat-tab-automation', 'Automation', 'Explains the master integration, Eco policy, and Predictive Comfort controls before each dark row or toggle.'),
          item('climate.thermostat-tab-tracking', 'Tracking', 'Explains selected, critical-protection, and occupancy-only policies before their batch-oriented child pages.'),
        ],
        detailPages: [
          item('climate.thermostat-room-detail', 'Room thermostat detail', 'Shows one room dial, its configured vent status, and its Home Assistant-owned away notice.'),
          item('climate.predictive-comfort-detail', 'Predictive Comfort', 'Shows the three independent permissions, current prediction metrics, and the explanation supplied by Home Assistant attributes.'),
          item('climate.eco-critical-tracking-detail', 'Eco Mode Critical Tracking', 'Uses a dynamic choice grid to select whether no rooms, selected untracked rooms, or all rooms receive critical-temperature protection.'),
          item('climate.eco-away-behavior-detail', 'Eco Behavior When Away', 'Uses a dynamic choice grid to select whether Eco disables, uses the away target range, or remains active when everyone is away.'),
          item('climate.tracking-selected-rooms-detail', 'Selected Rooms', 'Uses a dynamic room grid for the rooms that participate when selected-room tracking is enabled.'),
          item('climate.tracking-critical-protection-detail', 'Critical Protection', 'Uses a dynamic room grid for eligible unselected rooms when the configured policy allows a selective list.'),
          item('climate.tracking-occupied-only-detail', 'Occupied Only', 'Uses a dynamic room grid for rooms that leave demand while empty and rejoin when occupied.'),
        ],
        wizardSteps: [],
      },
      closeBackCancelBehavior: 'Back returns from a detail page to its owning tab. X, backdrop, swipe, Escape, browser Back, or clearing the hash closes the complete sheet through the shared exit animation. Closing does not undo a target, mode, option, or toggle that Home Assistant already accepted.',
      homeAssistantOwnership: 'Home Assistant owns climate targets, equipment action, occupancy, contacts, vents, away policy, Eco behavior, predictive calculations, tracking eligibility, and all cascading side effects. The app sends only the selected supported service and may briefly show the requested state while waiting for confirmation.',
      stateAndDisabledBehavior: 'Heat, cool, active, selected, and warning colors represent persistent live state. Unavailable entities remain visible but disabled. Critical Protection stays unavailable until Track Selected Rooms and the selective critical policy are active, and live updates never change the current tab or eject a detail page.',
      safetyAndLimitations: {
        title: 'Room settings can change whole-house comfort decisions',
        text: 'Check people, pets, open contacts, critical rooms, and equipment limits before changing participation or predictive permissions. Vent tiles in the room detail report position only; they do not directly command the vent from this sheet.',
      },
      troubleshootingChecks: [
        'If a room does not appear, confirm it is still configured in the thermostat room inventory and its summary entities are available.',
        'If a tracking list is disabled, verify the Track Selected Rooms master and Eco Mode Critical Tracking policy shown in Automation.',
        'If Predictive Comfort recommends but does not act, inspect the setpoint, HVAC-mode, away permissions, rate limit, and Automatic Thermostat master.',
        'If Back closes instead of returning to a tab, reopen the matching Climate page entry and confirm that a child page was entered from the tab overview.',
      ],
      screenshotIds: [
        'thermostat-controls-rooms',
        'thermostat-controls-automation',
        'thermostat-controls-tracking',
        'thermostat-room',
        'predictive-comfort',
        'eco-critical-tracking-picker',
        'eco-away-behavior-picker',
        'thermostat-selected-rooms',
        'thermostat-critical-protection',
        'thermostat-occupied-only',
      ],
      relatedArticleIds: ['thermostat-page-guide', 'thermostat-and-contacts', 'behavior-thermostat-comfort', 'task-adjust-thermostat', 'task-configure-predictive-comfort'],
    },
  },
  {
    id: 'weather-surface-guide',
    kind: 'surface-guide',
    sectionId: 'home',
    parentId: 'home-overview',
    title: 'Weather sheet guide',
    summary: 'Open the Weather sheet, compare hourly conditions, precipitation, wind, seven-day forecasts, highlights, and unavailable states.',
    icon: 'mdi:weather-partly-cloudy',
    status: 'current',
    aliases: ['weather modal', 'hourly forecast', 'Pirate Weather'],
    visibleLabels: ['Weather', 'Conditions', 'Precipitation', 'Wind', 'Next Seven Days', 'Highlights'],
    keywords: ['weather', 'forecast', 'hourly', 'precipitation', 'wind', 'seven day', 'highlights'],
    tasks: ['How do I open the full weather forecast?', 'How do I compare rain and wind by hour?', 'What should I check when forecast data is missing?'],
    coversRoutes: ['overview'],
    blocks: [],
    surfaceGuide: {
      howToOpen: [
        'Open Home and select the large weather hero. The hero itself is a summary and does not change a Home Assistant entity.',
        'Use the mode buttons inside the hourly panel to compare Conditions, Precipitation, or Wind without closing the sheet.',
      ],
      contents: [
        'The top reports current condition, temperature, and today’s high and low, followed by an hourly strip and the next seven days.',
        'Highlights show available humidity, wind, visibility, pressure, precipitation, UV, cloud, and feels-like facts without inventing missing measurements.',
        'Daily and hourly forecasts load through Home Assistant weather forecast services and retain a short cache so reopening is responsive.',
      ],
      navigation: {
        explanation: 'The Weather sheet is single-level. Its three hourly modes behave like local view tabs: they replace the hourly value presentation while leaving the current weather, seven-day list, and highlights in the same scroll flow.',
        tabs: [
          item('home.weather-mode-condition', 'Conditions', 'Shows hourly condition glyphs and compact forecast wording.'),
          item('home.weather-mode-precipitation', 'Precipitation', 'Shows hourly precipitation probability and accumulation when supplied.'),
          item('home.weather-mode-wind', 'Wind', 'Shows hourly wind speed, direction, and gust information when supplied.'),
        ],
        detailPages: [],
        wizardSteps: [],
      },
      closeBackCancelBehavior: 'Close with X, backdrop, or swipe. There is no Back because no nested detail page exists. Closing does not cancel Home Assistant weather updates; a later reopen can use the fresh cache or request newer daily and hourly data.',
      homeAssistantOwnership: 'Home Assistant owns the weather entity and forecast service responses. The app formats the current entity and requests daily or hourly forecasts only when needed. It does not calculate a private forecast, alter weather state, or treat a cached response as newer than Home Assistant.',
      stateAndDisabledBehavior: 'Loading skeletons, service errors, empty forecasts, and unavailable entity values are explicit. A mode selection changes only the visible interpretation and remains persistent until another mode is selected. Missing highlight attributes are omitted rather than shown as zero.',
      safetyAndLimitations: {
        title: 'Forecasts are guidance, not an emergency alert',
        text: 'Use official alerts and local conditions for dangerous weather, wildfire, flooding, ice, or evacuation decisions. Forecast timing and precipitation amounts can change. A missing or stale Home Assistant response should not be treated as clear weather.',
      },
      troubleshootingChecks: [
        'If daily data is missing, verify the Home Assistant weather entity and daily forecast service response.',
        'If hourly modes are empty, check the hourly forecast response rather than repeatedly switching modes.',
        'If values look stale, close and reopen after the cache interval or inspect the integration update time.',
        'If only one metric is absent, confirm that the provider supplied that attribute before troubleshooting the entire sheet.',
      ],
      screenshotIds: ['section-home-context', 'weather-sheet', 'weather-precipitation', 'weather-wind'],
      relatedArticleIds: ['home-overview', 'status-chips', 'integration-catalog', 'troubleshooting'],
    },
  },
  {
    id: 'rooms-picker-guide',
    kind: 'surface-guide',
    sectionId: 'rooms',
    parentId: 'browse-pages',
    title: 'Rooms picker guide',
    summary: 'Use the Rooms floating action, understand ranked ordering, open a room safely, and close without changing household state.',
    icon: 'mdi:floor-plan',
    status: 'current',
    aliases: ['rooms modal', 'room chooser', 'floor plan button'],
    visibleLabels: ['Rooms'],
    keywords: ['rooms', 'picker', 'floating action', 'ranking', 'navigation'],
    tasks: ['How do I open the Rooms picker?', 'Why did a room move in the list?', 'Does choosing a room change any devices?'],
    coversRoutes: ['overview', ...ROOM_ROUTE_PATHS],
    blocks: [],
    surfaceGuide: {
      howToOpen: [
        'Select the Rooms floating action on Home or a room page. Kitchen can show Rooms beside the Scan action.',
        'Choose the named room card once. The picker closes first, then the app opens that room page.',
      ],
      contents: [
        'Every configured room appears as a room card using the same route inventory as the dashboard.',
        'Frequently opened rooms can rank earlier based on the Home Assistant-owned access counter, but every configured room remains available.',
        'The picker is navigation only; it does not toggle room lights, climate, occupancy, contacts, or appliances.',
      ],
      navigation: {
        explanation: 'The picker has no tabs, detail pages, or wizard. Selecting a room exits the modal and navigates to a full route. Use that page’s Back control or the Rooms action to choose another room.',
        tabs: [],
        detailPages: [],
        wizardSteps: [],
      },
      closeBackCancelBehavior: 'X, backdrop, or swipe closes without navigation. Selecting a room closes and records the access increment asynchronously; failure to update ranking does not block navigation. There is no in-sheet Back because the picker has one level.',
      homeAssistantOwnership: 'The app owns page navigation, while Home Assistant owns the optional room-access counter script used for ranking. The ranking call is best effort and never changes room devices. Room state and controls remain on the destination page and in Home Assistant.',
      stateAndDisabledBehavior: 'Room cards stay dimensionally stable while ranking changes. A route remains selectable even if one device inside that room is unavailable, because the room page can still explain its other sources. Missing route configuration is a build-time inventory problem, not a hidden disabled card.',
      safetyAndLimitations: {
        title: 'Opening a room is not a device command',
        text: 'The picker only changes the React Dash route. Controls on the destination page may act immediately, so read the room card and its family guide before selecting a lock, garage, power, appliance, or other physical action.',
      },
      troubleshootingChecks: [
        'If a room is missing, compare the dashboard route and room configuration inventories.',
        'If ordering does not change, check the room-access increment script without blocking ordinary navigation.',
        'If the wrong page opens, close the picker and verify the selected room title and configured path.',
        'If the picker is hidden, confirm the current route supplies a DashboardFloatingAction and the app chrome is not intentionally hidden.',
      ],
      screenshotIds: ['section-home-context', 'app-layout-home', 'rooms-picker'],
      relatedArticleIds: ['browse-pages', 'room-sheet-navigation-guide', 'device-families', 'app-layout'],
    },
  },
  {
    id: 'room-sheet-navigation-guide',
    kind: 'surface-guide',
    sectionId: 'rooms',
    parentId: 'device-families',
    title: 'Room sheet navigation guide',
    summary: 'Understand which room header and body cards open sheets, which act immediately, and where each detailed family guide lives.',
    icon: 'mdi:view-dashboard-outline',
    status: 'current',
    aliases: ['room modal', 'room status chip', 'room source card'],
    visibleLabels: ['Climate', 'Occupancy', 'Lights', 'Doors', 'Air Quality', 'Humidifier', 'Dishwasher', 'Bear Grills'],
    keywords: ['room sheet', 'status chip', 'source card', 'modal', 'direct action', 'unavailable'],
    tasks: ['Which room cards open a detail sheet?', 'Why did a room card act immediately?', 'How do I close a room sheet safely?'],
    coversRoutes: [...ROOM_ROUTE_PATHS],
    blocks: [],
    surfaceGuide: {
      howToOpen: [
        'Select a room header status chip or a body card that displays a disclosure. The configured family decides which shared sheet content opens.',
        'Do not assume every room card opens. Garage covers, media app tiles, computer power cards, and other explicitly direct actions can send a Home Assistant command instead.',
      ],
      contents: [
        'Header chips open compact room summaries for air, climate, contacts, lights, or occupancy when that room has the configured source.',
        'Body cards can open dishwasher, grill, humidifier, media remote, SleepyPod, vacuum, vent, or the same room summary families.',
        'The fourteen room-card family guides own exact action branches, persistent states, unavailable behavior, safety, and troubleshooting.',
      ],
      navigation: {
        explanation: 'Most room sheets are single-level. Shared light, climate, occupancy, and contact sheets can open a focused member view; media, vacuum, humidifier, and SleepyPod add their own tabs or details described by their canonical guides.',
        tabs: [],
        detailPages: [],
        wizardSteps: [],
      },
      closeBackCancelBehavior: 'A sheet X, backdrop, swipe, or room hash clear follows the shared close animation. Use in-sheet Back only when a nested detail is visible. Closing never reverses a direct action already sent from the room page.',
      homeAssistantOwnership: 'The room configuration chooses the visible card and opener behavior. Home Assistant owns entity state and every service side effect. The app selects the reusable content for the card family and never duplicates cross-device automation logic in the sheet.',
      stateAndDisabledBehavior: 'Disclosure appears only when the configured sheet can open in the current state. Unavailable primary entities mute or disable the opener. Persistent color indicates device state, not press feedback. A card with no disclosure may be status-only or an immediate command, so use its family guide.',
      safetyAndLimitations: {
        title: 'Read the affordance before selecting a room card',
        text: 'A disclosure opens detail; a power or action card can operate a physical device immediately. Check garage doors, computers, appliances, media scripts, and other state-dependent actions before selecting. Unknown or unavailable must never be interpreted as Off, Closed, or safe.',
      },
      troubleshootingChecks: [
        'If a disclosed card does not open, verify its primary entity and configured room hash are available.',
        'If a card sends a command instead, review its family action semantics and state-dependent branch.',
        'If the wrong content opens, compare the card kind and semantic destination mapping rather than the visible hash.',
        'If Back is missing, confirm the current family actually has a nested detail page.',
      ],
      screenshotIds: ['section-rooms-context'],
      relatedArticleIds: ['device-families', 'rooms-picker-guide', 'media-page-guide', 'vacuums-page-guide'],
    },
  },
  {
    id: 'native-inputs-and-prompts',
    kind: 'surface-guide',
    sectionId: 'start',
    parentId: 'states-and-feedback',
    title: 'Native pickers and confirmation prompts',
    summary: 'Use platform date, time, quantity, and confirmation prompts without mistaking Cancel, close, or validation for a saved command.',
    icon: 'mdi:form-select',
    status: 'current',
    aliases: ['date picker', 'time picker', 'browser prompt', 'confirmation dialog'],
    visibleLabels: ['Cancel', 'Tonight', 'All Nights', 'Due Date', 'Due Time', 'Expiration Date'],
    keywords: ['native picker', 'date', 'time', 'prompt', 'confirm', 'quantity', 'delete'],
    tasks: ['How do native date and time pickers save?', 'What happens when I cancel a confirmation?', 'Why was a quantity prompt rejected?'],
    coversRoutes: ['vacation', 'master-bedroom', 'chores', 'food', 'all-food', 'pantry', 'fridge', 'freezer', 'spice-rack', 'cabinet'],
    blocks: [],
    surfaceGuide: {
      howToOpen: [
        'Select a date or time field in Vacation, task forms, humidifier schedules, SleepyPod schedules or alarms, scanner review, or inventory details.',
        'Select a guarded delete, SleepyPod power-off, inventory quantity, prepared-food, or shopping action when the browser must confirm scope before Home Assistant is called.',
      ],
      contents: [
        'Platform date and time pickers return one field value to the still-open form; the surrounding Save, Add, or Confirm action remains responsible for submission.',
        'Confirmation dialogs require an explicit approval before a destructive or disruptive command. Cancel returns to the owning surface and sends nothing.',
        'Quantity prompts validate numeric format and available range before any inventory or shopping service is constructed.',
      ],
      navigation: {
        explanation: 'Native prompts belong to the browser or operating system, not to app tabs or nested sheet pages. They temporarily sit above the owning sheet, then return focus and control to that sheet when accepted or cancelled.',
        tabs: [],
        detailPages: [],
        wizardSteps: [],
      },
      closeBackCancelBehavior: 'Cancel, Escape, or dismissing a native prompt leaves the owning draft unchanged and sends no service. Accepting a picker updates only that field. Accepting a confirmation or quantity prompt allows the owning action to continue, but the open sheet remains responsible for busy and error state.',
      homeAssistantOwnership: 'The browser owns native picker and prompt controls. The app validates the returned value and calls Home Assistant only after the owning workflow accepts it. Home Assistant owns the actual task, vacation, schedule, SleepyPod, inventory, or shopping change.',
      stateAndDisabledBehavior: 'Invalid, blank, out-of-range, stale, unavailable, or busy contexts prevent the final action even if a prompt can be opened. A picker value can remain an unsaved draft. Native dialog appearance differs by device and cannot be assumed to match screenshots exactly.',
      safetyAndLimitations: {
        title: 'Read the prompt and the owning form together',
        text: 'Confirm the item, side, alarm, task, batch, quantity, date, and time before accepting. Delete and power-off confirmations can affect real data or devices. Native prompts do not provide Home Assistant confirmation; wait for the owning sheet to report success or a settled live state.',
      },
      troubleshootingChecks: [
        'If a picker does not open, select the visible field or its wrapper and verify the browser supports showPicker for that input type.',
        'If a value is not saved, complete the owning form’s Save, Add, or Confirm action after closing the picker.',
        'If a quantity is rejected, enter a value within the displayed range and use the expected decimal separator.',
        'If Cancel still changed something, inspect the owning action path because the prompt contract requires no service before acceptance.',
      ],
      screenshotIds: ['vacation-confirmation'],
      relatedArticleIds: ['chore-scheduling', 'food-inventory', 'food-scanning', 'wake-alarms'],
    },
  },
]

export function isManualSurfaceGuideArticle(article: ManualArticle): article is ManualSurfaceGuideArticle {
  return article.kind === 'surface-guide'
}

export function manualSurfaceGuideAuthoredTextValues(article: ManualSurfaceGuideArticle) {
  const guide = article.surfaceGuide
  return [
    ...guide.howToOpen,
    ...guide.contents,
    guide.navigation.explanation,
    ...guide.navigation.tabs.flatMap((entry) => [entry.label, entry.explanation]),
    ...guide.navigation.detailPages.flatMap((entry) => [entry.label, entry.explanation]),
    ...guide.navigation.wizardSteps.flatMap((entry) => [entry.label, entry.explanation]),
    guide.closeBackCancelBehavior,
    guide.homeAssistantOwnership,
    guide.stateAndDisabledBehavior,
    guide.safetyAndLimitations.title,
    guide.safetyAndLimitations.text,
    ...guide.troubleshootingChecks,
  ]
}

export function manualSurfaceGuideWordCount(article: ManualSurfaceGuideArticle) {
  return manualSurfaceGuideAuthoredTextValues(article).join(' ').trim().split(/\s+/).filter(Boolean).length
}
