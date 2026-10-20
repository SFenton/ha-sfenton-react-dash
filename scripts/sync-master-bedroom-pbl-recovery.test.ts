import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ELIGIBILITY_STATE_TEMPLATE, MASTER_BEDROOM_PBL as M, type HaRecord } from './lib/masterBedroomPblRecoveryConfig'
import { applyChanges, planChanges, readSnapshot, rollbackChanges, type EligibilityOptions, type PblRecoveryClient } from './sync-master-bedroom-pbl-recovery'

const preChange = JSON.parse(readFileSync(resolve('scripts/fixtures/master-bedroom-pbl-recovery/pre-change.json'), 'utf8')) as {
  daytimeRecovery: HaRecord
  eligibilityOptions: { state: string; additional_options: { availability: string } }
}

const reversedKeys = (value: unknown): unknown => Array.isArray(value)
  ? value.map(reversedKeys)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.entries(value).reverse().map(([key, item]) => [key, reversedKeys(item)]))
    : value

class FakeHa implements PblRecoveryClient {
  automations = new Map<string, HaRecord>([[M.recoveryAutomationId, structuredClone(preChange.daytimeRecovery)]])
  helpers = new Set<string>()
  eligibility: EligibilityOptions = {
    state: preChange.eligibilityOptions.state,
    availability: preChange.eligibilityOptions.additional_options.availability,
  }
  writes: string[] = []

  async getAutomation(id: string) { return structuredClone(this.automations.get(id) ?? null) }
  async setAutomation(id: string, config: HaRecord) {
    this.writes.push(`automation:${id}`)
    this.automations.set(id, reversedKeys(config) as HaRecord)
  }
  async deleteAutomation(id: string) { this.writes.push(`delete:${id}`); this.automations.delete(id) }
  async hasInputText(id: string) { return this.helpers.has(id) }
  async createInputText(config: HaRecord) {
    this.writes.push('helper')
    const id = String(config.name).toLowerCase().replaceAll(' ', '_')
    this.helpers.add(id)
    return id
  }
  async getEligibility() { return { ...this.eligibility } }
  async setEligibility(options: EligibilityOptions) { this.writes.push('eligibility'); this.eligibility = { ...options } }
}

describe('sync-master-bedroom-pbl-recovery', () => {
  it('applies helper, evidence, eligibility, then recovery, converges, and rolls back', async () => {
    const ha = new FakeHa()
    const before = await readSnapshot(ha)
    expect(planChanges(before).changes).toHaveLength(4)

    await applyChanges(ha, before)
    expect(ha.writes).toEqual(['helper', `automation:${M.evidenceAutomationId}`, 'eligibility', `automation:${M.recoveryAutomationId}`])
    expect(ha.helpers.has(M.bedPauseHelperId)).toBe(true)
    expect(ha.eligibility).toEqual({ state: ELIGIBILITY_STATE_TEMPLATE, availability: before.eligibility.availability })
    expect(planChanges(await readSnapshot(ha)).changes).toEqual([])

    await rollbackChanges(ha, before)
    expect(ha.automations.get(M.recoveryAutomationId)).toEqual(reversedKeys(preChange.daytimeRecovery))
    expect(ha.automations.has(M.evidenceAutomationId)).toBe(false)
    expect(ha.eligibility).toEqual(before.eligibility)
  })
})
