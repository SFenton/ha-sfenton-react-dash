import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { nextPatchVersion, recordImprovementRelease } from './release'

describe('Home MCP improvement releases', () => {
  it('increments patch versions', () => {
    expect(nextPatchVersion('1.4.9')).toBe('1.4.10')
  })

  it('keeps only the five latest nontechnical summaries', async () => {
    const root = await mkdtemp(join(tmpdir(), 'home-mcp-release-'))
    await mkdir(join(root, 'home-mcp'))
    await writeFile(join(root, 'home-mcp/metadata.json'), JSON.stringify({
      serverVersion: '0.2.4',
      improvements: Array.from({ length: 5 }, (_, index) => ({
        version: `0.2.${4 - index}`,
        publishedAt: '2026-09-10T12:00:00.000Z',
        summary: [`Improvement ${index}`],
      })),
    }))

    expect(await recordImprovementRelease(root, ['Understands another light request.'], '2026-09-10T13:00:00.000Z')).toBe('0.2.5')
    const metadata = JSON.parse(await readFile(join(root, 'home-mcp/metadata.json'), 'utf8'))
    expect(metadata.improvements).toHaveLength(5)
    expect(metadata.improvements[0]).toMatchObject({ version: '0.2.5', summary: ['Understands another light request.'] })
  })
})
