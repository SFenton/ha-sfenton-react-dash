import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'
import {
  PLAYWRIGHT_SPEC_COVERAGE,
  type PlaywrightSpecCoverage,
} from '../e2e/playwright-coverage'

export function coverageDrift(
  specs: readonly string[],
  coverage: readonly PlaywrightSpecCoverage[],
) {
  const specSet = new Set(specs)
  const coverageSet = new Set(coverage.map((entry) => entry.spec))
  return {
    duplicateEntries: coverage
      .map((entry) => entry.spec)
      .filter((spec, index, entries) => entries.indexOf(spec) !== index),
    missingEntries: specs.filter((spec) => !coverageSet.has(spec)),
    staleEntries: coverage.map((entry) => entry.spec).filter((spec) => !specSet.has(spec)),
  }
}

export function validateCoverage(
  specs: readonly string[],
  coverage: readonly PlaywrightSpecCoverage[],
) {
  const drift = coverageDrift(specs, coverage)
  const invalidOwnership = coverage.flatMap((entry) => {
    const failures: string[] = []
    if (entry.landscape === 'owned' && !entry.landscapeOwner) failures.push(`${entry.spec}: missing landscapeOwner`)
    if (entry.safeArea === 'owned' && !entry.safeAreaOwner) failures.push(`${entry.spec}: missing safeAreaOwner`)
    if (
      (entry.landscape === 'not-applicable' || entry.safeArea === 'not-applicable')
      && !entry.note
    ) {
      failures.push(`${entry.spec}: missing not-applicable rationale`)
    }
    return failures
  })
  const knownSpecs = new Set(coverage.map((entry) => entry.spec))
  const entriesBySpec = new Map(coverage.map((entry) => [entry.spec, entry]))
  const unknownOwners = coverage.flatMap((entry) => [
    entry.landscapeOwner,
    entry.safeAreaOwner,
  ].filter((owner): owner is string => Boolean(owner && !knownSpecs.has(owner))))
  for (const entry of coverage) {
    for (const axis of ['landscape', 'safeArea'] as const) {
      const visited = new Set<string>()
      let current: PlaywrightSpecCoverage | undefined = entry
      while (current?.[axis] === 'owned') {
        if (visited.has(current.spec)) {
          invalidOwnership.push(`${entry.spec}: cyclic ${axis} ownership`)
          break
        }
        visited.add(current.spec)
        const owner: string | undefined = axis === 'landscape' ? current.landscapeOwner : current.safeAreaOwner
        current = owner ? entriesBySpec.get(owner) : undefined
        if (current?.[axis] === 'not-applicable') {
          invalidOwnership.push(`${entry.spec}: ${axis} owner does not provide direct coverage`)
        }
      }
    }
  }

  if (
    drift.duplicateEntries.length
    || drift.missingEntries.length
    || drift.staleEntries.length
    || invalidOwnership.length
    || unknownOwners.length
  ) {
    throw new Error([
      'Playwright coverage corpus is out of sync:',
      ...drift.duplicateEntries.map((spec) => `- duplicate: ${spec}`),
      ...drift.missingEntries.map((spec) => `- missing: ${spec}`),
      ...drift.staleEntries.map((spec) => `- stale: ${spec}`),
      ...invalidOwnership.map((failure) => `- invalid: ${failure}`),
      ...unknownOwners.map((owner) => `- unknown owner: ${owner}`),
    ].join('\n'))
  }
}

export function repositoryPlaywrightSpecs(root = process.cwd()) {
  const walk = (directory: string, prefix = ''): string[] => readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => entry.isDirectory()
      ? walk(resolve(directory, entry.name), `${prefix}${entry.name}/`)
      : entry.isFile() && entry.name.endsWith('.spec.ts') ? [`${prefix}${entry.name}`] : [])
  return walk(resolve(root, 'e2e')).sort()
}

export function nestedTestDeclarations(source: string, filename: string) {
  const file = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const failures: string[] = []
  const declaresTest = (node: ts.Node): node is ts.CallExpression =>
    ts.isCallExpression(node)
    && /^(?:test|test\.(?:only|skip|fixme))$/.test(node.expression.getText(file))
    && node.arguments.some((argument) => ts.isArrowFunction(argument) || ts.isFunctionExpression(argument))
  const visit = (node: ts.Node) => {
    if (declaresTest(node)) {
      let parent: ts.Node | undefined = node.parent
      while (parent) {
        const inBrowser = ts.isCallExpression(parent)
          && ts.isPropertyAccessExpression(parent.expression)
          && ['evaluate', 'evaluateAll', 'addInitScript'].includes(parent.expression.name.text)
        if (declaresTest(parent) || inBrowser) {
          const line = file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1
          failures.push(`${filename}:${line}: test declaration is nested inside ${inBrowser ? 'browser code' : 'another test'}`)
          break
        }
        parent = parent.parent
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  return failures
}

export function runCoverageCheck(root = process.cwd()) {
  const specs = repositoryPlaywrightSpecs(root)
  validateCoverage(specs, PLAYWRIGHT_SPEC_COVERAGE)
  const registrationFailures = specs.flatMap((spec) =>
    nestedTestDeclarations(readFileSync(resolve(root, 'e2e', spec), 'utf8'), spec))
  if (registrationFailures.length) throw new Error(registrationFailures.join('\n'))
  const directLandscape = PLAYWRIGHT_SPEC_COVERAGE.filter((entry) => entry.landscape === 'direct').length
  const directSafeArea = PLAYWRIGHT_SPEC_COVERAGE.filter((entry) => entry.safeArea === 'direct').length
  console.log(`Playwright coverage corpus passed for ${specs.length} specs (${directLandscape} direct landscape, ${directSafeArea} direct safe-area).`)
}

const entryPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : undefined
if (entryPath === import.meta.url) {
  try {
    runCoverageCheck()
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
