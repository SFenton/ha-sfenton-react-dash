import { createChatId } from './chatId'

describe('chat identities', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('uses native UUIDs when the secure-context API is available', () => {
    const randomUUID = vi.fn(() => 'native-uuid')
    vi.stubGlobal('crypto', { randomUUID })
    expect(createChatId()).toBe('native-uuid')
    expect(randomUUID).toHaveBeenCalledOnce()
  })

  it('uses cryptographic random bytes on plain-HTTP HA hosts without randomUUID', () => {
    let generation = 0
    const getRandomValues = vi.fn((bytes: Uint8Array) => {
      bytes.fill(++generation)
      return bytes
    })
    vi.stubGlobal('crypto', { getRandomValues })
    const first = createChatId()
    const second = createChatId()
    expect(first).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/)
    expect(second).not.toBe(first)
    expect(getRandomValues).toHaveBeenCalledTimes(2)
  })
})
