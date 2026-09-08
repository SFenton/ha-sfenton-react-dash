import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { useHass, useUser } from '@hakit/core'
import { ChatClient, type ChatConnection } from './chatClient'

export function useDashboardChat(active: boolean) {
  const connection = useHass((state) => state.connection) as unknown as ChatConnection | undefined
  const userId = useUser()?.id
  const client = useMemo(() => connection && userId ? new ChatClient(connection, userId) : null, [connection, userId])
  useEffect(() => {
    if (active) void client?.activate()
  }, [active, client])
  useEffect(() => () => client?.dispose(), [client])
  return client
}

export function useChatSnapshot(client: ChatClient) {
  return useSyncExternalStore(client.subscribe, client.getSnapshot, client.getSnapshot)
}
