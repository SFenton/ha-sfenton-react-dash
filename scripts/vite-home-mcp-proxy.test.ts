import { configureHomeMcpProxy } from '../vite.config'

// @covers vite.config.ts
describe('Home MCP development proxy', () => {
  it('removes the browser Origin header before forwarding to the same-origin adapter', () => {
    let listener: ((request: { removeHeader: (name: string) => void }) => void) | undefined
    const proxy = {
      on: vi.fn((event: 'proxyReq', next: typeof listener) => {
        expect(event).toBe('proxyReq')
        listener = next
      }),
    }
    const removeHeader = vi.fn()

    configureHomeMcpProxy(proxy)
    listener?.({ removeHeader })

    expect(removeHeader).toHaveBeenCalledWith('origin')
  })
})
