import { createHash } from 'node:crypto'
import { marked } from 'marked'
import { parseFragment, type DefaultTreeAdapterMap } from 'parse5'

export const MAX_GITHUB_MEDIA_REFERENCES = 32
export const MAX_GITHUB_MEDIA_BYTES = 10 * 1024 * 1024
export const MAX_GITHUB_MEDIA_TOTAL_BYTES = 32 * 1024 * 1024

export type NativeMediaType =
  | 'image/png'
  | 'image/jpeg'
  | 'image/gif'
  | 'image/webp'

export type MediaPlacement = 'image' | 'video' | 'audio' | 'link'

export interface EmbeddedMediaReference {
  githubUrl?: string
  label: string
  occurrence: number
  placement: MediaPlacement
  reason?: string
}

export interface VerifiedMedia {
  bytes: Buffer
  category: 'image' | 'video' | 'audio' | 'document' | 'archive' | 'text' | 'unknown'
  extension?: string
  mediaType: string
  native: boolean
  reason?: string
  sha256: string
}

export function isNativeMedia(
  media: VerifiedMedia,
): media is VerifiedMedia & { extension: string; mediaType: NativeMediaType } {
  return media.native && Boolean(media.extension) && Object.hasOwn(nativeExtensions, media.mediaType)
}

export class GitHubMediaError extends Error {}

const nativeExtensions: Record<NativeMediaType, string> = {
  'image/gif': '.gif',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
}

const textExtensions = new Set([
  '.c', '.copilotmd', '.cpp', '.cpuprofile', '.cs', '.css', '.csv', '.drawio',
  '.eml', '.html', '.htm', '.ipynb', '.java', '.js', '.json', '.jsonc',
  '.log', '.md', '.patch', '.php', '.py', '.sh', '.sql', '.ts', '.tsx',
  '.tsv', '.txt', '.xml', '.yaml', '.yml',
])

const zippedDocuments: Record<string, string> = {
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.fodp': 'application/vnd.oasis.opendocument.presentation',
  '.fods': 'application/vnd.oasis.opendocument.spreadsheet',
  '.fodt': 'application/vnd.oasis.opendocument.text',
  '.odf': 'application/vnd.oasis.opendocument.formula',
  '.odg': 'application/vnd.oasis.opendocument.graphics',
  '.odp': 'application/vnd.oasis.opendocument.presentation',
  '.ods': 'application/vnd.oasis.opendocument.spreadsheet',
  '.odt': 'application/vnd.oasis.opendocument.text',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.xlsm': 'application/vnd.ms-excel.sheet.macroenabled.12',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}

const oleDocuments: Record<string, string> = {
  '.doc': 'application/msword',
  '.msg': 'application/vnd.ms-outlook',
  '.xls': 'application/vnd.ms-excel',
}

export function stableGitHubMediaUrl(value: string, repository: string) {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return undefined
  }
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.port ||
    url.search ||
    url.hash
  ) return undefined
  const [owner, repo] = repository.split('/')
  if (!owner || !repo || /%2f/i.test(url.pathname)) return undefined
  if (url.hostname === 'github.com') {
    const currentRepo = `/${owner}/${repo}/`
    const globalAttachment = /^\/user-attachments\/(?:assets\/[A-Za-z0-9-]+|files\/\d+\/[^/]+)$/
    const legacyRepoAttachment = (
      url.pathname.toLowerCase().startsWith(currentRepo.toLowerCase()) &&
      /^(?:assets\/\d+\/[A-Za-z0-9._-]+|files\/\d+\/[^/]+)$/.test(
        url.pathname.slice(currentRepo.length),
      )
    )
    if (globalAttachment.test(url.pathname) || legacyRepoAttachment) return url.href
  }
  if (
    url.hostname === 'user-images.githubusercontent.com' &&
    /^\/\d+\/[A-Za-z0-9/_.-]+$/.test(url.pathname)
  ) return url.href
  return undefined
}

export function redactSignedMediaUrls(body: string) {
  return body.replace(
    /(?:https?:\/\/|data:(?:image|video|audio)\/)[^\s<>"'`]+/gi,
    (value) => (
      value.toLowerCase().startsWith('data:') ||
      /[?&#](?:jwt|token|sig|signature|x-amz-signature)=/i.test(value)
    ) ? '[untrusted media URL redacted]' : value,
  )
}

export function discoverEmbeddedGitHubMedia(body: string, repository: string) {
  if (Buffer.byteLength(body, 'utf8') > 256 * 1024) {
    throw new GitHubMediaError('Issue text exceeds the media scanner limit')
  }
  const references: EmbeddedMediaReference[] = []
  const add = (href: string, label: string, placement: MediaPlacement) => {
    const githubUrl = stableGitHubMediaUrl(href, repository)
    if (!githubUrl && placement === 'link') return
    references.push({
      ...(githubUrl ? { githubUrl } : {
        reason: 'Embedded media URL is not a stable, approved GitHub attachment',
      }),
      label: label.replace(/\s+/g, ' ').trim().slice(0, 180) || 'Submitted media',
      occurrence: references.length,
      placement,
    })
    if (references.length > MAX_GITHUB_MEDIA_REFERENCES) {
      throw new GitHubMediaError(
        `Issue contains more than ${MAX_GITHUB_MEDIA_REFERENCES} embedded media references`,
      )
    }
  }
  const visitHtml = (node: DefaultTreeAdapterMap['node']) => {
    if ('tagName' in node) {
      const attribute = (name: string) => node.attrs.find((item) => item.name === name)?.value
      if (node.tagName === 'img') {
        const src = attribute('src')
        if (src) add(src, attribute('alt') ?? '', 'image')
      }
      if (node.tagName === 'video' || node.tagName === 'audio') {
        const src = attribute('src')
        if (src) add(src, attribute('title') ?? '', node.tagName)
      }
      if (node.tagName === 'source') {
        const src = attribute('src')
        const isAudio = attribute('type')?.toLowerCase().startsWith('audio/') ||
          (node.parentNode && 'tagName' in node.parentNode && node.parentNode.tagName === 'audio')
        const placement = isAudio ? 'audio' : 'video'
        if (src) add(src, '', placement)
      }
      if (node.tagName === 'source' || node.tagName === 'img') {
        const srcset = attribute('srcset')
        if (srcset) {
          for (const candidate of srcset.split(',')) {
            const src = candidate.trim().split(/\s+/)[0]
            if (src) add(src, '', 'image')
          }
        }
      }
      if (node.tagName === 'video') {
        const poster = attribute('poster')
        if (poster) add(poster, 'Video poster', 'image')
      }
      if (node.tagName === 'a') {
        const href = attribute('href')
        if (href) add(href, node.childNodes.map((child) =>
          'value' in child ? child.value : '').join(''), 'link')
      }
      if (node.tagName === 'script' || node.tagName === 'style') return
    }
    if ('childNodes' in node) node.childNodes.forEach(visitHtml)
  }
  marked.walkTokens(marked.lexer(body, { gfm: true }), (token) => {
    if (token.type === 'image' && typeof token.href === 'string') {
      add(token.href, token.text ?? '', 'image')
    } else if (token.type === 'link' && typeof token.href === 'string') {
      add(token.href, token.text ?? '', 'link')
    } else if (token.type === 'html') {
      parseFragment(token.raw).childNodes.forEach(visitHtml)
    }
  })
  return references
}

function detectedMediaType(bytes: Buffer, sourceUrl: string) {
  const filename = sourceUrl.slice(sourceUrl.lastIndexOf('/'))
  const extension = filename.match(/\.[a-z0-9]+$/i)?.[0].toLowerCase() ?? ''
  if (
    bytes.length >= 20 &&
    bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) &&
    bytes.subarray(-8).equals(Buffer.from([0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]))
  ) return 'image/png'
  if (
    bytes.length >= 4 &&
    bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff &&
    bytes.at(-2) === 0xff && bytes.at(-1) === 0xd9
  ) return 'image/jpeg'
  if (
    /^GIF8[79]a$/.test(bytes.subarray(0, 6).toString('ascii')) &&
    bytes.at(-1) === 0x3b
  ) return 'image/gif'
  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
    bytes.subarray(8, 12).toString('ascii') === 'WEBP' &&
    bytes.readUInt32LE(4) + 8 === bytes.length
  ) return 'image/webp'
  if (
    bytes.subarray(0, 5).toString('ascii') === '%PDF-' &&
    bytes.subarray(-1024).includes(Buffer.from('%%EOF'))
  ) return 'application/pdf'
  if (/^(?:<\?xml[^>]*>\s*)?<svg(?:\s|>)/i.test(bytes.subarray(0, 1024).toString('utf8').trim())) {
    return 'image/svg+xml'
  }
  if (bytes.subarray(0, 4).toString('hex') === '1a45dfa3') return 'video/webm'
  if (bytes.length >= 12 && bytes.subarray(4, 8).toString('ascii') === 'ftyp') {
    return bytes.subarray(8, 12).toString('ascii') === 'qt  ' ? 'video/quicktime' : 'video/mp4'
  }
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
    bytes.subarray(8, 12).toString('ascii') === 'WAVE') return 'audio/wav'
  if (
    bytes.subarray(0, 3).toString('ascii') === 'ID3' ||
    (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0 && extension === '.mp3')
  ) return 'audio/mpeg'
  if (bytes.subarray(0, 2).toString('ascii') === 'BM') return 'image/bmp'
  if (['49492a00', '4d4d002a'].includes(bytes.subarray(0, 4).toString('hex'))) return 'image/tiff'
  if (bytes.subarray(0, 4).toString('hex') === '504b0304') {
    return zippedDocuments[extension] ?? 'application/zip'
  }
  if (bytes.subarray(0, 2).toString('hex') === '1f8b') return 'application/gzip'
  if (bytes.subarray(0, 8).toString('hex') === 'd0cf11e0a1b11ae1') {
    return oleDocuments[extension] ?? 'application/x-ole-storage'
  }
  if (bytes.subarray(0, 5).toString('ascii') === '{\\rtf') return 'application/rtf'
  if (textExtensions.has(extension) && !bytes.includes(0)) {
    try {
      new TextDecoder('utf-8', { fatal: true }).decode(bytes)
      return 'text/plain'
    } catch {
      throw new GitHubMediaError('GitHub text attachment is not valid UTF-8')
    }
  }
  return 'application/octet-stream'
}

function gifFrameCount(bytes: Buffer) {
  if (bytes.length < 14) throw new GitHubMediaError('GitHub GIF attachment is incomplete')
  let offset = 13
  if (bytes[10] & 0x80) offset += 3 * 2 ** ((bytes[10] & 0x07) + 1)
  let frames = 0
  while (offset < bytes.length) {
    const marker = bytes[offset++]
    if (marker === 0x3b) {
      if (offset !== bytes.length || frames === 0) {
        throw new GitHubMediaError('GitHub GIF attachment has invalid frame data')
      }
      return frames
    }
    if (marker === 0x21) {
      if (offset >= bytes.length) throw new GitHubMediaError('GitHub GIF extension is incomplete')
      offset += 1
    } else if (marker === 0x2c) {
      if (offset + 9 >= bytes.length) {
        throw new GitHubMediaError('GitHub GIF frame header is incomplete')
      }
      const flags = bytes[offset + 8]
      offset += 9
      if (flags & 0x80) offset += 3 * 2 ** ((flags & 0x07) + 1)
      offset += 1
      frames += 1
    } else {
      throw new GitHubMediaError('GitHub GIF attachment has an invalid block')
    }
    while (offset < bytes.length) {
      const size = bytes[offset++]
      if (size === 0) break
      offset += size
      if (offset > bytes.length) throw new GitHubMediaError('GitHub GIF block is incomplete')
    }
  }
  throw new GitHubMediaError('GitHub GIF attachment is missing its trailer')
}

export function verifyGitHubMedia(
  bytes: Buffer,
  sourceUrl: string,
  responseType: string | null,
): VerifiedMedia {
  if (bytes.length === 0 || bytes.length > MAX_GITHUB_MEDIA_BYTES) {
    throw new GitHubMediaError('GitHub attachment size is outside the safe per-file limit')
  }
  const mediaType = detectedMediaType(bytes, sourceUrl)
  const declaredType = responseType?.split(';')[0].trim().toLowerCase()
  if (
    declaredType &&
    !['application/octet-stream', 'binary/octet-stream'].includes(declaredType) &&
    declaredType !== mediaType &&
    !(declaredType === 'application/x-gzip' && mediaType === 'application/gzip') &&
    !(mediaType === 'text/plain' &&
      (declaredType.startsWith('text/') ||
        ['application/json', 'application/xml', 'application/yaml', 'message/rfc822']
          .includes(declaredType))) &&
    !(mediaType === 'application/rtf' && declaredType === 'text/rtf') &&
    !(mediaType === 'audio/wav' && declaredType === 'audio/x-wav') &&
    !(Object.values(zippedDocuments).includes(mediaType) && declaredType === 'application/zip')
  ) {
    throw new GitHubMediaError('GitHub attachment content type does not match its bytes')
  }
  const animated = mediaType === 'image/gif'
    ? gifFrameCount(bytes) > 1
    : mediaType === 'image/webp' && bytes.subarray(12).includes(Buffer.from('ANIM'))
  const native = Object.hasOwn(nativeExtensions, mediaType) && !animated
  const category = mediaType.startsWith('image/') ? 'image'
    : mediaType.startsWith('video/') ? 'video'
      : mediaType.startsWith('audio/') ? 'audio'
        : mediaType === 'application/pdf' ||
          Object.values(zippedDocuments).includes(mediaType) ||
          Object.values(oleDocuments).includes(mediaType) ||
          mediaType === 'application/rtf' ? 'document'
          : mediaType === 'application/zip' || mediaType === 'application/gzip' ? 'archive'
            : mediaType === 'text/plain' ? 'text'
              : 'unknown'
  return {
    bytes,
    category,
    ...(native ? { extension: nativeExtensions[mediaType as NativeMediaType] } : {}),
    mediaType,
    native,
    ...(native ? {} : {
      reason: animated
        ? 'Animated media frames cannot be fully inspected by the configured model'
        : `${category === 'unknown' ? 'Unknown' : category} attachment cannot be interpreted by the configured model`,
    }),
    sha256: createHash('sha256').update(bytes).digest('hex'),
  }
}

const redirectHosts = new Set([
  'github.com',
  'github-production-user-asset-6210df.s3.amazonaws.com',
  'objects.githubusercontent.com',
  'private-user-images.githubusercontent.com',
  'user-images.githubusercontent.com',
])

export async function fetchGitHubMedia(
  githubUrl: string,
  repository: string,
  token: string,
  fetcher: typeof fetch = fetch,
) {
  if (stableGitHubMediaUrl(githubUrl, repository) !== githubUrl) {
    throw new GitHubMediaError('GitHub attachment URL is not a stable approved upload')
  }
  let current = new URL(githubUrl)
  for (let redirects = 0; redirects <= 5; redirects += 1) {
    if (!redirectHosts.has(current.hostname) || current.protocol !== 'https:' ||
      current.username || current.password || current.port) {
      throw new GitHubMediaError('GitHub attachment redirected to an unapproved host')
    }
    let response: Response
    try {
      response = await fetcher(current, {
        headers: redirects === 0 && current.hostname === 'github.com'
          ? { Accept: 'application/octet-stream,image/*,application/pdf', Authorization: `Bearer ${token}` }
          : { Accept: 'application/octet-stream,image/*,application/pdf' },
        redirect: 'manual',
        signal: AbortSignal.timeout(20_000),
      })
    } catch {
      throw new GitHubMediaError('GitHub attachment request failed before verification')
    }
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location')
      await response.body?.cancel()
      if (!location) throw new GitHubMediaError('GitHub attachment redirect is missing a destination')
      try {
        current = new URL(location, current)
      } catch {
        throw new GitHubMediaError('GitHub attachment redirect is invalid')
      }
      continue
    }
    if (!response.ok || !response.body) {
      throw new GitHubMediaError(`GitHub attachment returned HTTP ${response.status}`)
    }
    const length = Number(response.headers.get('content-length'))
    if (Number.isFinite(length) && length > MAX_GITHUB_MEDIA_BYTES) {
      await response.body.cancel()
      throw new GitHubMediaError('GitHub attachment exceeds the safe per-file limit')
    }
    const chunks: Buffer[] = []
    let total = 0
    try {
      for await (const chunk of response.body) {
        const next = Buffer.from(chunk)
        total += next.length
        if (total > MAX_GITHUB_MEDIA_BYTES) {
          throw new GitHubMediaError('GitHub attachment exceeds the safe per-file limit')
        }
        chunks.push(next)
      }
    } catch (error) {
      if (error instanceof GitHubMediaError) throw error
      throw new GitHubMediaError('GitHub attachment download failed before verification')
    }
    return verifyGitHubMedia(Buffer.concat(chunks), githubUrl, response.headers.get('content-type'))
  }
  throw new GitHubMediaError('GitHub attachment exceeded the redirect limit')
}
