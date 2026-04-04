interface CustomEnv {
  NODE_ENV: 'development' | 'production';
  VITE_HA_URL: string;
  VITE_FOLDER_NAME: string;
  VITE_HA_TOKEN: string;
  [key: string]: unknown;
}

interface ImportMeta {
  env: CustomEnv;
}

declare global {
  namespace NodeJS {
    interface ProcessEnv extends CustomEnv {}
  }
}
