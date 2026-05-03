import {
  AirVent,
  BedDouble,
  Camera,
  Car,
  CheckSquare,
  CircleDot,
  ClipboardList,
  Fan,
  Film,
  Home,
  Lamp,
  Music,
  Settings,
  Shield,
  Sofa,
  Sparkles,
  Thermometer,
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
  bed: BedDouble,
  camera: Camera,
  car: Car,
  checklist: ClipboardList,
  contact: CircleDot,
  deck: Fan,
  garage: Warehouse,
  home: Home,
  light: Lamp,
  media: Film,
  music: Music,
  presence: CircleDot,
  security: Shield,
  settings: Settings,
  sofa: Sofa,
  sparkles: Sparkles,
  thermostat: Thermometer,
  vacuum: CheckSquare,
  weather: AirVent,
} satisfies Record<IconKey, ComponentType<{ absoluteStrokeWidth?: boolean; size?: number; strokeWidth?: number }>>

export function Icon({ name, size = 22 }: IconProps) {
  const Component = ICONS[name]
  return <Component size={size} strokeWidth={2.05} absoluteStrokeWidth />
}