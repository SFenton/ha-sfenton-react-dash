import type { DashboardRouteConfig } from '../constants/routes'
import type { ManualArticle, ManualPageGuideArticle } from './types'

/** Strict release contract: every dashboard route must have one exact page-guide binding. */
export const MANUAL_ROUTE_GUIDE_REMAINING_BUDGET = 0
export const ROOM_PAGE_GUIDE_NGRAM_SIZE = 5
export const ROOM_PAGE_GUIDE_SIMILARITY_THRESHOLD = 0.32

export interface ManualPageGuideRouteBinding {
  article: ManualPageGuideArticle
  route: DashboardRouteConfig
}

export function isManualPageGuideArticle(article: ManualArticle): article is ManualPageGuideArticle {
  return article.kind === 'page-guide'
}

export function manualPageGuideAuthoredTextValues(article: ManualPageGuideArticle) {
  const guide = article.pageGuide
  const automaticText = guide.whatHappensAutomatically.mode === 'automatic'
    ? guide.whatHappensAutomatically.items
    : [guide.whatHappensAutomatically.explanation]
  return [
    guide.orientation,
    ...guide.whatYouCanDo,
    ...automaticText,
    ...guide.lookHereFirst.flatMap((item) => [item.label, item.explanation]),
    guide.safetyAndLimitations.title,
    guide.safetyAndLimitations.text,
    ...guide.troubleshootingChecks,
  ]
}

export function manualPageGuideWordCount(article: ManualPageGuideArticle) {
  return manualPageGuideAuthoredTextValues(article).join(' ').trim().split(/\s+/).filter(Boolean).length
}

function normalizedWords(value: string) {
  return value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function roomNormalizationTerms(articles: readonly ManualPageGuideArticle[]) {
  return [...new Set(articles.flatMap((article) => {
    const guide = article.pageGuide
    return [
      guide.routePath,
      guide.generatedRoomPath,
      article.id.replace(/^room-/, ''),
      article.title.replace(/\s+page guide$/i, ''),
    ].filter((value): value is string => Boolean(value)).map(normalizedWords)
  }).filter((value) => value.length > 1))].sort((left, right) => right.length - left.length)
}

export function normalizedManualRoomPageGuideText(article: ManualPageGuideArticle, siblingArticles: readonly ManualPageGuideArticle[]) {
  let text = normalizedWords([
    article.summary,
    ...article.tasks,
    ...manualPageGuideAuthoredTextValues(article),
  ].join(' '))
  for (const term of roomNormalizationTerms(siblingArticles)) {
    text = ` ${text} `.replaceAll(` ${term} `, ' room ').trim()
  }
  return text.replace(/\s+/g, ' ')
}

function wordNgrams(value: string, size: number) {
  const words = value.split(/\s+/).filter(Boolean)
  if (words.length < size) return new Set(words.length ? [words.join(' ')] : [])
  return new Set(Array.from({ length: words.length - size + 1 }, (_, index) => words.slice(index, index + size).join(' ')))
}

export function manualRoomPageGuideSimilarity(
  left: ManualPageGuideArticle,
  right: ManualPageGuideArticle,
  siblingArticles: readonly ManualPageGuideArticle[],
) {
  const leftNgrams = wordNgrams(normalizedManualRoomPageGuideText(left, siblingArticles), ROOM_PAGE_GUIDE_NGRAM_SIZE)
  const rightNgrams = wordNgrams(normalizedManualRoomPageGuideText(right, siblingArticles), ROOM_PAGE_GUIDE_NGRAM_SIZE)
  const union = new Set([...leftNgrams, ...rightNgrams])
  if (union.size === 0) return 0
  let intersection = 0
  for (const ngram of leftNgrams) {
    if (rightNgrams.has(ngram)) intersection += 1
  }
  return intersection / union.size
}

export interface ManualRoomPageGuideSimilarityPair {
  leftArticleId: string
  rightArticleId: string
  similarity: number
}

export function manualRoomPageGuideSimilarityPairs(articles: readonly ManualArticle[]): ManualRoomPageGuideSimilarityPair[] {
  const roomArticles = articles.filter((article): article is ManualPageGuideArticle => (
    isManualPageGuideArticle(article) && Boolean(article.pageGuide.generatedRoomPath)
  ))
  return roomArticles.flatMap((left, leftIndex) => roomArticles.slice(leftIndex + 1).map((right) => ({
    leftArticleId: left.id,
    rightArticleId: right.id,
    similarity: manualRoomPageGuideSimilarity(left, right, roomArticles),
  })))
}

export function manualRoomPageGuideSimilarityViolations(articles: readonly ManualArticle[]) {
  return manualRoomPageGuideSimilarityPairs(articles)
    .filter((pair) => pair.similarity > ROOM_PAGE_GUIDE_SIMILARITY_THRESHOLD)
    .sort((left, right) => right.similarity - left.similarity)
}

export function completedManualPageGuideRouteBindings(
  routes: readonly DashboardRouteConfig[],
  articles: readonly ManualArticle[],
): ManualPageGuideRouteBinding[] {
  const articlesById = new Map(articles.map((article) => [article.id, article]))
  return routes.flatMap((route) => {
    const article = articlesById.get(route.manualArticleId)
    return article && isManualPageGuideArticle(article) && article.pageGuide.routePath === route.path
      ? [{ article, route }]
      : []
  })
}

export function remainingManualPageGuideRoutePaths(
  routes: readonly DashboardRouteConfig[],
  articles: readonly ManualArticle[],
) {
  const completedPaths = new Set(completedManualPageGuideRouteBindings(routes, articles).map(({ route }) => route.path))
  return routes.map((route) => route.path).filter((path) => !completedPaths.has(path))
}
