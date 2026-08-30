import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

const componentDirectory = resolve('home-assistant/custom_components/xbox')

const delegatedModules = new Map([
  ['__init__.py', 'from homeassistant.components.xbox import'],
  ['application_credentials.py', 'from homeassistant.components.xbox.application_credentials import'],
  ['binary_sensor.py', 'from homeassistant.components.xbox.binary_sensor import'],
  ['config_flow.py', 'from homeassistant.components.xbox.config_flow import'],
  ['diagnostics.py', 'from homeassistant.components.xbox.diagnostics import'],
  ['image.py', 'from homeassistant.components.xbox.image import'],
  ['media_player.py', 'from homeassistant.components.xbox.media_player import'],
  ['media_source.py', 'from homeassistant.components.xbox.media_source import'],
  ['remote.py', 'from homeassistant.components.xbox.remote import'],
  ['sensor.py', 'from homeassistant.components.xbox.sensor import'],
])

describe('temporary Xbox custom-component override', () => {
  it('pins only the upstream fixed python-xbox release in a versioned manifest', () => {
    const manifest = JSON.parse(readFileSync(resolve(componentDirectory, 'manifest.json'), 'utf8')) as {
      config_flow: boolean
      dependencies: string[]
      dhcp: unknown[]
      domain: string
      integration_type: string
      requirements: string[]
      ssdp: unknown[]
      version: string
    }

    expect(manifest).toMatchObject({
      config_flow: true,
      dependencies: ['application_credentials'],
      domain: 'xbox',
      integration_type: 'hub',
      requirements: ['python-xbox==0.2.1'],
      version: '0.1.0',
    })
    expect(manifest.dhcp).not.toHaveLength(0)
    expect(manifest.ssdp).not.toHaveLength(0)
  })

  it('delegates every directly loaded integration module to Home Assistant Core', () => {
    const pythonFiles = readdirSync(componentDirectory)
      .filter((file) => file.endsWith('.py'))
      .sort()

    expect(pythonFiles).toEqual([...delegatedModules.keys()].sort())
    for (const [file, expectedImport] of delegatedModules) {
      expect(readFileSync(resolve(componentDirectory, file), 'utf8')).toContain(expectedImport)
    }
  })

  it('patches null SmartGlass destinations before loading the built-in integration', () => {
    const init = readFileSync(resolve(componentDirectory, '__init__.py'), 'utf8')

    expect(init).toContain('destination_field.annotation = CommandDestination | None')
    expect(init).toContain('destination_field.default = None')
    expect(init).toContain('CommandResponse.model_rebuild(force=True)')
    expect(init.indexOf('CommandResponse.model_rebuild(force=True)'))
      .toBeLessThan(init.indexOf('from homeassistant.components.xbox import'))
  })

  it('preserves runtime translations and documents removal after the upstream fix', () => {
    expect(JSON.parse(readFileSync(resolve(componentDirectory, 'translations/en.json'), 'utf8')))
      .toEqual(JSON.parse(readFileSync(resolve(componentDirectory, 'strings.json'), 'utf8')))

    const readme = readFileSync(resolve(componentDirectory, 'README.md'), 'utf8')
    expect(readme).toContain('home-assistant/core#180295')
    expect(readme).toContain('destination')
    expect(readme).toContain('Remove this entire `custom_components/xbox` directory')
  })
})
