import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { SourceSnapshot } from '../../e2e/layout/types'

export const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex')
export const stableHash = (value: unknown) => hash(JSON.stringify(value))
export const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, 'utf8')) as T

export function writeJson(path: string, value: unknown) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

export function git(root: string, args: string[]) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}

export function snapshot(root: string, base: string): SourceSnapshot {
  const resolvedBase = git(root, ['rev-parse', '--verify', `${base}^{commit}`])
  const tracked = git(root, ['ls-files', '-z', '--cached', '--others', '--exclude-standard']).split('\0').filter(Boolean)
  const files = Object.fromEntries([...new Set(tracked)].sort().filter((file) =>
    !file.split('/').some((part) => part.startsWith('.env'))
    && !file.startsWith('artifacts/') && !file.startsWith('.cache/'),
  ).map((file) => [file, existsSync(resolve(root, file)) ? hash(readFileSync(resolve(root, file))) : '<deleted>']))
  const head = git(root, ['rev-parse', 'HEAD'])
  return { base: resolvedBase, head, files, digest: stableHash({ base: resolvedBase, head, files }) }
}

export function changedFiles(root: string, base: string) {
  return [...new Set([
    ...git(root, ['diff', '--name-only', '-z', base, '--']).split('\0'),
    ...git(root, ['ls-files', '--others', '--exclude-standard', '-z']).split('\0'),
  ].filter(Boolean))].sort()
}

export function artifactPath(root: string, input: string, mustExist = false) {
  const allowed = resolve(root, 'artifacts/layout')
  const path = resolve(root, input)
  if (path === allowed || !path.startsWith(`${allowed}${sep}`)) throw new Error('Artifacts must be inside the declared artifacts/layout/<run-id> root')
  let parent = path
  while (!existsSync(parent)) parent = dirname(parent)
  const expectedParent = resolve(realpathSync(root), relative(root, parent))
  if (realpathSync(parent) !== expectedParent) {
    throw new Error('Artifact path crosses an undeclared or symlinked root')
  }
  if (mustExist && !existsSync(path)) throw new Error(`Artifact missing or access-unavailable: ${relative(root, path)}`)
  return path
}

export function relativeArtifact(root: string, file: string) {
  artifactPath(root, file, true)
  const name = relative(root, file).split(sep).join('/')
  if (isAbsolute(name) || name.startsWith('..')) throw new Error('Invalid artifact reference')
  return name
}

export function fingerprintDirectory(root: string): Record<string, string> {
  const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(resolve(dir, entry.name)) : [resolve(dir, entry.name)])
  return Object.fromEntries(walk(root).sort().map((file) => [relative(root, file).split(sep).join('/'), hash(readFileSync(file))]))
}

export function option(args: string[], name: string) {
  const index = args.indexOf(name)
  if (index < 0) return undefined
  const value = args[index + 1]
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`)
  return value
}

export function assertOptions(args: string[], valued: string[], flags: string[] = []) {
  for (let index = 0; index < args.length; index += 1) {
    if (flags.includes(args[index])) continue
    if (!valued.includes(args[index])) throw new Error(`Unsupported option: ${args[index]}`)
    option(args, args[index])
    index += 1
  }
}

export function isEntry(url: string) {
  return Boolean(process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === url)
}
