/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CLERK_PUBLISHABLE_KEY: string
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_STORAGE_API_URL: string
  readonly VITE_MINIO_PUBLIC_URL: string
  readonly VITE_ELEVENLABS_API_KEY?: string
  readonly VITE_ELEVENLABS_PROXY_URL?: string
  readonly VITE_E2E_TEST?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
