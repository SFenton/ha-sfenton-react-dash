import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export type TestChangeRequirement = 'app' | 'browser' | 'ha' | 'mcp' | 'tooling'

const TEST_PATH =
  /(?:^|\/)(?:[^/]+\.(?:test|spec)\.[cm]?[jt]sx?|(?:test_[^/]+|[^/]+\.(?:test|spec))\.py|home-mcp\/improvement\/regressions\/[^/]+\.json)$/

function isTestPath(path: string) {
  return TEST_PATH.test(path)
}

export function implementationRequirement(
  path: string,
): TestChangeRequirement | undefined {
  if (isTestPath(path)) return undefined
  if (/^src\/.+\.d\.ts$/.test(path)) return undefined
  if (/^src\/.+\.css$/.test(path)) return 'browser'
  if (/^src\/i18n\/locales\/.+\.json$/.test(path)) return 'app'
  if (/^src\/.+\.[jt]sx?$/.test(path)) return 'app'
  if (/^scripts\/.+\.(?:[cm]?[jt]sx?|sh)$/.test(path)) return 'tooling'
  if (/^home-mcp\/.+\/types\.ts$/.test(path)) return undefined
  if (/^home-mcp\/.+\.[cm]?[jt]s$/.test(path)) return 'mcp'
  if (/^home-assistant\/.+\.(?:json|py|[cm]?[jt]sx?|ya?ml)$/.test(path)) {
    return 'ha'
  }
  if (/^vite\.config\.[cm]?[jt]s$/.test(path)) return 'tooling'
  return undefined
}

function eligibleTest(requirement: TestChangeRequirement, path: string) {
  if (!isTestPath(path)) return false
  if (requirement === 'browser') {
    return path.startsWith('e2e/') && /\.spec\.[jt]s$/.test(path)
  }
  if (requirement === 'app') {
    return path.startsWith('src/') || path.startsWith('e2e/')
  }
  if (requirement === 'tooling') return path.startsWith('scripts/')
  if (requirement === 'mcp') return path.startsWith('home-mcp/')
  return path.startsWith('home-assistant/') || path.startsWith('scripts/')
}

function sourceStem(path: string) {
  return path
    .replace(/\.(?:module\.)?css$/, '')
    .replace(/\.[cm]?[jt]sx?$/, '')
    .replace(/\.py$/, '')
}

function testStem(path: string) {
  return path
    .replace(/\/test_([^/]+)\.py$/, '/$1')
    .replace(/\.(?:test|spec)\.[cm]?[jt]sx?$/, '')
    .replace(/\.(?:test|spec)\.py$/, '')
}

function annotations(root: string | undefined, tests: readonly string[]) {
  const covered = new Set<string>()
  if (!root) return covered
  const record = (test: string, source: string) => {
    if (test.endsWith('.json')) {
      const value = JSON.parse(source) as { coveredPaths?: unknown }
      if (Array.isArray(value.coveredPaths)) {
        for (const path of value.coveredPaths) if (typeof path === 'string') covered.add(path.replaceAll('\\', '/'))
      }
    }
    for (const match of source.matchAll(/@covers\s+([^\s*]+)/g)) {
      if (match[1]) covered.add(match[1].replaceAll('\\', '/'))
    }
  }
  for (const test of tests) {
    try {
      const source = readFileSync(resolve(root, test), 'utf8')
      record(test, source)
    } catch {
      try {
        record(test, execFileSync('git', ['-C', root, 'show', `origin/master:${test}`], { encoding: 'utf8' }))
      } catch {
        // Deleted tests can still match a deleted implementation by path stem.
      }
    }
  }
  return covered
}

const REQUIREMENT_COPY: Record<TestChangeRequirement, string> = {
  app: 'application behavior requires a changed src unit test or e2e Playwright spec',
  browser: 'CSS behavior requires a changed e2e Playwright spec',
  ha: 'Home Assistant behavior requires a changed HA or scripts test',
  mcp: 'Home MCP behavior requires a changed Home MCP test or learned regression fixture',
  tooling: 'tooling behavior requires a changed scripts test',
}

export function testChangePolicyFailures(
  paths: readonly string[],
  options: { root?: string; coveredPaths?: ReadonlySet<string> } = {},
) {
  const normalized = [...new Set(paths.map((path) => path.replaceAll('\\', '/')))]
  const tests = normalized.filter(isTestPath)
  const covered = new Set([
    ...annotations(options.root, tests),
    ...(options.coveredPaths ?? []),
  ])
  return normalized.flatMap((path) => {
    const requirement = implementationRequirement(path)
    if (!requirement) return []
    const owned = tests.some(
      (test) =>
        eligibleTest(requirement, test) &&
        (testStem(test) === sourceStem(path) || covered.has(path)),
    )
    return owned ? [] : [`${path}: ${REQUIREMENT_COPY[requirement]}`]
  })
}

export function validateChangedTestPolicy(
  paths: readonly string[],
  options: { root?: string; coveredPaths?: ReadonlySet<string> } = {},
) {
  const failures = testChangePolicyFailures(paths, options)
  if (failures.length) {
    throw new Error(
      ['Changed implementation files require changed tests:', ...failures.map(
        (failure) => `- ${failure}`,
      )].join('\n'),
    )
  }
}

function gitLines(root: string, args: string[]) {
  return execFileSync('git', ['-C', root, ...args], {
    encoding: 'utf8',
  })
    .trim()
    .split('\n')
    .filter(Boolean)
}

export function changedRepositoryPaths(
  root: string,
  baseRevision?: string,
) {
  const tracked = baseRevision
    ? gitLines(root, [
        'diff',
        '--name-only',
        '--diff-filter=ACMRTD',
        `${baseRevision}...HEAD`,
      ])
    : gitLines(root, [
        'diff',
        '--name-only',
        '--diff-filter=ACMRTD',
        'HEAD',
      ])
  const untracked = baseRevision
    ? []
    : gitLines(root, ['ls-files', '--others', '--exclude-standard'])
  let committed: string[] = []
  if (!baseRevision) {
    try {
      const head = gitLines(root, ['rev-parse', 'HEAD'])[0]
      const master = gitLines(root, ['rev-parse', '--verify', 'origin/master'])[0]
      if (head && master && head !== master) {
        committed = gitLines(root, [
          'diff',
          '--name-only',
          '--diff-filter=ACMRTD',
          'origin/master...HEAD',
        ])
      }
    } catch {
      committed = []
    }
  }
  return [...new Set([...tracked, ...untracked, ...committed])].sort()
}

function argument(name: string) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

const entryPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : undefined
if (entryPath === import.meta.url) {
  try {
    const root = resolve(argument('--root') ?? process.cwd())
    const filesPath = argument('--files-json')
    const parsed = filesPath
      ? JSON.parse(readFileSync(resolve(filesPath), 'utf8')) as unknown
      : undefined
    if (
      parsed !== undefined &&
      (!Array.isArray(parsed) ||
        !parsed.every((path): path is string => typeof path === 'string'))
    ) {
      throw new Error('--files-json must contain an array of repository paths')
    }
    const paths = (parsed as string[] | undefined) ??
      changedRepositoryPaths(root, argument('--base'))
    validateChangedTestPolicy(paths, { root })
    console.log(
      `Changed-test policy passed for ${paths.length} changed path(s).`,
    )
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
