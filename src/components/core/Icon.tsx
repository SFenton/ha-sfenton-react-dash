import {
  AirVent,
  Bath,
  BedDouble,
  Camera,
  Car,
  CheckSquare,
  CircleDot,
  ClipboardList,
  CookingPot,
  DoorClosed,
  DoorOpen,
  Dumbbell,
  Fan,
  Film,
  FlameKindling,
  Footprints,
  Home,
  Lamp,
  Monitor,
  Music,
  Popcorn,
  Settings,
  Shield,
  Sofa,
  Sparkles,
  Thermometer,
  UtensilsCrossed,
  UserRoundCheck,
  UserRoundX,
  Warehouse,
} from 'lucide-react'
import type { ComponentType } from 'react'
import type { IconKey } from '../../constants/atAGlance'

interface IconProps {
  name: IconKey
  size?: number
}

const ICONS = {
  air: AirVent,
  bath: Bath,
  bed: BedDouble,
  camera: Camera,
  car: Car,
  checklist: ClipboardList,
  contact: CircleDot,
  deck: Fan,
  door: DoorClosed,
  'door-open': DoorOpen,
  dumbbell: Dumbbell,
  garage: Warehouse,
  grill: FlameKindling,
  home: Home,
  kitchen: CookingPot,
  light: Lamp,
  media: Film,
  music: Music,
  office: Monitor,
  presence: UserRoundCheck,
  'presence-off': UserRoundX,
  security: Shield,
  settings: Settings,
  sofa: Sofa,
  sparkles: Sparkles,
  stairs: Footprints,
  theater: Popcorn,
  thermostat: Thermometer,
  utensils: UtensilsCrossed,
  vacuum: CheckSquare,
  weather: AirVent,
} satisfies Record<IconKey, ComponentType<{ absoluteStrokeWidth?: boolean; size?: number; strokeWidth?: number }>>

export function Icon({ name, size = 22 }: IconProps) {
  const Component = ICONS[name]
  return <Component size={size} strokeWidth={2.05} absoluteStrokeWidth />
}
