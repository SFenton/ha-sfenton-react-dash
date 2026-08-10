import {
  APP_MANUAL_ARTICLE_QUERY_KEY,
  APP_MANUAL_QUERY_KEYS,
  APP_MANUAL_ROUTE_PATH,
  APP_MANUAL_SECTION_QUERY_KEY,
  APP_MANUAL_TASK_SECTION_QUERY_KEY,
  routeUrl,
} from '../constants/routes'

const URL_ORIGIN = 'http://ha-sfenton-react-dash.local'

export interface ManualSelection {
  articleId?: string
  sectionId?: string
  taskSectionId?: string
}

function relativeUrl(url: URL) {
  return `${url.pathname}${url.search}${url.hash}`
}

export function manualSelectionFromUrl(value: string | undefined): ManualSelection {
  if (!value) return {}
  const url = new URL(value, URL_ORIGIN)
  return {
    articleId: url.searchParams.get(APP_MANUAL_ARTICLE_QUERY_KEY) ?? undefined,
    sectionId: url.searchParams.get(APP_MANUAL_SECTION_QUERY_KEY) ?? undefined,
    taskSectionId: url.searchParams.get(APP_MANUAL_TASK_SECTION_QUERY_KEY) ?? undefined,
  }
}

export function manualUrl(currentUrl: string | undefined, selection: ManualSelection = {}) {
  const baseUrl = routeUrl(APP_MANUAL_ROUTE_PATH, currentUrl)
  const url = new URL(baseUrl, URL_ORIGIN)
  for (const key of APP_MANUAL_QUERY_KEYS) url.searchParams.delete(key)
  if (selection.sectionId) url.searchParams.set(APP_MANUAL_SECTION_QUERY_KEY, selection.sectionId)
  if (selection.articleId) url.searchParams.set(APP_MANUAL_ARTICLE_QUERY_KEY, selection.articleId)
  if (selection.taskSectionId) url.searchParams.set(APP_MANUAL_TASK_SECTION_QUERY_KEY, selection.taskSectionId)
  url.hash = ''
  return relativeUrl(url)
}
