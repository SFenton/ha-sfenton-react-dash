/// <reference types="vite/client" />

export {}

declare global {
  interface ImportMetaEnv {
    readonly VITE_HA_URL: string
    readonly VITE_HOME_MCP_ENABLED?: string
    readonly VITE_HOME_MCP_URL?: string
    readonly VITE_HA_TOKEN: string
    readonly VITE_FOLDER_NAME: string
    readonly VITE_SSH_USERNAME: string
    readonly VITE_SSH_PASSWORD: string
    readonly VITE_SSH_HOSTNAME: string
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv
  }

  interface Window {
    __homeMcpUrl?: string
  }
}
