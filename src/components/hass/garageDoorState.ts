export type GarageDoorCommandService = 'close_cover' | 'open_cover'
export type GarageDoorTransitionState = 'closing' | 'opening'

export interface GarageDoorCommand {
  opens: boolean
  service: GarageDoorCommandService
  state: GarageDoorTransitionState
}

const OPEN_COMMAND: GarageDoorCommand = {
  opens: true,
  service: 'open_cover',
  state: 'opening',
}

const CLOSE_COMMAND: GarageDoorCommand = {
  opens: false,
  service: 'close_cover',
  state: 'closing',
}

const COMMAND_BY_STATE: Partial<Record<string, GarageDoorCommand>> = {
  closed: OPEN_COMMAND,
  closing: OPEN_COMMAND,
  open: CLOSE_COMMAND,
  opening: CLOSE_COMMAND,
}

export function garageDoorCommandForState(state: string | undefined): GarageDoorCommand | null {
  return state ? COMMAND_BY_STATE[state] ?? null : null
}
