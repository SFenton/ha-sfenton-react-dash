export interface LayoutMockController {
  calls: Record<string, unknown>[]
  clearWeatherForecasts: () => void
  chat: {
    messages: Record<string, unknown>[]
    seed: (records: Record<string, unknown>) => void
    replaceRecords: (records: Record<string, unknown>) => void
    setAgents: (agents: { id: string; name: string }[]) => void
    setAgentsAvailable: (available: boolean) => void
    setLoadFailure: (failed: boolean) => void
    setLoading: () => void
    setResultWriteFailure: (failed: boolean) => void
    setWriteFailure: (failed: boolean) => void
    setPending: () => void
    setReply: (text: string) => void
    subscriptions: () => number
  }
  reset: () => void
  setEntityState: (entityId: string, state: string) => void
  setTodoItems: (entityId: string, items: { status: string; summary: string; uid: string }[]) => void
  setEntityAttribute: (entityId: string, attribute: string, value: unknown) => void
  setCallServiceOutcome: (domain: string, service: string, outcome: 'pending' | 'reject' | 'resolve') => void
  setUser: (user: { id: string; name: string; is_admin?: boolean } | null) => void
  getEntity: (entityId: string) => { state: string; attributes: Record<string, unknown> } | null
  resolveWakeCommands: () => void
  rejectWakeCommands: () => void
  setWakeResponse: (outcome: string | null) => void
  resolveCallService: (domain: string, service: string) => void
}

declare global {
  interface Window {
    __mockHass?: LayoutMockController
  }
}
