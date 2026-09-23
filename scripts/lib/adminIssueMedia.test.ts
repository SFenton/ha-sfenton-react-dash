import { describe, expect, it } from 'vitest'
import {
  discoverEmbeddedGitHubMedia,
  fetchGitHubMedia,
  MAX_GITHUB_MEDIA_BYTES,
  MAX_GITHUB_MEDIA_REFERENCES,
  redactSignedMediaUrls,
  stableGitHubMediaUrl,
  verifyGitHubMedia,
} from './adminIssueMedia'

const repository = 'SFenton/ha-sfenton-react-dash'
const imageUrl = 'https://github.com/user-attachments/assets/11111111-1111-1111-1111-111111111111'
const videoUrl = 'https://github.com/user-attachments/assets/22222222-2222-2222-2222-222222222222'
const pdfUrl = 'https://github.com/user-attachments/files/12345678/report.pdf'
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==',
  'base64',
)
const gif = Buffer.from('R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=', 'base64')

describe('GitHub issue media discovery', () => {
  it('recognizes the HTML image shape of an owner comment and GFM image references', () => {
    const body = [
      `<img width="3651" height="1822" alt="Image" src="${imageUrl}" />`,
      '',
      'Captured in fullscreen Edge.',
      '',
      '![Second image][second]',
      '',
      `[second]: ${imageUrl}`,
    ].join('\n')
    expect(discoverEmbeddedGitHubMedia(body, repository)).toEqual([
      { githubUrl: imageUrl, label: 'Image', occurrence: 0, placement: 'image' },
      { githubUrl: imageUrl, label: 'Second image', occurrence: 1, placement: 'image' },
    ])
  })

  it('finds linked documents, bare videos and nested HTML media without treating examples as uploads', () => {
    const body = [
      `[Report](${pdfUrl})`,
      '',
      videoUrl,
      '',
      `<details><picture><source srcset="${imageUrl} 2x"><img src="${imageUrl}"></picture></details>`,
      `<video src="${videoUrl}" poster="${imageUrl}"><source src="${videoUrl}"></video>`,
      '',
      '```html',
      `<img src="${imageUrl}">`,
      '```',
      '',
      `\`![not an image](${imageUrl})\``,
    ].join('\n')
    const references = discoverEmbeddedGitHubMedia(body, repository)
    expect(references.map((item) => [item.githubUrl, item.placement])).toEqual([
      [pdfUrl, 'link'],
      [videoUrl, 'link'],
      [imageUrl, 'image'],
      [imageUrl, 'image'],
      [videoUrl, 'video'],
      [imageUrl, 'image'],
      [videoUrl, 'video'],
    ])
    expect(references.map((item) => item.occurrence)).toEqual([0, 1, 2, 3, 4, 5, 6])
  })

  it('never persists a signed, external, private-network or relative embedded URL', () => {
    expect(stableGitHubMediaUrl(`${imageUrl}?jwt=signed-secret`, repository)).toBeUndefined()
    expect(stableGitHubMediaUrl('http://127.0.0.1:8123/api/camera', repository)).toBeUndefined()
    const found = discoverEmbeddedGitHubMedia([
      `<img src="${imageUrl}?jwt=signed-secret">`,
      '<img src="http://127.0.0.1:8123/api/camera">',
      '<img src="../relative.png">',
      `[ordinary link](https://github.com/${repository}/issues/1)`,
    ].join('\n'), repository)
    expect(found).toHaveLength(3)
    expect(found.every((item) => !item.githubUrl && Boolean(item.reason))).toBe(true)
    expect(JSON.stringify(found)).not.toContain('signed-secret')
    expect(JSON.stringify(found)).not.toContain('127.0.0.1')
  })

  it('fails loudly rather than silently truncating a long media list', () => {
    expect(() => discoverEmbeddedGitHubMedia(
      Array.from({ length: MAX_GITHUB_MEDIA_REFERENCES + 1 }, () => `![Image](${imageUrl})`).join('\n'),
      repository,
    )).toThrow('embedded media references')
  })

  it('recognizes audio sources while removing signed and inline media data from prompts', () => {
    expect(discoverEmbeddedGitHubMedia(
      `<audio controls><source src="${videoUrl}" type="audio/mpeg"></audio>`,
      repository,
    )).toMatchObject([{ placement: 'audio', githubUrl: videoUrl }])
    const sanitized = redactSignedMediaUrls(
      `<img src="${imageUrl}?jwt=private-secret"> data:image/png;base64,PRIVATE_IMAGE`,
    )
    expect(sanitized).not.toContain('private-secret')
    expect(sanitized).not.toContain('PRIVATE_IMAGE')
    expect(sanitized).toContain('[untrusted media URL redacted]')
    expect(redactSignedMediaUrls(`![safe](${imageUrl})`)).toContain(imageUrl)
  })
})

describe('bounded GitHub upload delivery', () => {
  it('authenticates only to GitHub and verifies bytes after a signed cross-origin redirect', async () => {
    const calls: Array<{ host: string; authorization: string | null }> = []
    const fetcher: typeof fetch = async (input, init) => {
      const url = new URL(String(input))
      calls.push({
        authorization: new Headers(init?.headers).get('authorization'),
        host: url.hostname,
      })
      if (calls.length === 1) {
        return new Response(null, {
          headers: {
            location: 'https://github-production-user-asset-6210df.s3.amazonaws.com/private?jwt=ephemeral',
          },
          status: 302,
        })
      }
      return new Response(new Uint8Array(png), {
        headers: { 'content-type': 'image/png' },
        status: 200,
      })
    }
    const result = await fetchGitHubMedia(imageUrl, repository, 'test-token', fetcher)
    expect(calls).toEqual([
      { authorization: 'Bearer test-token', host: 'github.com' },
      { authorization: null, host: 'github-production-user-asset-6210df.s3.amazonaws.com' },
    ])
    expect(result).toMatchObject({
      category: 'image',
      extension: '.png',
      mediaType: 'image/png',
      native: true,
      sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
    })
    expect(result.bytes).toEqual(png)
    expect(JSON.stringify({ ...result, bytes: undefined })).not.toContain('ephemeral')
  })

  it('rejects unapproved redirects without forwarding credentials or signed links', async () => {
    const fetcher: typeof fetch = async () => new Response(null, {
      headers: { location: 'http://127.0.0.1:8123/private?jwt=signed-secret' },
      status: 302,
    })
    await expect(fetchGitHubMedia(imageUrl, repository, 'test-token', fetcher))
      .rejects.toThrow('unapproved host')
  })

  it('rejects oversized, missing and type-confused downloads', async () => {
    await expect(fetchGitHubMedia(imageUrl, repository, 'test-token', async () =>
      new Response(new Uint8Array(png), {
        headers: { 'content-length': String(MAX_GITHUB_MEDIA_BYTES + 1) },
      }))).rejects.toThrow('per-file limit')
    await expect(fetchGitHubMedia(imageUrl, repository, 'test-token', async () =>
      new Response(null, { status: 404 }))).rejects.toThrow('HTTP 404')
    await expect(fetchGitHubMedia(imageUrl, repository, 'test-token', async () =>
      new Response(new Uint8Array(Buffer.from('%PDF-1.7\n%%EOF')), {
        headers: { 'content-type': 'image/png' },
      }))).rejects.toThrow('does not match its bytes')
  })

  it('classifies supported and unsupported uploads by bytes rather than filename alone', () => {
    expect(verifyGitHubMedia(Buffer.from('%PDF-1.7\n%%EOF'), pdfUrl, 'application/pdf'))
      .toMatchObject({ category: 'document', mediaType: 'application/pdf', native: false })
    expect(verifyGitHubMedia(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
      imageUrl, 'image/svg+xml'))
      .toMatchObject({ category: 'image', native: false, mediaType: 'image/svg+xml' })
    expect(verifyGitHubMedia(Buffer.from('000000186674797069736f6d', 'hex'),
      videoUrl, 'video/mp4'))
      .toMatchObject({ category: 'video', native: false, mediaType: 'video/mp4' })
    expect(verifyGitHubMedia(Buffer.from([0x50, 0x4b, 0x03, 0x04, 1]),
      pdfUrl, 'application/zip'))
      .toMatchObject({ category: 'archive', native: false, mediaType: 'application/zip' })
  })

  it('identifies GitHub-uploadable media, documents, text and archives without claiming to read them', () => {
    const zip = Buffer.from([0x50, 0x4b, 0x03, 0x04, 1])
    const examples: Array<{
      bytes: Buffer
      category: string
      mediaType: string
      url: string
    }> = [
      { bytes: gif, category: 'image', mediaType: 'image/gif', url: `${pdfUrl}.gif` },
      { bytes: Buffer.from('000000186674797071742020', 'hex'), category: 'video', mediaType: 'video/quicktime', url: `${videoUrl}.mov` },
      { bytes: Buffer.from('1a45dfa3', 'hex'), category: 'video', mediaType: 'video/webm', url: `${videoUrl}.webm` },
      { bytes: Buffer.from('ID3sample'), category: 'audio', mediaType: 'audio/mpeg', url: `${pdfUrl}.mp3` },
      { bytes: Buffer.from('524946460000000057415645', 'hex'), category: 'audio', mediaType: 'audio/wav', url: `${pdfUrl}.wav` },
      { bytes: Buffer.from('BMimage'), category: 'image', mediaType: 'image/bmp', url: `${pdfUrl}.bmp` },
      { bytes: Buffer.from('49492a00', 'hex'), category: 'image', mediaType: 'image/tiff', url: `${pdfUrl}.tiff` },
      { bytes: zip, category: 'document', mediaType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', url: `${pdfUrl}.docx` },
      { bytes: zip, category: 'document', mediaType: 'application/vnd.oasis.opendocument.text', url: `${pdfUrl}.odt` },
      { bytes: Buffer.from('d0cf11e0a1b11ae1', 'hex'), category: 'document', mediaType: 'application/msword', url: `${pdfUrl}.doc` },
      { bytes: Buffer.from('{\\rtf1 sample}'), category: 'document', mediaType: 'application/rtf', url: `${pdfUrl}.rtf` },
      { bytes: Buffer.from('test log\n'), category: 'text', mediaType: 'text/plain', url: `${pdfUrl}.log` },
      { bytes: zip, category: 'archive', mediaType: 'application/zip', url: `${pdfUrl}.zip` },
      { bytes: Buffer.from('1f8b0800', 'hex'), category: 'archive', mediaType: 'application/gzip', url: `${pdfUrl}.gz` },
    ]
    for (const example of examples) {
      const media = verifyGitHubMedia(example.bytes, example.url, example.mediaType)
      expect(media).toMatchObject({
        category: example.category,
        mediaType: example.mediaType,
        native: example.mediaType === 'image/gif',
      })
      if (!media.native) expect(media.reason).toContain('cannot be interpreted')
    }
    expect(() => verifyGitHubMedia(png.subarray(0, 16), imageUrl, 'image/png'))
      .toThrow('does not match its bytes')
    expect(() => verifyGitHubMedia(Buffer.from('%PDF-1.7\n'), pdfUrl, 'application/pdf'))
      .toThrow('does not match its bytes')
  })

  it('does not present an animated GIF or WebP as fully inspected native media', () => {
    const frame = gif.subarray(13, -1)
    const animatedGif = Buffer.concat([gif.subarray(0, 13), frame, frame, Buffer.from([0x3b])])
    expect(verifyGitHubMedia(animatedGif, `${pdfUrl}.gif`, 'image/gif')).toMatchObject({
      category: 'image',
      native: false,
      reason: expect.stringContaining('frames'),
    })
    const animatedWebp = Buffer.alloc(20)
    animatedWebp.write('RIFF')
    animatedWebp.writeUInt32LE(12, 4)
    animatedWebp.write('WEBP', 8)
    animatedWebp.write('ANIM', 12)
    expect(verifyGitHubMedia(animatedWebp, `${pdfUrl}.webp`, 'image/webp')).toMatchObject({
      native: false,
      reason: expect.stringContaining('frames'),
    })
    expect(() => verifyGitHubMedia(Buffer.from('GIF89a0;'), `${pdfUrl}.gif`, 'image/gif'))
      .toThrow('incomplete')
  })
})
