export interface HassConnectionConfig {
  token: string
  url: string
}

export interface HassTodoItem {
  completed?: string
  description?: string
  due?: string
  status?: string
  summary?: string
  uid?: string
}

export interface HassEntityState {
  attributes?: Record<string, unknown>
  entity_id: string
  state: string
}

type FetchLike = typeof fetch

interface ServiceResponse {
  service_response?: Record<string, { items?: HassTodoItem[] }>
}

export class HassAdminTodoClient {
  readonly config: HassConnectionConfig
  readonly fetchImpl: FetchLike

  constructor(config = hassConnectionConfigFromEnv(), fetchImpl: FetchLike = fetch) {
    this.config = config
    this.fetchImpl = fetchImpl
  }

  async getItems(entityId: string): Promise<HassTodoItem[]> {
    const result = await this.callService('todo', 'get_items', { entity_id: entityId }, true) as ServiceResponse
    const items = result.service_response?.[entityId]?.items
    if (!Array.isArray(items)) {
      throw new Error(`Home Assistant did not return items for ${entityId}.`)
    }
    return items
  }

  async getState(entityId: string): Promise<HassEntityState> {
    const response = await this.fetchImpl(`${this.config.url}/api/states/${encodeURIComponent(entityId)}`, {
      headers: { Authorization: `Bearer ${this.config.token}` },
    })
    const body = await response.text()
    if (!response.ok) {
      throw new Error(`Home Assistant state read for ${entityId} failed with HTTP ${response.status}: ${body.slice(0, 500)}`)
    }
    try {
      return JSON.parse(body) as HassEntityState
    } catch {
      throw new Error(`Home Assistant state read for ${entityId} returned invalid JSON.`)
    }
  }

  async completeItem(completionScript: string, item: string) {
    const service = completionScript.replace(/^script\./, '')
    await this.callService('script', service, { item })
  }

  async reopenItem(entityId: string, item: string) {
    const current = (await this.getItems(entityId)).find((entry) => entry.uid === item)
    if (!current) throw new Error(`Admin To-Do item ${item} was not found for reopening`)
    if (current.status === 'needs_action') return
    if (current.status !== 'completed') {
      throw new Error(`Admin To-Do item ${item} has an unexpected status before reopening`)
    }
    await this.callService('todo', 'update_item', {
      entity_id: entityId,
      item,
      status: 'needs_action',
    })
    const reopened = (await this.getItems(entityId)).find((entry) => entry.uid === item)
    if (reopened?.status !== 'needs_action') {
      throw new Error(`Admin To-Do item ${item} did not reopen after the service call`)
    }
  }

  async updateDescription(entityId: string, item: string, description: string) {
    await this.callService('todo', 'update_item', { description, entity_id: entityId, item })
  }

  async getAdminTodoAttachment(attachmentId: string) {
    const response = await this.fetchImpl(
      `${this.config.url}/api/sfenton_admin_todo/attachments/${encodeURIComponent(attachmentId)}`,
      { headers: { Authorization: `Bearer ${this.config.token}` } },
    )
    if (!response.ok) {
      throw new Error(
        `Home Assistant Admin To-Do attachment ${attachmentId} failed with HTTP ${response.status}`,
      )
    }
    return new Uint8Array(await response.arrayBuffer())
  }

  async deleteAdminTodoAttachment(attachmentId: string) {
    const response = await this.fetchImpl(
      `${this.config.url}/api/sfenton_admin_todo/attachments/${encodeURIComponent(attachmentId)}`,
      {
        headers: { Authorization: `Bearer ${this.config.token}` },
        method: 'DELETE',
      },
    )
    if (!response.ok && response.status !== 404) {
      throw new Error(
        `Home Assistant Admin To-Do attachment cleanup ${attachmentId} failed with HTTP ${response.status}`,
      )
    }
  }

  private async callService(domain: string, service: string, data: Record<string, unknown>, returnResponse = false) {
    const suffix = returnResponse ? '?return_response' : ''
    const response = await this.fetchImpl(`${this.config.url}/api/services/${domain}/${service}${suffix}`, {
      body: JSON.stringify(data),
      headers: {
        Authorization: `Bearer ${this.config.token}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
    })
    const body = await response.text()
    if (!response.ok) {
      throw new Error(`Home Assistant ${domain}.${service} failed with HTTP ${response.status}: ${body.slice(0, 500)}`)
    }
    if (!body.trim()) return {}
    try {
      return JSON.parse(body) as unknown
    } catch {
      throw new Error(`Home Assistant ${domain}.${service} returned invalid JSON.`)
    }
  }
}

export function adminCompletionBoundarySatisfied(todoStatus: string | undefined, receiptState: string, uid: string) {
  return todoStatus === 'completed' && receiptState === uid
}

export function hassConnectionConfigFromEnv(): HassConnectionConfig {
  const url = process.env.VITE_HA_URL?.trim().replace(/\/$/, '')
  const token = process.env.VITE_HA_TOKEN?.trim()
  if (!url) throw new Error('Missing VITE_HA_URL.')
  if (!token) throw new Error('Missing VITE_HA_TOKEN.')
  return { token, url }
}
