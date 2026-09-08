import { mockCallServiceCalls, mockState, resetMockHass, setMockCallServiceOutcome, type MockHassDebugApi } from './hakitCoreState'
import { mockChatServer } from './chatServer'

describe('helper service outcome fixtures', () => {
  beforeEach(resetMockHass)
  it('rejects helper calls as well as websocket calls without losing the intent log', async () => {
    setMockCallServiceOutcome('todo', 'add_item', 'reject')
    const command = { domain: 'todo', service: 'add_item', target: 'todo.example', serviceData: { item: 'Fixture draft' } }
    await expect(mockState.helpers.callService(command)).rejects.toThrow('Mock service rejection')
    expect(mockCallServiceCalls).toEqual([command])
  })
  it('holds pending calls and resets outcomes between fresh fixtures', async () => {
    setMockCallServiceOutcome('todo', 'add_item', 'pending')
    const command = { domain: 'todo', service: 'add_item' }
    const pending = Promise.resolve(mockState.helpers.callService(command))
    expect(await Promise.race([pending.then(() => true), Promise.resolve(false)])).toBe(false)
    resetMockHass()
    await expect(Promise.resolve(mockState.helpers.callService(command))).resolves.toBeUndefined()
  })
  it('provides an explicit empty Weather fixture and restores it on reset', async () => {
    ;(window as unknown as { __mockHass: MockHassDebugApi }).__mockHass.clearWeatherForecasts()
    const request = { domain: 'weather', service: 'get_forecasts', target: 'weather.pirate_weather', serviceData: { type: 'daily' }, returnResponse: true }
    await expect(mockState.helpers.callService(request)).resolves.toEqual({ response: { 'weather.pirate_weather': { forecast: [] } } })
    resetMockHass()
    const restored = await mockState.helpers.callService(request) as { response: { 'weather.pirate_weather': { forecast: unknown[] } } }
    expect(restored.response['weather.pirate_weather'].forecast).toHaveLength(7)
  })
  it('repairs only the current mock account chat namespace without importing new product modules', () => {
    const userId = mockState.user!.id
    mockChatServer.seed(userId, { theme: 'retained', 'another-app.setting': true, 'react-dash.chat.v9.old': { version: 9 } })
    mockChatServer.seed('another-user', { 'react-dash.chat.v1.other': { retained: true } })
    const api = (window as unknown as { __mockHass: { chat: { replaceRecords: (records: Record<string, unknown>) => void } } }).__mockHass
    api.chat.replaceRecords({ 'react-dash.chat.v1.repaired': { version: 1 } })
    expect(mockChatServer.data(userId)).toEqual({
      theme: 'retained', 'another-app.setting': true, 'react-dash.chat.v1.repaired': { version: 1 },
    })
    expect(mockChatServer.data('another-user')).toEqual({ 'react-dash.chat.v1.other': { retained: true } })
  })
})
