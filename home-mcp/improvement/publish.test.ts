import { readFileSync } from 'node:fs'
import { mkdtemp, mkdir, readFile, readlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { restoreSourceLink, switchSourceLink } from './publish'

describe('Home MCP source switching', () => {
  it('migrates a legacy source directory and restores it during rollback', async () => {
    const root = await mkdtemp(join(tmpdir(), 'home-mcp-publish-'))
    const source = join(root, 'source')
    const release = join(root, 'releases/0.2.0')
    await mkdir(source, { recursive: true })
    await mkdir(release, { recursive: true })
    await writeFile(join(source, 'legacy.txt'), 'legacy')

    const previous = await switchSourceLink(root, release)
    expect(await readlink(source)).toBe('releases/0.2.0')

    await restoreSourceLink(root, previous)
    expect(await readFile(join(source, 'legacy.txt'), 'utf8')).toBe('legacy')
  })

  it('requires a healthy prior version after rollback', () => {
    const source = readFileSync('home-mcp/improvement/publish.ts', 'utf8')
    expect(source).toContain('waitForVersion(previousHealth.version')
    expect(source).toContain('Home MCP publish failed and rollback did not restore a healthy prior version')
  })
})
