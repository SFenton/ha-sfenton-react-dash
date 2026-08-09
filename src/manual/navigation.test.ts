import { manualSelectionFromUrl, manualUrl } from './navigation'

describe('manual navigation', () => {
  it('reads section and article deep links', () => {
    expect(manualSelectionFromUrl('/sfenton-react-dash/home?path=manual&manual-section=systems&manual-article=presence-based-lighting')).toEqual({
      articleId: 'presence-based-lighting',
      sectionId: 'systems',
    })
  })

  it('builds wrapper-safe manual URLs and clears older manual selection', () => {
    expect(manualUrl('/sfenton-react-dash/home?v=one&path=settings', { sectionId: 'devices' })).toBe('/sfenton-react-dash/home?v=one&path=manual&manual-section=devices')
    expect(manualUrl('/sfenton-react-dash/home?path=manual&manual-section=devices', { articleId: 'glossary', sectionId: 'reference' })).toBe('/sfenton-react-dash/home?path=manual&manual-section=reference&manual-article=glossary')
    expect(manualUrl('/local/ha-sfenton-react-dash/index.html?v=one&path=manual&manual-article=glossary')).toBe('/local/ha-sfenton-react-dash/index.html?v=one&path=manual')
  })
})
