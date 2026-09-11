import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { useHass, useUser } from '@hakit/core'
import { ChatClient, type ChatConnection } from './chatClient'
import { createHomeMcpClient } from './homeMcpClient'

export function useDashboardChat(active: boolean) {
  const connection = useHass((state) => state.connection) as unknown as ChatConnection | undefined
  const userId = useUser()?.id
  const homeMcpEnabled = import.meta.env.VITE_HOME_MCP_ENABLED === 'true'
    || (import.meta.env.VITE_HOME_MCP_ENABLED !== 'false' && import.meta.env.MODE === 'development')
  const defaultHomeMcpUrl = import.meta.env.MODE === 'production' ? '/api/sfenton_home_mcp' : '/__home-mcp'
  const homeMcpUrl = typeof window !== 'undefined'
    ? window.__homeMcpUrl ?? (homeMcpEnabled ? (import.meta.env.VITE_HOME_MCP_URL || defaultHomeMcpUrl) : '')
    : ''
  const client = useMemo(() => {
    if (!connection || !userId) return null
    return new ChatClient(
      connection,
      userId,
      Date.now,
      undefined,
      homeMcpUrl ? createHomeMcpClient(homeMcpUrl, () => connection.options?.auth?.accessToken) : undefined,
    )
  }, [connection, homeMcpUrl, userId])
  useEffect(() => {
    if (active) void client?.activate()
  }, [active, client])
  useEffect(() => () => client?.dispose(), [client])
  return client
}

export function useChatSnapshot(client: ChatClient) {
  return useSyncExternalStore(client.subscribe, client.getSnapshot, client.getSnapshot)
}
