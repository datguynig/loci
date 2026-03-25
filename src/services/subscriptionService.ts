// src/services/subscriptionService.ts
import type { BillingInterval } from '../components/UpgradeModal'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string

export async function createCheckoutSession(
  tier: 'reader' | 'scholar',
  interval: BillingInterval,
  getToken: () => Promise<string | null | undefined>,
): Promise<void> {
  const token = await getToken()
  if (!token) throw new Error('Not authenticated')
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

export async function openCustomerPortal(
  getToken: () => Promise<string | null | undefined>,
): Promise<void> {
  const token = await getToken()
  if (!token) throw new Error('Not authenticated')
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
