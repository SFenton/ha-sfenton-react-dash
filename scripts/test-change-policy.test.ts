import { execFileSync } from 'node:child_process'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  changedRepositoryPaths,
  implementationRequirement,
  testChangePolicyFailures,
  validateChangedTestPolicy,
} from './test-change-policy'

describe('changed-test policy', () => {
  it('classifies behavior-bearing repository paths', () => {
    expect(implementationRequirement('src/pages/HomePage.tsx')).toBe('app')
    expect(implementationRequirement('src/pages/HomePage.module.css')).toBe(
      'browser',
    )
    expect(implementationRequirement('src/styles/global.css')).toBe('browser')
    expect(implementationRequirement('src/i18n/locales/en.json')).toBe('app')
    expect(implementationRequirement('src/types/dashboard.d.ts')).toBeUndefined()
    expect(implementationRequirement('scripts/release-machine/driver.ts')).toBe(
      'tooling',
    )
    expect(
      implementationRequirement(
        'home-assistant/custom_components/example/__init__.py',
      ),
    ).toBe('ha')
    expect(implementationRequirement('home-mcp/light-skill.ts')).toBe('mcp')
    expect(implementationRequirement('docs/testing.md')).toBeUndefined()
    expect(
      implementationRequirement('src/pages/HomePage.test.tsx'),
    ).toBeUndefined()
    expect(
      implementationRequirement('home-assistant/tests/test_example.py'),
    ).toBeUndefined()
  })

  it('requires a changed application test for application behavior', () => {
    expect(testChangePolicyFailures(['src/pages/HomePage.tsx'])).toEqual([
      expect.stringContaining('application behavior'),
    ])
    expect(() =>
      validateChangedTestPolicy([
        'src/pages/HomePage.tsx',
        'src/pages/HomePage.test.tsx',
      ]),
    ).not.toThrow()
  })

  it('requires Playwright coverage for CSS behavior', () => {
    expect(
      testChangePolicyFailures([
        'src/pages/HomePage.module.css',
        'src/pages/HomePage.test.tsx',
      ]),
    ).toEqual([expect.stringContaining('CSS behavior')])
    expect(() =>
      validateChangedTestPolicy([
        'src/pages/HomePage.module.css',
        'e2e/responsive-layout.spec.ts',
      ], {
        coveredPaths: new Set(['src/pages/HomePage.module.css']),
      }),
    ).not.toThrow()
  })

  it('keeps tooling and Home Assistant test ownership distinct', () => {
    expect(
      testChangePolicyFailures([
        'scripts/release-machine/driver.ts',
        'src/pages/HomePage.test.tsx',
      ]),
    ).toEqual([expect.stringContaining('tooling behavior')])
    expect(() =>
      validateChangedTestPolicy([
        'scripts/release-machine/driver.ts',
        'scripts/release-machine/driver.test.ts',
        'home-assistant/custom_components/example/__init__.py',
        'scripts/lib/dashboardDeployment.test.ts',
      ], {
        coveredPaths: new Set([
          'home-assistant/custom_components/example/__init__.py',
        ]),
      }),
    ).not.toThrow()
  })

  it('rejects unrelated test-file churn', () => {
    expect(
      testChangePolicyFailures([
        'src/pages/HomePage.tsx',
        'src/pages/Unrelated.test.tsx',
      ]),
    ).toEqual([expect.stringContaining('src/pages/HomePage.tsx')])
  })

  it('recognizes conventional pytest ownership', () => {
    expect(() =>
      validateChangedTestPolicy([
        'home-assistant/tests/example.py',
        'home-assistant/tests/test_example.py',
      ]),
    ).not.toThrow()
  })

  it('accepts host-owned learned Home MCP regression coverage', async () => {
    const root = await mkdtemp(join(tmpdir(), 'test-change-policy-mcp-'))
    await mkdir(join(root, 'home-mcp/improvement/regressions'), { recursive: true })
    await writeFile(join(root, 'home-mcp/improvement/regressions/conversation.json'), JSON.stringify({
      coveredPaths: ['home-mcp/light-skill.ts'],
    }))
    expect(() => validateChangedTestPolicy([
      'home-mcp/light-skill.ts',
      'home-mcp/improvement/regressions/conversation.json',
    ], { root })).not.toThrow()
  })

  it('reads deleted learned-regression coverage from origin master during a revert', async () => {
    const root = await mkdtemp(join(tmpdir(), 'test-change-policy-mcp-revert-'))
    const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
    git('init', '-b', 'master')
    git('config', 'user.name', 'Test')
    git('config', 'user.email', 'test@example.invalid')
    await mkdir(join(root, 'home-mcp/improvement/regressions'), { recursive: true })
    await writeFile(join(root, 'home-mcp/light-skill.ts'), 'export const parser = true\n')
    await writeFile(join(root, 'home-mcp/improvement/regressions/conversation.json'), JSON.stringify({
      coveredPaths: ['home-mcp/light-skill.ts'],
    }))
    git('add', '.')
    git('commit', '-m', 'improvement')
    git('update-ref', 'refs/remotes/origin/master', 'HEAD')
    await rm(join(root, 'home-mcp/light-skill.ts'))
    await rm(join(root, 'home-mcp/improvement/regressions/conversation.json'))
    git('add', '-A')
    git('commit', '-m', 'revert improvement')

    expect(() => validateChangedTestPolicy(changedRepositoryPaths(root), { root })).not.toThrow()
  })

  it('includes committed branch changes when the worktree is clean', async () => {
    const root = await mkdtemp(join(tmpdir(), 'test-change-policy-'))
    const git = (...args: string[]) =>
      execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
    git('init', '-b', 'master')
    git('config', 'user.name', 'Test')
    git('config', 'user.email', 'test@example.invalid')
    await mkdir(join(root, 'src'))
    await writeFile(join(root, 'src', 'feature.ts'), 'export const value = 1\n')
    await writeFile(
      join(root, 'src', 'feature.test.ts'),
      'export const tested = true\n',
    )
    git('add', '.')
    git('commit', '-m', 'base')
    git('update-ref', 'refs/remotes/origin/master', 'HEAD')
    await writeFile(join(root, 'src', 'feature.ts'), 'export const value = 2\n')
    git('add', '.')
    git('commit', '-m', 'behavior without test')

    expect(changedRepositoryPaths(root)).toEqual(['src/feature.ts'])
    expect(() =>
      validateChangedTestPolicy(changedRepositoryPaths(root), { root }),
    ).toThrow('src/feature.ts')
  })

  it('allows documentation-only and test-only changes', () => {
    expect(() =>
      validateChangedTestPolicy([
        'docs/testing.md',
        '.github/PULL_REQUEST_TEMPLATE.md',
        'src/pages/HomePage.test.tsx',
      ]),
    ).not.toThrow()
  })
})
