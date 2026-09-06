import { mockCallServiceCalls, mockState, resetMockHass, setMockCallServiceOutcome } from './hakitCoreState'

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
})
