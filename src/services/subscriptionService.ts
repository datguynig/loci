// src/services/subscriptionService.ts
import type { BillingInterval } from '../components/UpgradeModal'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string

async function getSupabaseToken(): Promise<string> {
  // The Supabase client stores its session; we grab it from localStorage
  // (same approach used by all other services in the app).
  const key = Object.keys(localStorage).find((k) => k.startsWith('sb-') && k.endsWith('-auth-token'))
  if (!key) throw new Error('Not authenticated')
  const stored = JSON.parse(localStorage.getItem(key) ?? '{}') as { access_token?: string }
  if (!stored.access_token) throw new Error('No access token')
  return stored.access_token
}

export async function createCheckoutSession(
  tier: 'reader' | 'scholar',
  interval: BillingInterval,
): Promise<void> {
  const token = await getSupabaseToken()
  const res = await fetch(`${SUPABASE_URL}/functions/v1/create-checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ tier, interval }),
  })
  if (!res.ok) throw new Error(`Checkout error ${res.status}`)
  const { url } = await res.json() as { url: string }
  window.location.href = url
}

export async function openCustomerPortal(): Promise<void> {
  const token = await getSupabaseToken()
  const res = await fetch(`${SUPABASE_URL}/functions/v1/create-portal`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  })
  if (!res.ok) throw new Error(`Portal error ${res.status}`)
  const { url } = await res.json() as { url: string }
  window.location.href = url
}
