/** Route definitions for the dashboard */

export type TopLevelRoute = 'overview' | 'security' | 'ecobee' | 'chores' | 'settings';

export type SubRoute =
  | 'admin'
  | 'guests-staying-over'
  | 'to-do'
  | 'mach-e'
  | 'groceries'
  | 'stephens-chores'
  | 'stephs-chores'
  | 'unassigned-chores'
  | 'home-improvement-chores'
  | 'vacuums'
  | 'media'
  | 'custom-lights';

export type AreaRoute =
  | 'living-room'
  | 'guest-room'
  | 'gym'
  | 'master-bedroom'
  | 'office'
  | 'hallway'
  | 'kitchen'
  | 'music-room'
  | 'garage'
  | 'theater-room'
  | 'back-deck'
  | 'downstairs-hallway'
  | 'guest-bathroom'
  | 'master-bathroom'
  | 'dining-room'
  | 'entryway';

export type Route = TopLevelRoute | AreaRoute | SubRoute;

export const TOP_LEVEL_ROUTES: { route: TopLevelRoute; label: string; icon: string }[] = [
  { route: 'overview', label: 'Home', icon: 'mdi:home' },
  { route: 'security', label: 'Security', icon: 'mdi:shield' },
  { route: 'ecobee', label: 'Ecobee', icon: 'mdi:thermostat' },
  { route: 'chores', label: 'Tasks', icon: 'mdi:checkbox-marked-outline' },
  { route: 'settings', label: 'Settings', icon: 'mdi:cog' },
];

export const AREA_ROUTES: { route: AreaRoute; label: string; icon: string }[] = [
  { route: 'living-room', label: 'Living Room', icon: 'mdi:sofa' },
  { route: 'guest-room', label: 'Guest Room', icon: 'mdi:bed' },
  { route: 'gym', label: 'Gym', icon: 'mdi:dumbbell' },
  { route: 'master-bedroom', label: 'Master Bedroom', icon: 'mdi:bed-king' },
  { route: 'office', label: 'Office', icon: 'mdi:desk' },
  { route: 'hallway', label: 'Hallway', icon: 'mdi:door-open' },
  { route: 'kitchen', label: 'Kitchen', icon: 'mdi:silverware-fork-knife' },
  { route: 'music-room', label: 'Music Room', icon: 'mdi:music' },
  { route: 'garage', label: 'Garage', icon: 'mdi:garage' },
  { route: 'theater-room', label: 'Theater Room', icon: 'mdi:theater' },
  { route: 'back-deck', label: 'Back Deck', icon: 'mdi:deck' },
  { route: 'downstairs-hallway', label: 'Downstairs Hallway', icon: 'mdi:stairs' },
  { route: 'guest-bathroom', label: 'Guest Bathroom', icon: 'mdi:shower' },
  { route: 'master-bathroom', label: 'Master Bathroom', icon: 'mdi:shower-head' },
  { route: 'dining-room', label: 'Dining Room', icon: 'mdi:table-furniture' },
  { route: 'entryway', label: 'Entryway', icon: 'mdi:door' },
];
