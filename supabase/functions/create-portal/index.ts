// supabase/functions/create-portal/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Verify a Clerk HS256 JWT signed with the Supabase JWT secret.
async function verifyJWT(token: string, secret: string): Promise<{ sub: string } | null> {
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
    return { sub: payload.sub }
  } catch {
    return null
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!token) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

  const stripeKey   = Deno.env.get('STRIPE_SECRET_KEY')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const jwtSecret   = Deno.env.get('JWT_SECRET')!
  const appUrl      = Deno.env.get('APP_URL') ?? 'http://localhost:5173'

  if (!stripeKey || !serviceKey) {
    return new Response('Server misconfiguration', { status: 500, headers: corsHeaders })
  }

  const claims = await verifyJWT(token, jwtSecret)
  if (!claims) return new Response('Unauthorized', { status: 401, headers: corsHeaders })
  const userId = claims.sub

  const db = createClient(supabaseUrl, serviceKey)
  const { data: sub } = await db
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (!sub?.stripe_customer_id) {
    return new Response('No Stripe customer found', { status: 404, headers: corsHeaders })
  }

  const res = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${stripeKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      customer:   sub.stripe_customer_id,
      return_url: appUrl,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error('[create-portal] error:', err)
    return new Response('Stripe error', { status: 500, headers: corsHeaders })
  }

  const session = await res.json() as { url: string }
  return new Response(JSON.stringify({ url: session.url }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
