// supabase/functions/create-checkout/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!token) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

  const stripeKey   = Deno.env.get('STRIPE_SECRET_KEY')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const appUrl      = Deno.env.get('APP_URL') ?? 'http://localhost:5173'

  if (!stripeKey || !serviceKey) {
    return new Response('Server misconfiguration', { status: 500, headers: corsHeaders })
  }

  // Verify JWT using Supabase auth (validates against configured JWT secret)
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data: { user }, error: authError } = await userClient.auth.getUser()
  if (authError || !user) return new Response('Unauthorized', { status: 401, headers: corsHeaders })
  const userId = user.id

  const { tier, interval } = await req.json() as { tier: 'reader' | 'scholar'; interval: 'monthly' | 'annual' }

  const priceMap: Record<string, string | undefined> = {
    'reader:monthly':  Deno.env.get('STRIPE_READER_MONTHLY_PRICE_ID'),
    'reader:annual':   Deno.env.get('STRIPE_READER_ANNUAL_PRICE_ID'),
    'scholar:monthly': Deno.env.get('STRIPE_SCHOLAR_MONTHLY_PRICE_ID'),
    'scholar:annual':  Deno.env.get('STRIPE_SCHOLAR_ANNUAL_PRICE_ID'),
  }
  const priceId = priceMap[`${tier}:${interval}`]
  if (!priceId) return new Response('Invalid tier/interval', { status: 400, headers: corsHeaders })

  // Look up existing Stripe customer ID
  const db = createClient(supabaseUrl, serviceKey)
  const { data: sub } = await db
    .from('subscriptions')
    .select('stripe_customer_id, stripe_subscription_id')
    .eq('user_id', userId)
    .maybeSingle()

  const checkoutBody: Record<string, string> = {
    mode: 'subscription',
    'line_items[0][price]': priceId,
    'line_items[0][quantity]': '1',
    'subscription_data[metadata][user_id]': userId,
    success_url: `${appUrl}?checkout=success`,
    cancel_url:  `${appUrl}?checkout=cancel`,
    'allow_promotion_codes': 'true',
  }

  if (sub?.stripe_customer_id) {
    checkoutBody['customer'] = sub.stripe_customer_id
  }

  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${stripeKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(checkoutBody),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error('[create-checkout] error:', err)
    return new Response('Stripe error', { status: 500, headers: corsHeaders })
  }

  const session = await res.json() as { url: string }
  return new Response(JSON.stringify({ url: session.url }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
