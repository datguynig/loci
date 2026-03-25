// supabase/functions/create-trial/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split('.')
  if (parts.length < 2) return {}
  try {
    return JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
  } catch {
    return {}
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace('Bearer ', '')
  if (!token) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

  const payload = decodeJwtPayload(token)
  const userId = payload.sub as string | undefined
  const email = payload.email as string | undefined
  if (!userId) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')!
  const priceId   = Deno.env.get('STRIPE_SCHOLAR_MONTHLY_PRICE_ID')!
  const supabaseUrl     = Deno.env.get('SUPABASE_URL')!
  const supabaseService = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const db = createClient(supabaseUrl, supabaseService)

  // Idempotency: bail out if row already exists
  const { data: existing } = await db
    .from('subscriptions')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle()
  if (existing) return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

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
    }),
  })
  if (!subRes.ok) {
    const err = await subRes.text()
    console.error('[create-trial] subscription error:', err)
    return new Response('Stripe subscription error', { status: 500, headers: corsHeaders })
  }
  const sub = await subRes.json() as { id: string; status: string; trial_end: number | null; current_period_end: number }

  // Insert subscription row
  const { error: dbError } = await db.from('subscriptions').insert({
    user_id:                userId,
    tier:                   'scholar',
    status:                 'trialing',
    trial_ends_at:          sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
    current_period_end:     new Date(sub.current_period_end * 1000).toISOString(),
    stripe_customer_id:     customer.id,
    stripe_subscription_id: sub.id,
    updated_at:             new Date().toISOString(),
  })
  if (dbError) {
    console.error('[create-trial] db insert error:', dbError)
    return new Response('DB error', { status: 500, headers: corsHeaders })
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
