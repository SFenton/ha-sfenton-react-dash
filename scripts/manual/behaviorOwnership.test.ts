import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { MANUAL_ARTICLES } from '../../src/manual/catalog'
import type { ManualHaInventory } from '../../src/manual/types'
import {
  behaviorInventoryFingerprint,
  buildBehaviorOwnershipAudit,
  MANUAL_BEHAVIOR_OWNERSHIP_RULES,
  REVIEWED_HA_BEHAVIOR_INVENTORY_FINGERPRINT,
  type ManualBehaviorOwnershipRule,
} from './behaviorOwnership'

function inventory() {
  return JSON.parse(readFileSync(resolve(process.cwd(), 'scripts/manual/generated/haInventory.json'), 'utf8')) as ManualHaInventory
}

function textFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = resolve(directory, entry)
    if (statSync(path).isDirectory()) return textFiles(path)
    return /\.(?:css|html|js|json|ts|tsx)$/.test(path) ? [path] : []
  })
}

describe('private Home Assistant behavior ownership', () => {
  it('maps every non-internal item exactly once and explicitly reviews every internal item', () => {
    const current = inventory()
    const result = buildBehaviorOwnershipAudit(current, MANUAL_ARTICLES)
    const registryIds = MANUAL_BEHAVIOR_OWNERSHIP_RULES.flatMap((rule) => rule.itemIds)

    expect(result.errors).toEqual([])
    expect(new Set(registryIds).size).toBe(registryIds.length)
    expect(result.audit.counts).toMatchObject({
      total: 208,
      userFacing: 201,
      internal: 7,
      mappedUserFacing: 201,
      reviewedInternal: 7,
      behaviorGuides: 25,
    })
    expect(result.audit.records.filter((record) => record.classification !== 'internal').every((record) => Boolean(record.ownerArticleId))).toBe(true)
    expect(result.audit.records.filter((record) => record.classification === 'internal').every((record) => Boolean(record.internalReview || record.internalUserFacingReview))).toBe(true)
    expect(behaviorInventoryFingerprint(current)).toBe(REVIEWED_HA_BEHAVIOR_INVENTORY_FINGERPRINT)
  })

  it('fails additions, removals, reclassification, duplicate ownership, missing owners, and internal user-facing mapping without review', () => {
    const current = inventory()
    const fingerprint = behaviorInventoryFingerprint(current)

    const added = structuredClone(current)
    added.automations.push({
      category: 'Reliability & Internal',
      classification: 'background-user-facing',
      id: 'automation.unreviewed_behavior_test',
      name: 'Unreviewed Behavior Test',
    })
    const addedErrors = buildBehaviorOwnershipAudit(added, MANUAL_ARTICLES).errors.join('\n')
    expect(addedErrors).toMatch(/no behavior ownership rule/)
    expect(addedErrors).toMatch(/fingerprint changed/)

    const removed = structuredClone(current)
    removed.scripts = removed.scripts.filter((item) => item.id !== 'script.increment_room_access')
    const removedErrors = buildBehaviorOwnershipAudit(removed, MANUAL_ARTICLES).errors.join('\n')
    expect(removedErrors).toMatch(/removed or renamed/)
    expect(removedErrors).toMatch(/fingerprint changed/)

    const reclassified = structuredClone(current)
    const reclassifiedItem = reclassified.automations.find((item) => item.id === 'automation.weekly_browser_mod_cleanup')
    if (!reclassifiedItem) throw new Error('Missing drift fixture')
    reclassifiedItem.classification = 'internal'
    const reclassifiedErrors = buildBehaviorOwnershipAudit(reclassified, MANUAL_ARTICLES).errors.join('\n')
    expect(reclassifiedErrors).toMatch(/without explicit review/)
    expect(reclassifiedErrors).toMatch(/fingerprint changed/)

    const duplicateRules: ManualBehaviorOwnershipRule[] = [
      ...MANUAL_BEHAVIOR_OWNERSHIP_RULES,
      {
        ownerArticleId: 'behavior-app-housekeeping',
        category: 'Duplicate test',
        rationale: 'Exercises exact-one ownership validation.',
        itemIds: ['script.increment_room_access'],
      },
    ]
    expect(buildBehaviorOwnershipAudit(current, MANUAL_ARTICLES, duplicateRules, fingerprint).errors.join('\n')).toMatch(/multiple behavior ownership rules/)

    const wrongOwnerRules = MANUAL_BEHAVIOR_OWNERSHIP_RULES.map((rule) => (
      rule.itemIds.includes('script.increment_room_access')
        ? { ...rule, ownerArticleId: 'app-layout' }
        : rule
    ))
    expect(buildBehaviorOwnershipAudit(current, MANUAL_ARTICLES, wrongOwnerRules, fingerprint).errors.join('\n')).toMatch(/is not a behavior-guide article/)

    const internalMappedRules = MANUAL_BEHAVIOR_OWNERSHIP_RULES.map((rule) => (
      rule.itemIds.includes('script.cover_tilt_worker')
        ? { ...rule, ownerArticleId: 'behavior-app-housekeeping', internalReview: undefined }
        : rule
    ))
    expect(buildBehaviorOwnershipAudit(current, MANUAL_ARTICLES, internalMappedRules, fingerprint).errors.join('\n')).toMatch(/without explicit review/)

    const internalMissingOwnerRules = MANUAL_BEHAVIOR_OWNERSHIP_RULES.map((rule) => (
      rule.itemIds.includes('script.cover_tilt_worker')
        ? { ...rule, ownerArticleId: 'behavior-missing-test', internalReview: undefined, internalUserFacingReview: 'Reviewed for user-facing ownership.' }
        : rule
    ))
    expect(buildBehaviorOwnershipAudit(current, MANUAL_ARTICLES, internalMissingOwnerRules, fingerprint).errors.join('\n')).toMatch(/references missing behavior owner/)

    const internalWrongOwnerRules = MANUAL_BEHAVIOR_OWNERSHIP_RULES.map((rule) => (
      rule.itemIds.includes('script.cover_tilt_worker')
        ? { ...rule, ownerArticleId: 'app-layout', internalReview: undefined, internalUserFacingReview: 'Reviewed for user-facing ownership.' }
        : rule
    ))
    expect(buildBehaviorOwnershipAudit(current, MANUAL_ARTICLES, internalWrongOwnerRules, fingerprint).errors.join('\n')).toMatch(/is not a behavior-guide article/)
  })

  it('keeps the private registry and live catalog out of manual source and public assets', () => {
    const current = inventory()
    const appInventory = JSON.parse(readFileSync(resolve(process.cwd(), 'src/manual/generated/appInventory.json'), 'utf8')) as { entities: string[] }
    const behaviorSource = readFileSync(resolve(process.cwd(), 'src/manual/behaviorGuides.ts'), 'utf8')
    const publicSummary = readFileSync(resolve(process.cwd(), 'src/manual/generated/haInventory.ts'), 'utf8')
    const publicText = textFiles(resolve(process.cwd(), 'public')).map((path) => readFileSync(path, 'utf8')).join('\n')
    const runtimeSource = textFiles(resolve(process.cwd(), 'src'))
      .filter((path) => !path.includes('.test.') && !path.endsWith('/manual/generated/appInventory.json') && !path.endsWith('/manual/generated/surfaceInventory.json'))
      .map((path) => readFileSync(path, 'utf8'))
      .join('\n')
    const appReferencedIds = new Set(appInventory.entities)
    const privateRuntimeIdLeaks: string[] = []
    const runtimeNameLeaks: string[] = []

    expect(runtimeSource).not.toMatch(/scripts\/manual\/behaviorOwnership|behaviorOwnershipAudit\.json/)
    for (const item of [...current.automations, ...current.scripts]) {
      expect(behaviorSource).not.toContain(item.id)
      expect(publicSummary).not.toContain(item.id)
      expect(publicText).not.toContain(item.id)
      if (!appReferencedIds.has(item.id) && runtimeSource.includes(item.id)) privateRuntimeIdLeaks.push(item.id)
      expect(behaviorSource).not.toContain(item.name)
      expect(publicSummary).not.toContain(item.name)
      expect(publicText).not.toContain(item.name)
      if (runtimeSource.includes(item.name)) runtimeNameLeaks.push(item.name)
    }
    expect(privateRuntimeIdLeaks).toEqual([])
    expect(runtimeNameLeaks).toEqual([])
  })

  it('keeps the read-only ambiguous-config review private and tied to current inventory', () => {
    const current = inventory()
    const review = JSON.parse(readFileSync(resolve(process.cwd(), 'scripts/manual/generated/behaviorConfigReview.json'), 'utf8')) as {
      readOnly: boolean
      items: { id: string; result: string; finding: string }[]
    }
    const liveIds = new Set([...current.automations, ...current.scripts].map((item) => item.id))

    expect(review.readOnly).toBe(true)
    expect(review.items).toHaveLength(29)
    expect(new Set(review.items.map((item) => item.id)).size).toBe(review.items.length)
    expect(review.items.every((item) => liveIds.has(item.id) && item.result && item.finding)).toBe(true)
  })
})
