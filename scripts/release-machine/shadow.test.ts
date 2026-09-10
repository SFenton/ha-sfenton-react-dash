import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  calculateReleaseScopeHash,
} from './contracts'
import { runShadowRelease } from './shadow'

describe('shadow release planning', () => {
  it('writes the deterministic plan and fault matrix', async () => {
    const repository = await mkdtemp(join(tmpdir(), 'release-shadow-'))
    const input = {
      version: 1 as const,
      variant: 'repository-only' as const,
      repository,
      baseRevision: 'a'.repeat(40),
      scopePaths: ['docs/release.md'],
      branch: 'copilot/release-shadow-test',
      evidenceDirectory: join(repository, 'artifacts', 'release', 'shadow'),
    }
    const contextPath = join(repository, 'context.json')
    await writeFile(
      contextPath,
      JSON.stringify({
        ...input,
        scopeHash: await calculateReleaseScopeHash(input),
      }),
    )
    await expect(runShadowRelease(contextPath)).resolves.toMatchObject({
      status: 'shadow-ready',
      variant: 'repository-only',
    })
    const evidence = JSON.parse(
      await readFile(
        join(input.evidenceDirectory, 'shadow-plan.json'),
        'utf8',
      ),
    ) as { faultMatrix: unknown[] }
    expect(evidence.faultMatrix.length).toBeGreaterThan(0)
  })
})
