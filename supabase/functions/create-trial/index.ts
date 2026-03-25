// supabase/functions/create-trial/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Verify a Clerk HS256 JWT signed with the Supabase JWT secret.
// We do this instead of auth.getUser() because users are in Clerk, not Supabase Auth,
// so auth.getUser() always returns null for Clerk-issued tokens.
async function verifyJWT(token: string, secret: string): Promise<{ sub: string; email?: string } | null> {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const [headerB64, payloadB64, sigB64] = parts

    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    )
    const sigBytes = Uint8Array.from(
      atob(sigB64.replace(/-/g, '+').replace(/_/g, '/')),
      (c) => c.charCodeAt(0),
    )
    const valid = await crypto.subtle.verify(
      'HMAC', key, sigBytes,
      new TextEncoder().encode(`${headerB64}.${payloadB64}`),
    )
    if (!valid) return null

    const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')))
    if (payload.exp && payload.exp < Date.now() / 1000) return null
    if (!payload.sub) return null
    return { sub: payload.sub, email: payload.email }
  } catch {
    return null
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace('Bearer ', '')
  if (!token) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

  const supabaseUrl     = Deno.env.get('SUPABASE_URL')!
  const supabaseService = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const jwtSecret       = Deno.env.get('SUPABASE_JWT_SECRET')!
  const stripeKey       = Deno.env.get('STRIPE_SECRET_KEY')!
  const priceId         = Deno.env.get('STRIPE_SCHOLAR_MONTHLY_PRICE_ID')!

  const claims = await verifyJWT(token, jwtSecret)
  if (!claims) return new Response('Unauthorized', { status: 401, headers: corsHeaders })
  const userId = claims.sub
  const email  = claims.email

  const db = createClient(supabaseUrl, supabaseService)

  // Idempotency guard — if a subscription row already exists for this user,
  // return immediately without touching Stripe. This prevents duplicate customers
  // and orphaned subscriptions from concurrent calls (multiple tabs, Strict Mode, etc.)
  // and from re-trial attempts after a DB row was manually deleted.
  const { data: existingRow } = await db
    .from('subscriptions')
    .select('stripe_customer_id, stripe_subscription_id, status')
    .eq('user_id', userId)
    .maybeSingle()

  if (existingRow) {
    console.log('[create-trial] row already exists for user, skipping', userId)
    return new Response(JSON.stringify({ ok: true, skipped: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Create Stripe customer
  const customerRes = await fetch('https://api.stripe.com/v1/customers', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${stripeKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ ...(email ? { email } : {}), 'metadata[user_id]': userId }),
  })
  if (!customerRes.ok) {
    const err = await customerRes.text()
    console.error('[create-trial] customer error:', err)
    return new Response('Stripe customer error', { status: 500, headers: corsHeaders })
  }
  const customer = await customerRes.json() as { id: string }

  // Create trial subscription — no payment method required
  const trialEnd = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60
  const subRes = await fetch('https://api.stripe.com/v1/subscriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${stripeKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      customer: customer.id,
      'items[0][price]': priceId,
      trial_end: String(trialEnd),
      'payment_settings[save_default_payment_method]': 'on_subscription',
      'subscription_data[metadata][user_id]': userId,
    }),
  })
  if (!subRes.ok) {
    const err = await subRes.text()
    console.error('[create-trial] subscription error:', err)
    return new Response('Stripe subscription error', { status: 500, headers: corsHeaders })
  }
  const sub = await subRes.json() as { id: string; status: string; trial_end: number | null; current_period_end: number | null }

  // Upsert — last-write-wins on user_id. The idempotency check above means
  // we should never reach here twice for the same user, but the upsert keeps
  // this safe even in extreme race conditions.
  const { error: dbError } = await db.from('subscriptions').upsert(
    {
      user_id:                userId,
      tier:                   'scholar',
      status:                 'trialing',
      trial_ends_at:          sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
      current_period_end:     sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
      stripe_customer_id:     customer.id,
      stripe_subscription_id: sub.id,
      updated_at:             new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  )
  if (dbError) {
    console.error('[create-trial] db upsert error:', dbError)
    return new Response('DB error', { status: 500, headers: corsHeaders })
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
