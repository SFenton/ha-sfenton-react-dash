import { normalizedUrl, selectedParityRoutes } from './required-mobile-parity'

describe('required mobile parity inputs', () => {
  it('selects exact known routes and rejects unknown-only and empty loops', () => {
    expect(selectedParityRoutes(undefined, ['overview', 'to-do'])).toEqual(['overview', 'to-do'])
    expect(selectedParityRoutes('to-do', ['overview', 'to-do'])).toEqual(['to-do'])
    for (const raw of ['', 'unknown', 'overview,', 'overview,overview']) {
      expect(() => selectedParityRoutes(raw, ['overview', 'to-do'])).toThrow()
    }
    expect(() => selectedParityRoutes(undefined, [])).toThrow()
  })
  it('requires loopback, noncredential endpoints rather than arbitrary reachable servers', () => {
    expect(normalizedUrl('http://127.0.0.1:12345/', 'candidate URL')).toBe('http://127.0.0.1:12345')
    for (const raw of [undefined, 'https://example.invalid', 'file:///index.html', 'http://user:secret@127.0.0.1:12345', 'http://127.0.0.1:12345/?token=secret']) {
      expect(() => normalizedUrl(raw, 'candidate URL')).toThrow()
    }
  })
})
