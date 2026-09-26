// @covers scripts/deploy.ts
// @covers home-assistant/custom_components/sfenton_react_chat/__init__.py
// @covers home-assistant/custom_components/sfenton_react_chat/manifest.json
// @covers home-assistant/custom_components/sfenton_react_chat/retention.py
// @covers home-assistant/custom_components/sfenton_react_chat/services.yaml
// @covers home-assistant/packages/sfenton_react_chat.yaml
import { existsSync, readFileSync } from 'node:fs'

it('keeps managed HA components without restaging the retired chat integration', () => {
  const source = readFileSync('scripts/deploy.ts', 'utf8')
  expect(source).toContain('...ADMIN_TODO_PATHS')
  expect(source).toContain('...HOME_MCP_PROXY_PATHS')
  expect(source).toContain('await validateHomeAssistantConfig()')
  expect(source).not.toContain('sfenton_react_chat')
  for (const path of [
    'home-assistant/packages/sfenton_react_chat.yaml',
    'home-assistant/custom_components/sfenton_react_chat/__init__.py',
    'home-assistant/custom_components/sfenton_react_chat/manifest.json',
    'home-assistant/custom_components/sfenton_react_chat/retention.py',
    'home-assistant/custom_components/sfenton_react_chat/services.yaml',
  ]) expect(existsSync(path)).toBe(false)
})
