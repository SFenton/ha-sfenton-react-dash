import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { chromium, type Browser, type Page } from '@playwright/test'
import { config } from 'dotenv'

type CaptureOptions = {
  entities: string[]
  hash?: string
  labels: string[]
  outDir: string
  path: string
  reactUrl?: string
  skipReact: boolean
}

type ArgMap = Record<string, string | true>

type AccessibilitySnapshotter = {
  accessibility?: {
    snapshot: (options: { interestingOnly: boolean }) => Promise<unknown>
  }
}

const ENV_FILE = '.env.hass-porting.local'

function parseArgs(argv: string[]): ArgMap {
  const args: ArgMap = {}
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (!arg.startsWith('--')) continue
    const [rawName, inlineValue] = arg.slice(2).split('=', 2)
    if (inlineValue !== undefined) {
      args[rawName] = inlineValue
      continue
    }
    const next = argv[index + 1]
    if (next && !next.startsWith('--')) {
      args[rawName] = next
      index += 1
      continue
    }
    args[rawName] = true
  }
  return args
}

function positionalArgs(argv: string[]) {
  return argv.filter((arg) => !arg.startsWith('--'))
}

function stringArg(args: ArgMap, name: string, fallback = '') {
  const value = args[name]
  return typeof value === 'string' ? value : fallback
}

function listArg(args: ArgMap, name: string) {
  return stringArg(args, name)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function listFromValue(value: string | undefined) {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function slug(value: string) {
  return value.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'capture'
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19)
}

function helpText() {
  return `Capture HASS porting evidence.

Usage:
  npm run porting:capture -- --path /at-a-glance/admin --hash #presence-based-overrides --labels "Living Room,Upper Deck" --entities "switch.example"

Options:
  --path <path>       HASS/React route path. Defaults to HASS_PORTING_DASHBOARD_PATH.
  --hash <hash>       Optional hash to open, e.g. #presence-based-overrides.
  --labels <list>     Comma-separated labels to capture DOM/style chains for.
  --entities <list>   Comma-separated HA entity IDs whose states/attributes should be captured.
  --react-url <url>   React base URL. Defaults to HASS_PORTING_REACT_URL.
  --out <dir>         Output directory. Defaults to .hass-porting/<timestamp>-<path>.
  --skip-react        Capture HASS only.
  --help              Show this help.
`
}

function buildUrl(base: string, routePath: string, hash?: string) {
  const url = new URL(routePath.startsWith('/') ? routePath : `/${routePath}`, base)
  if (hash) url.hash = hash.startsWith('#') ? hash.slice(1) : hash
  return url.toString()
}

function dashboardParts(routePath: string) {
  const parts = routePath.split(/[?#]/, 1)[0].split('/').filter(Boolean)
  return {
    dashboardPath: parts[0] ?? 'at-a-glance',
    viewPath: parts[1] ?? undefined,
  }
}

async function installEvaluateHelpers(page: Page) {
  const script = () => {
    const global = globalThis as typeof globalThis & {
      __name?: <T>(target: T, name: string) => T
    }
    global.__name ??= (target) => target
  }

  await page.addInitScript(script)
  await page.evaluate(script).catch(() => undefined)
}

async function loginToHass(page: Page, username: string, password: string) {
  if ((await page.getByRole('button', { name: /log in|login/i }).count()) === 0) return
  const textboxes = page.getByRole('textbox')
  await textboxes.nth(0).fill(username)
  await textboxes.nth(1).fill(password)
  await page.getByRole('button', { name: /log in|login/i }).click()
  await page.waitForLoadState('domcontentloaded')
}

async function capturePage(page: Page, filePrefix: string, labels: string[], entities: string[], includeHassState: boolean) {
  const screenshot = `${filePrefix}.png`
  await page.screenshot({ fullPage: true, path: screenshot })

  const accessibilityApi = (page as unknown as AccessibilitySnapshotter).accessibility
  const accessibility = accessibilityApi?.snapshot
    ? await accessibilityApi.snapshot({ interestingOnly: false }).catch((error: unknown) => ({ error: String(error) }))
    : { unavailable: 'Playwright accessibility snapshot API is not available in this installed version.' }
  const evidence = await page.evaluate(
    ({ entities, includeHassState, labels }) => {
      function nodeText(node: Node): string {
        let text = ''
        for (const child of Array.from(node.childNodes ?? [])) {
          if (child.nodeType === Node.TEXT_NODE) text += child.textContent ?? ''
          if (child.nodeType === Node.ELEMENT_NODE || child.nodeType === Node.DOCUMENT_FRAGMENT_NODE) text += nodeText(child)
        }
        if (node instanceof Element && node.shadowRoot) text += nodeText(node.shadowRoot)
        return text.replace(/\s+/g, ' ').trim()
      }

      function allElements(root: ParentNode | Document | ShadowRoot = document) {
        const output: Element[] = []
        function visit(node: ParentNode | Document | ShadowRoot | Element) {
          if (node instanceof Element) {
            output.push(node)
            if (node.shadowRoot) visit(node.shadowRoot)
          }
          for (const child of Array.from(node.children ?? [])) visit(child)
        }
        visit(root)
        return output
      }

      function cssVars(style: CSSStyleDeclaration) {
        const names = [
          '--bubble-main-background-color',
          '--bubble-button-background-color',
          '--bubble-icon-background-color',
          '--bubble-icon-color',
          '--bubble-name-color',
          '--bubble-state-color',
          '--card-background-color',
          '--ha-card-background',
          '--primary-text-color',
          '--secondary-text-color',
          '--accent-color',
          '--rgb-primary-color',
          '--rgb-accent-color',
          '--state-active-color',
          '--state-inactive-color',
        ]
        return Object.fromEntries(names.map((name) => [name, style.getPropertyValue(name).trim()]).filter(([, value]) => value))
      }

      function styleOf(element: Element) {
        const style = getComputedStyle(element)
        const before = getComputedStyle(element, '::before')
        const after = getComputedStyle(element, '::after')
        const rect = element.getBoundingClientRect()
        return {
          tag: element.localName,
          className: typeof element.className === 'string' ? element.className : '',
          text: nodeText(element).slice(0, 160),
          rect: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) },
          background: style.background,
          backgroundColor: style.backgroundColor,
          borderColor: style.borderColor,
          color: style.color,
          opacity: style.opacity,
          backdropFilter: style.backdropFilter || style.webkitBackdropFilter,
          before: {
            background: before.background,
            backgroundColor: before.backgroundColor,
            content: before.content,
            opacity: before.opacity,
          },
          after: {
            background: after.background,
            backgroundColor: after.backgroundColor,
            content: after.content,
            opacity: after.opacity,
          },
          vars: cssVars(style),
        }
      }

      const elements = allElements()
      const labelEvidence = Object.fromEntries(
        labels.map((label) => {
          const matches = elements.filter((element) => nodeText(element).includes(label))
          const leaf = matches.sort((left, right) => nodeText(left).length - nodeText(right).length)[0]
          const chain = []
          let current: Element | null | undefined = leaf
          while (current && chain.length < 20) {
            chain.push(styleOf(current))
            const root = current.getRootNode()
            current = current.parentElement ?? (root instanceof ShadowRoot ? root.host : null)
          }
          return [label, { chain, matchCount: matches.length }]
        }),
      )

      const cardLike = elements
        .filter((element) => {
          const text = nodeText(element)
          const className = typeof element.className === 'string' ? element.className : ''
          return text && (element.localName === 'ha-card' || element.localName.includes('bubble') || className.includes('card') || element.getAttribute('role') === 'button')
        })
        .map(styleOf)
        .filter((item) => item.rect.width > 20 && item.rect.height > 20)
        .slice(0, 120)

      const hass = includeHassState ? document.querySelector('home-assistant')?.hass : undefined
      const states = hass
        ? Object.fromEntries(
            entities.map((entityId) => {
              const state = hass.states?.[entityId]
              return [entityId, state ? { attributes: state.attributes, state: state.state } : null]
            }),
          )
        : {}

      return {
        bodyText: document.body.innerText.replace(/\s+/g, ' ').trim(),
        cardLike,
        labels: labelEvidence,
        states,
        title: document.title,
        url: location.href,
      }
    },
    { entities, includeHassState, labels },
  )

  await writeFile(`${filePrefix}.json`, JSON.stringify({ accessibility, evidence, screenshot }, null, 2))
}

async function captureLovelaceConfig(page: Page, outDir: string, routePath: string) {
  const { dashboardPath, viewPath } = dashboardParts(routePath)
  const result = await page.evaluate(
    async ({ dashboardPath, viewPath }) => {
      const hass = document.querySelector('home-assistant')?.hass
      if (!hass?.connection) return { error: 'HASS connection unavailable' }
      const config = await hass.connection.sendMessagePromise({ type: 'lovelace/config', url_path: dashboardPath })
      return {
        streamline_templates: config.streamline_templates ?? null,
        view: viewPath ? config.views?.find((candidate: { path?: string }) => candidate.path === viewPath) ?? null : null,
      }
    },
    { dashboardPath, viewPath },
  )
  await writeFile(path.join(outDir, 'hass-lovelace-config.json'), JSON.stringify(result, null, 2))
}

async function capture() {
  config({ path: ENV_FILE, quiet: true })
  const argv = process.argv.slice(2)
  const args = parseArgs(argv)
  const positional = positionalArgs(argv)
  if (args.help || positional.includes('help')) {
    console.log(helpText())
    return
  }

  const hasNamedArgs = ['entities', 'hash', 'labels', 'out', 'path', 'react-url', 'skip-react'].some((name) => args[name] !== undefined)
  const positionalPath = hasNamedArgs ? undefined : positional[0]
  const positionalLabels = hasNamedArgs ? undefined : positional[1]
  const positionalEntities = hasNamedArgs ? undefined : positional[2]
  const positionalOut = hasNamedArgs ? undefined : positional[3]

  const routePath = stringArg(args, 'path', positionalPath ?? process.env.HASS_PORTING_DASHBOARD_PATH ?? '/at-a-glance/overview')
  const hash = stringArg(args, 'hash') || undefined
  const defaultOutDir = path.join('.hass-porting', `${timestamp()}-${slug(`${routePath}-${hash ?? ''}`)}`)
  const entities = listArg(args, 'entities')
  const labels = listArg(args, 'labels')
  const options: CaptureOptions = {
    entities: entities.length ? entities : listFromValue(positionalEntities),
    hash,
    labels: labels.length ? labels : listFromValue(positionalLabels),
    outDir: stringArg(args, 'out', positionalOut ?? defaultOutDir),
    path: routePath,
    reactUrl: stringArg(args, 'react-url', process.env.HASS_PORTING_REACT_URL ?? ''),
    skipReact: Boolean(args['skip-react']) || process.env.npm_config_skip_react === 'true',
  }

  const hassUrl = process.env.HASS_PORTING_HA_URL
  const username = process.env.HASS_PORTING_HA_USERNAME
  const password = process.env.HASS_PORTING_HA_PASSWORD
  if (!hassUrl || !username || !password) throw new Error(`Missing HASS credentials in ${ENV_FILE}`)

  await mkdir(options.outDir, { recursive: true })
  const browser: Browser = await chromium.launch({ headless: true })
  try {
    const hassPage = await browser.newPage({ deviceScaleFactor: 3, hasTouch: true, isMobile: true, viewport: { height: 852, width: 393 } })
    await installEvaluateHelpers(hassPage)
    await hassPage.goto(buildUrl(hassUrl, options.path, options.hash), { waitUntil: 'networkidle', timeout: 60_000 })
    await loginToHass(hassPage, username, password)
    await hassPage.goto(buildUrl(hassUrl, options.path, options.hash), { waitUntil: 'networkidle', timeout: 60_000 })
    await hassPage.waitForFunction(() => Boolean(document.querySelector('home-assistant')?.hass), null, { timeout: 60_000 }).catch(() => undefined)
    await captureLovelaceConfig(hassPage, options.outDir, options.path)
    await capturePage(hassPage, path.join(options.outDir, 'hass-page'), options.labels, options.entities, true)

    if (!options.skipReact && options.reactUrl) {
      const reactPage = await browser.newPage({ deviceScaleFactor: 3, hasTouch: true, isMobile: true, viewport: { height: 852, width: 393 } })
      await installEvaluateHelpers(reactPage)
      try {
        await reactPage.goto(buildUrl(options.reactUrl, options.path, options.hash), { waitUntil: 'networkidle', timeout: 30_000 })
        await capturePage(reactPage, path.join(options.outDir, 'react-page'), options.labels, [], false)
      } catch (error) {
        await writeFile(path.join(options.outDir, 'react-error.json'), JSON.stringify({ error: String(error) }, null, 2))
      }
    }
  } finally {
    await browser.close()
  }

  console.log(`Wrote HASS porting evidence to ${path.resolve(options.outDir)}`)
}

capture().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})