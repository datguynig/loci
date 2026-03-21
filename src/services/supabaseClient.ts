import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export function createSupabaseClient(getToken: () => Promise<string | null>): SupabaseClient {
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!url) throw new Error('VITE_SUPABASE_URL is not set')
  if (!key) throw new Error('VITE_SUPABASE_ANON_KEY is not set')

  return createClient(url, key, {
    auth: { persistSession: false },
    global: {
      fetch: async (input, init) => {
        const token = await getToken()
        if (!token) console.warn('[supabase] no Clerk token — request will be unauthenticated')
        const headers = new Headers((init as RequestInit)?.headers)
        if (token) headers.set('Authorization', `Bearer ${token}`)
        return fetch(input as RequestInfo, { ...(init as RequestInit), headers })
      },
    },
  })
}
