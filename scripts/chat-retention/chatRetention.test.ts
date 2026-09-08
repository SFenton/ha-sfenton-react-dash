import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const read = (path: string) => readFileSync(resolve(path), 'utf8')
const component = 'home-assistant/custom_components/sfenton_react_chat'

describe('HA-owned chat retention contract', () => {
  it('registers a fixed-policy service through ordinary YAML setup', () => {
    expect(JSON.parse(read(`${component}/manifest.json`))).toMatchObject({
      domain: 'sfenton_react_chat', version: '1.0.0', dependencies: ['frontend'],
      integration_type: 'service', iot_class: 'local_push', codeowners: ['@SFenton'],
    })
    const source = read(`${component}/__init__.py`)
    expect(source).toContain('CONFIG_SCHEMA = cv.empty_config_schema(DOMAIN)')
    expect(source).toContain('await hass.auth.async_get_users()')
    expect(source).toContain('await async_user_store(hass, user.id)')
    expect(source).toContain('await store.async_set_item(key, None)')
    expect(source).toContain('async with lock:')
    expect(source).toContain('schema=vol.Schema({})')
    expect(source).toContain('raise HomeAssistantError')
    expect(source).not.toMatch(/store\.data\s*\[.*\]\s*=|store\.data\.(?:pop|clear|update)|store\._store|["']\.storage|except (?:Exception|BaseException)/)
    expect(source).not.toMatch(/_LOGGER\.[a-z]+\([^)]*(?:user\.id|keys|error)/s)
    const yaml = read('home-assistant/packages/sfenton_react_chat.yaml')
    expect(yaml).toContain('sfenton_react_chat:')
    expect(yaml).toContain('at: "03:15:00"')
    expect(yaml).toContain('action: sfenton_react_chat.purge_expired_history')
    expect(yaml).toContain('mode: single')
    expect(read(`${component}/services.yaml`)).toContain('purge_expired_history:')
  })

  it('stages exact owned files with backup, validation, rollback and restart disclosure', () => {
    const deploy = read('scripts/deploy.ts')
    for (const file of ['__init__.py', 'manifest.json', 'services.yaml', 'retention.py', 'README.md']) {
      expect(deploy).toContain(`'${file}'`)
      expect(read(`${component}/${file}`).length).toBeGreaterThan(0)
    }
    expect(deploy).toContain('packages/sfenton_react_chat.yaml')
    expect(deploy).toContain('`${file.path}.bak`')
    expect(deploy).toContain('await validateHomeAssistantConfig()')
    expect(deploy).toContain('await client.writeFile(file.path, file.previous)')
    expect(deploy).toContain('await client.unlink(file.path)')
    expect(deploy).toContain('rollback was incomplete')
    expect(deploy).toContain('retention is not yet confirmed active')
    expect(read('.github/skills/release-dashboard/SKILL.md')).toContain('sfenton_react_chat')
  })
})
