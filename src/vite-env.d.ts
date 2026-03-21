/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ELEVENLABS_API_KEY?: string
  readonly VITE_ELEVENLABS_PROXY_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
