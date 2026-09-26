import { mockCallServiceCalls, mockState, resetMockHass, setMockCallServiceOutcome, type MockHassDebugApi } from './hakitCoreState'

// @covers src/test/mocks/chatServer.ts
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
  it('does not expose the removed chat transport through the dashboard mock', async () => {
    expect((window as unknown as { __mockHass: MockHassDebugApi }).__mockHass).not.toHaveProperty('chat')
    await expect(mockState.connection.subscribeMessage(() => undefined, {
      type: 'frontend/subscribe_user_data',
    })).rejects.toThrow('Unsupported mocked subscription')
  })
})
