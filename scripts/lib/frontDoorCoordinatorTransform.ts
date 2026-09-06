import { createHash } from 'node:crypto'
import { FRONT_DOOR, type HaRecord } from './frontDoorUnsecuredConfig'

export const COORDINATOR_DELEGATION = 'Routine unlocked-away notifications are owned by automation.front_door_unsecured_lifecycle.'
export const COORDINATOR_FALLBACK = 'Managed passive unlocked-away fallback; no notification lock action.'

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => [key, stable(entry)]))
  }
  return value
}

export function configFingerprint(value: unknown) {
  return createHash('sha256').update(JSON.stringify(stable(value)) ?? 'undefined').digest('hex')
}

export function removeCoordinatorUnsecuredOwner(source: HaRecord): HaRecord {
  if (source.id !== FRONT_DOOR.coordinatorId) throw new Error('Unexpected coordinator identity.')
  const serialized = JSON.stringify(source)
  if (!serialized.includes('unsecured_while_away') && !serialized.includes('unsecured_away_35s')) {
    if (!String(source.description).includes(COORDINATOR_DELEGATION)) throw new Error('Coordinator lacks the managed delegation marker.')
    return structuredClone(source)
  }
  const config = structuredClone(source)
  if (!Array.isArray(config.triggers)) throw new Error('Coordinator triggers are not canonical.')
  const removed = config.triggers.filter((entry: HaRecord) => entry.id === 'unsecured_away_35s')
  if (removed.length !== 1 || removed[0].entity_id !== FRONT_DOOR.lock || removed[0].to !== 'unlocked') {
    throw new Error('Coordinator unsecured trigger drifted.')
  }
  config.triggers = config.triggers.filter((entry: HaRecord) => entry.id !== 'unsecured_away_35s')
  let classifiers = 0
  let priorities = 0
  let messages = 0
  const walk = (value: unknown, key = ''): unknown => {
    if (Array.isArray(value)) return value.map((entry) => walk(entry))
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([name, entry]) => [name, walk(entry, name)]))
    if (typeof value !== 'string') return value
    let result = value
    if (key === 'classification' && result.includes('unsecured_while_away')) {
      result = result.replace(/\{% elif ([^%]+)%\}unsecured_while_away\s*/g, (_match, predicate: string) => {
        const expected = `is_state('${FRONT_DOOR.presence}', 'not_home') and is_state('${FRONT_DOOR.contact}', 'off') and not is_state('${FRONT_DOOR.lock}', 'locked') and lock_age | float(0) >= 35`
        const actual = predicate.trim().replace(/\s+/g, ' ')
        const fallback = expected.replace(`not is_state('${FRONT_DOOR.lock}', 'locked')`, `is_state('${FRONT_DOOR.lock}', 'unlocked')`)
        if (actual !== expected && !(String(source.description).includes(COORDINATOR_FALLBACK) && actual === fallback)) {
          throw new Error('Coordinator unsecured classifier drifted.')
        }
        classifiers += 1
        return ''
      })
    }
    if (key === 'push_level') {
      result = result.replace(/\{% if c == 'unsecured_while_away' %\}(critical|passive)\{% elif /g, (_match, level: string) => {
        if (level === 'passive' && !String(source.description).includes(COORDINATOR_FALLBACK)) {
          throw new Error('Unrecognized coordinator priority override.')
        }
        priorities += 1
        return '{% if '
      })
    }
    if (key === 'plain_summary' || key === 'notification_title') {
      result = result.replace(/\{% elif c == 'unsecured_while_away' %\}[\s\S]*?(\{% (?:elif|else|endif))/g, (_match, next: string) => {
        messages += 1
        return next
      })
    }
    if (key === 'notification_url' && String(source.description).includes(COORDINATOR_FALLBACK)) {
      const prefix = `{% if classification | trim == 'unsecured_while_away' %}${FRONT_DOOR.url}{% else %}`
      if (result.startsWith(prefix) && result.endsWith('{% endif %}')) result = result.slice(prefix.length, -'{% endif %}'.length)
    }
    return result
      .replace(/,\s*'unsecured_while_away'|'unsecured_while_away',\s*/g, '')
      .replace(/,\s*'unsecured_away_35s'|'unsecured_away_35s',\s*/g, '')
  }
  const result = walk(config) as HaRecord
  if (classifiers !== 2 || priorities !== 2 || messages !== 4) {
    throw new Error(`Coordinator pass structure drifted (${classifiers}/${priorities}/${messages}).`)
  }
  if (/unsecured_while_away|unsecured_away_35s/.test(JSON.stringify(result))) throw new Error('Unrecognized unsecured coordinator reference remains.')
  result.description = `${String(source.description).replace(COORDINATOR_FALLBACK, '').trim()} ${COORDINATOR_DELEGATION}`
  return result
}

export function passiveCoordinatorFallback(source: HaRecord): HaRecord {
  if (source.id !== FRONT_DOOR.coordinatorId || !JSON.stringify(source).includes('unsecured_while_away')) {
    throw new Error('Fallback requires an original coordinator snapshot.')
  }
  if (String(source.description).includes(COORDINATOR_FALLBACK)) return structuredClone(source)
  const walk = (value: unknown, key = ''): unknown => {
    if (Array.isArray(value)) return value.map((entry) => walk(entry))
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([name, entry]) => [name, walk(entry, name)]))
    if (typeof value !== 'string') return value
    if (key === 'classification') return value.replace(`not is_state('${FRONT_DOOR.lock}', 'locked')`, `is_state('${FRONT_DOOR.lock}', 'unlocked')`)
    if (key === 'push_level') return value.replace("{% if c == 'unsecured_while_away' %}critical", "{% if c == 'unsecured_while_away' %}passive")
    if (key === 'notification_url') return `{% if classification | trim == 'unsecured_while_away' %}${FRONT_DOOR.url}{% else %}${value}{% endif %}`
    if (key === 'plain_summary') return value.replace('The front door is unlocked and nobody is home. Open Security to secure it.', 'Residents are away, and the front door is unlocked and closed. Guest mode could not be confirmed. Open Security to review the door.')
    return value
  }
  const result = walk(source) as HaRecord
  result.description = `${String(source.description).trim()} ${COORDINATOR_FALLBACK}`
  return result
}
