/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_N8N_WEBHOOK_URL?: string;
  readonly VITE_CALLBACK_URL?: string;
  readonly VITE_MOCK?: string;
  // add more environment variables here if needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
