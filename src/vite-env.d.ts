/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_ATLAN_BASE_URL?: string;
  readonly VITE_ATLAN_API_KEY?: string;
  readonly VITE_PROXY_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
