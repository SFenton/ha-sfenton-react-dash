import { normalizedUrl, restoreSourceDeclaredBackdropFilters, selectedParityRoutes } from './required-mobile-parity'

describe('required mobile parity inputs', () => {
  it('restores only the dropped standard filter with the existing declared value and context', () => {
    const source = '@media(min-width:1px){.tile{color:red;-webkit-backdrop-filter:blur(15px)}}.kept{backdrop-filter:none;-webkit-backdrop-filter:blur(3px)}'
    expect(restoreSourceDeclaredBackdropFilters(source)).toEqual({
      css: '@media(min-width:1px){.tile{color:red;-webkit-backdrop-filter:blur(15px);backdrop-filter:blur(15px)}}.kept{backdrop-filter:none;-webkit-backdrop-filter:blur(3px)}',
      repairs: [{ selector: '.tile', value: 'blur(15px)' }],
    })
    expect(restoreSourceDeclaredBackdropFilters('.tile{color:red}')).toEqual({ css: '.tile{color:red}', repairs: [] })
  })
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
