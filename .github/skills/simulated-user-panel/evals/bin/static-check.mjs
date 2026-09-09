import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = process.cwd()
const evalRoot = resolve(root, '.github/skills/simulated-user-panel/evals')

const readJson = async (path) => JSON.parse(await readFile(resolve(root, path), 'utf8'))
const personas = await readJson('.github/skills/simulated-user-panel/evals/personas.json')
const cases = await readJson('.github/skills/simulated-user-panel/evals/cases.json')
const plan = await readJson('.github/skills/simulated-user-panel/evals/baseline-plan.json')
const skillText = await readFile(resolve(root, '.github/skills/simulated-user-panel/SKILL.md'), 'utf8')
const previewText = await readFile(resolve(evalRoot, 'preview.no-proxy.config.mjs'), 'utf8')
const delegatedPreviewText = previewText.includes('e2e/mock-preview.config.ts')
  ? await readFile(resolve(root, 'e2e/mock-preview.config.ts'), 'utf8')
  : ''

const errors = []
const warnings = []
const checks = []

const check = (condition, message, detail = undefined) => {
  checks.push({ message, ok: Boolean(condition), detail })
  if (!condition) errors.push(message)
}

const expectedCore = [
  ['young-novice', 'claude-haiku-4.5', null, 'default', 'U'],
  ['tech-teen', 'gpt-5-mini', 'low', 'default', 'U'],
  ['ha-engineer', 'gpt-5.6-terra', 'high', 'long_context', 'E'],
  ['cautious-elder', 'gemini-3.5-flash', 'minimal', 'default', 'U'],
  ['visual-texter', 'gemini-3.6-flash', 'low', 'default', 'U'],
  ['ux-designer', 'claude-opus-5', 'max', 'long_context', 'P'],
  ['occasional-partner', 'grok-4.5', 'medium', 'default', 'U'],
  ['power-user', 'gpt-5.5', 'xhigh', 'long_context', 'P'],
  ['accessibility-auditor', 'claude-sonnet-4.6', 'high', 'long_context', 'P'],
]

check(
  personas.coordinator.model === 'gpt-5.6-sol'
    && personas.coordinator.effort === 'medium'
    && personas.coordinator.context === 'default',
  'Routine panel coordinator uses Sol medium/default.',
)
check(
  personas.coordinator.conditionalCriticalProfile?.model === 'gpt-5.6-sol'
    && personas.coordinator.conditionalCriticalProfile?.effort === 'max'
    && personas.coordinator.conditionalCriticalProfile?.context === 'long_context'
    && personas.coordinator.conditionalCriticalProfile?.requiresTriggerReceipt === true
    && personas.coordinator.conditionalCriticalProfile?.triggerIds?.includes(
      'panel-deep-safety-adjudication',
    )
    && personas.coordinator.conditionalCriticalProfile?.triggerIds?.includes(
      'panel-material-disagreement-adjudication',
    ),
  'Panel max/long profile is conditional on concrete adjudication triggers.',
)

check(personas.core.length === expectedCore.length, 'Core panel has exactly nine slots.')
for (const [id, model, effort, context, tier] of expectedCore) {
  const actual = personas.core.find((persona) => persona.id === id)
  check(Boolean(actual), `Core persona ${id} exists.`)
  if (!actual) continue
  check(
    actual.model === model
      && actual.effort === effort
      && actual.context === context
      && actual.tier === tier,
    `Core persona ${id} uses the expected profile.`,
    { expected: { model, effort, context, tier }, actual },
  )
}

check(
  skillText.includes('preview.no-proxy.config.mjs'),
  'Skill uses the no-proxy eval preview config.',
)
check(
  !/start or reuse `npm run dev:mock/.test(skillText),
  'Skill does not launch guided evals through dev:mock.',
)
check(
  /Any tool request invalidates the participant\s+result\./.test(skillText),
  'Skill makes participant tool requests a hard failure.',
)
check(
  (`${previewText}\n${delegatedPreviewText}`.match(/proxy:\s*\{\}/g) ?? []).length >= 2,
  'Eval preview config clears both server and preview proxies.',
)

const evidenceIds = new Set()
for (const evalCase of cases.cases) {
  check(Boolean(evalCase.id && evalCase.question && evalCase.targetAllowlist?.length), `Case ${evalCase.id ?? '<missing>'} has its required contract.`)
  for (const tier of ['U', 'P', 'E']) {
    for (const evidence of evalCase.projections?.[tier] ?? []) {
      check(!evidenceIds.has(evidence.id), `Evidence id ${evidence.id} is unique.`)
      evidenceIds.add(evidence.id)
    }
  }
}

const allPersonaIds = new Set([
  ...personas.core.map((persona) => persona.id),
  ...personas.specialists.map((persona) => persona.id),
])
for (const entry of plan.entries) {
  check(
    cases.cases.some((evalCase) => evalCase.id === entry.caseId),
    `Plan case ${entry.caseId} exists.`,
  )
  for (const personaId of entry.personaIds ?? (entry.personaId ? [entry.personaId] : [])) {
    check(allPersonaIds.has(personaId), `Plan persona ${personaId} exists.`)
  }
}

const tiers = new Map()
for (const persona of personas.core) {
  const bucket = tiers.get(persona.tier) ?? { personas: 0, vendors: new Set() }
  bucket.personas += 1
  const vendor = persona.model.startsWith('claude')
    ? 'Anthropic'
    : persona.model.startsWith('gemini')
      ? 'Google'
      : persona.model.startsWith('grok')
        ? 'xAI'
        : 'OpenAI'
  bucket.vendors.add(vendor)
  tiers.set(persona.tier, bucket)
}

for (const [tier, data] of tiers) {
  if (data.personas < 4 || data.vendors.size < 3) {
    warnings.push(`Tier ${tier} cannot independently meet the current Strong threshold: ${data.personas} personas, ${data.vendors.size} vendors.`)
  }
}

const report = {
  ok: errors.length === 0,
  checks,
  errors,
  warnings,
  counts: {
    cases: cases.cases.length,
    corePersonas: personas.core.length,
    planEntries: plan.entries.length,
    evidenceIds: evidenceIds.size,
  },
}

console.log(JSON.stringify(report, null, 2))
if (!report.ok) process.exitCode = 1
