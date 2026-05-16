import type { IconKey } from '../../constants/atAGlance'
import { DOOR_CLOSED_TRANSFORM, materialIconPath } from './iconPaths'

interface IconProps {
  name: IconKey | string
  size?: number
}

export function MaterialIcon({ name, path, pathTransform, size = 22 }: { name?: string | IconKey; path?: string; pathTransform?: string; size?: number }) {
  return (
    <svg aria-hidden="true" fill="currentColor" focusable="false" height={size} viewBox="0 0 24 24" width={size}>
      <path d={path ?? materialIconPath(name)} transform={pathTransform} />
    </svg>
  )
}

export function Icon({ name, size = 22 }: IconProps) {
  if (name === 'contact' || name === 'door') return <MaterialIcon path={materialIconPath('door')} pathTransform={DOOR_CLOSED_TRANSFORM} size={size} />
  return <MaterialIcon name={name} size={size} />
}