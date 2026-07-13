const ALLOWED_COPILOT_ENVIRONMENT_KEYS = [
  'CI',
  'COLORTERM',
  'DBUS_SESSION_BUS_ADDRESS',
  'DISPLAY',
  'FORCE_COLOR',
  'HOME',
  'LANG',
  'LOGNAME',
  'NO_COLOR',
  'PATH',
  'SHELL',
  'SSH_AUTH_SOCK',
  'TEMP',
  'TERM',
  'TMP',
  'TMPDIR',
  'USER',
  'VITE_HA_TOKEN',
  'VITE_HA_URL',
  'WAYLAND_DISPLAY',
  'XDG_CACHE_HOME',
  'XDG_CONFIG_HOME',
  'XDG_DATA_HOME',
] as const

export function buildCopilotChildEnvironment(source: NodeJS.ProcessEnv = process.env) {
  const environment: NodeJS.ProcessEnv = {}
  for (const key of ALLOWED_COPILOT_ENVIRONMENT_KEYS) {
    if (source[key] !== undefined) environment[key] = source[key]
  }
  for (const [key, value] of Object.entries(source)) {
    if (key.startsWith('LC_') && value !== undefined) environment[key] = value
  }
  return environment
}
