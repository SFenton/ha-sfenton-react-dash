import { MANUAL_ARTICLES, MANUAL_SECTIONS } from './catalog'
import {
  collectManualRenderedTextSources,
  findManualLanguageQualityIssues,
  manualArticleRenderedTextValues,
  manualLanguageQualityIssues,
} from './languageQuality'
import { MANUAL_SCREENSHOTS } from './screenshots'

describe('App Manual household language quality', () => {
  it.each([
    ['bare React', 'React keeps this state locally.', 'bare React'],
    ['backend', 'Wait for the backend response.', 'backend'],
    ['ROOM_PAGE_CONFIGS', 'Compare ROOM_PAGE_CONFIGS before continuing.', 'ROOM_PAGE_CONFIGS'],
    ['Vite', 'Open the Vite preview.', 'Vite'],
    ['ha-evershelf', 'The ha-evershelf service owns this list.', 'ha-evershelf'],
    ['MQTT', 'The schedule is sent through MQTT.', 'MQTT'],
    ['mounted', 'The sheet remains mounted while closing.', 'mounted'],
    ['optimistic', 'An optimistic value appears first.', 'optimistic or optimistically'],
    ['optimistically', 'The row hides optimistically.', 'optimistic or optimistically'],
    ['coordinator', 'Check the vacuum coordinator.', 'coordinator or coordinators'],
    ['coordinators', 'The coordinators group nearby events.', 'coordinator or coordinators'],
  ])('rejects %s in rendered copy', (_name, value, expectedTerm) => {
    expect(findManualLanguageQualityIssues(value)).toContain(expectedTerm)
  })

  it('allows the full React Dash product name', () => {
    expect(findManualLanguageQualityIssues('Use React Dash to return to the in-app page.')).toEqual([])
  })

  it('covers structured guides and legacy or overview blocks that the page renders', () => {
    for (const kind of ['page-guide', 'family-guide', 'surface-guide', 'behavior-guide', 'task-guide'] as const) {
      const article = MANUAL_ARTICLES.find((candidate) => candidate.kind === kind)
      expect(article).toBeTruthy()
      expect(manualArticleRenderedTextValues(article!)).toContain(article!.summary)
    }

    const overview = MANUAL_ARTICLES.find((article) => article.blocks.some((block) => block.type === 'overview-purpose'))
    const legacy = MANUAL_ARTICLES.find((article) => article.blocks.some((block) => block.type === 'paragraph'))
    expect(overview).toBeTruthy()
    expect(legacy).toBeTruthy()
    expect(manualArticleRenderedTextValues(overview!)).toContain(
      overview!.blocks.find((block) => block.type === 'overview-purpose')!.text,
    )
    expect(manualArticleRenderedTextValues(legacy!)).toContain(
      legacy!.blocks.find((block) => block.type === 'paragraph')!.text,
    )
  })

  it('keeps all currently rendered manual article and section copy jargon-free', () => {
    expect(manualLanguageQualityIssues(
      collectManualRenderedTextSources(MANUAL_ARTICLES, MANUAL_SECTIONS, MANUAL_SCREENSHOTS),
    )).toEqual([])
  })
})
