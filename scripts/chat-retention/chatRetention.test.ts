import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const read = (path: string) => readFileSync(resolve(path), 'utf8')
const component = 'home-assistant/custom_components/sfenton_react_chat'

// @covers home-assistant/custom_components/sfenton_react_chat/__init__.py
// @covers home-assistant/packages/sfenton_react_chat.yaml
// @covers scripts/deploy.ts
describe('manual chat cleanup contract', () => {
  it('registers the cleanup service without scheduling deletion', () => {
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
    expect(yaml.trim()).toBe('sfenton_react_chat:')
    expect(yaml).not.toContain('automation:')
    expect(yaml).not.toContain('purge_expired_history')
    expect(read(`${component}/services.yaml`)).toContain('purge_expired_history:')
  })

  it('stages exact owned files with backup, validation, rollback and restart disclosure', () => {
    const deploy = read('scripts/deploy.ts')
    for (const file of ['__init__.py', 'manifest.json', 'services.yaml', 'retention.py', 'README.md']) {
      expect(deploy).toContain(`'${file}'`)
      expect(read(`${component}/${file}`).length).toBeGreaterThan(0)
    }
    expect(deploy).toContain('packages/sfenton_react_chat.yaml')
    for (const path of [
      'packages/sfenton_admin_todo.yaml',
      'custom_components/sfenton_admin_todo/__init__.py',
      'custom_components/sfenton_admin_todo/attachment_store.py',
      'custom_components/sfenton_admin_todo/manifest.json',
    ]) {
      expect(deploy).toContain(`'${path}'`)
      expect(read(`home-assistant/${path}`).length).toBeGreaterThan(0)
    }
    expect(deploy).toContain('custom_components/sfenton_home_mcp_proxy/home-mcp-server.crt')
    expect(deploy).toContain('`${file.path}.bak`')
    expect(deploy).toContain('await validateHomeAssistantConfig()')
    expect(deploy).toContain('await client.writeFile(file.path, file.previous)')
    expect(deploy).toContain('await client.unlink(file.path)')
    expect(deploy).toContain('rollback was incomplete')
    expect(deploy).toContain('verify the prior daily chat purge automation is absent')
    expect(deploy).toContain('verify authenticated Admin To-Do image filing')
    expect(deploy.indexOf('React assets were not uploaded.')).toBeLessThan(deploy.indexOf('Uploading'))
    expect(deploy).toContain('process.exitCode = 2')
    expect(read('.github/skills/release-dashboard/SKILL.md')).toContain('sfenton_react_chat')
  })

  it('stages the native Solo Trip package before deploying React assets', () => {
    const deploy = read('scripts/deploy.ts')
    for (const path of [
      'packages/solo_trip.yaml',
      'custom_templates/solo_trip.jinja',
      'solo_trip/stage_schedule_writer_migration_v1.yaml',
      'solo_trip/vacation_consumer_migration.yaml',
    ]) {
      expect(deploy).toContain(`'${path}'`)
      expect(read(`home-assistant/${path}`).length).toBeGreaterThan(0)
    }
    expect(deploy).toContain("await client.mkdir(`${configRoot}/custom_templates`")
    expect(deploy).toContain("await client.mkdir(`${configRoot}/solo_trip`")
    expect(deploy).toContain('const soloTripNativeChanged = changedConfig.some')
    expect(deploy).toContain('Restart Home Assistant with approval only after the native Solo Trip package')
    expect(deploy.indexOf('React assets were not uploaded.')).toBeLessThan(deploy.indexOf('Uploading'))
    expect(deploy).toContain('process.exitCode = 2')
  })
})
