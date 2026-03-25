// supabase/functions/create-checkout/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// JWKS cache — refreshed at most once per hour per function instance
let _jwksKeys: CryptoKey[] | null = null
let _jwksCacheTs = 0

async function getJwksKeys(jwksUrl: string): Promise<CryptoKey[]> {
  const now = Date.now()
  if (_jwksKeys && now - _jwksCacheTs < 3_600_000) return _jwksKeys
  const res = await fetch(jwksUrl)
  if (!res.ok) throw new Error(`JWKS fetch failed: ${res.status}`)
  const { keys } = await res.json() as { keys: JsonWebKey[] }
  _jwksKeys = await Promise.all(
    keys.map(k =>
      crypto.subtle.importKey(
        'jwk', k,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['verify'],
      )
    )
  )
  _jwksCacheTs = now
  return _jwksKeys
}

// Verify a Clerk JWT. Supports both HS256 (Supabase JWT template) and RS256.
async function verifyJWT(
  token: string,
  jwksUrl: string,
  jwtSecretBase64: string,
): Promise<{ sub: string; email?: string } | null> {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const [headerB64, payloadB64, sigB64] = parts

    const header = JSON.parse(atob(headerB64.replace(/-/g, '+').replace(/_/g, '/')))
    console.log('[verifyJWT] alg:', header.alg)

    const sigBytes = Uint8Array.from(
      atob(sigB64.replace(/-/g, '+').replace(/_/g, '/')),
      c => c.charCodeAt(0),
    )
    const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`)

    let valid = false

    if (header.alg === 'RS256') {
      const keys = await getJwksKeys(jwksUrl)
      for (const key of keys) {
        try { valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, sigBytes, data) } catch { /* wrong key */ }
        if (valid) break
      }
    } else if (header.alg === 'HS256') {
      const decodedBytes = Uint8Array.from(
        atob(jwtSecretBase64.replace(/-/g, '+').replace(/_/g, '/')),
        c => c.charCodeAt(0),
      )
      const rawBytes = new TextEncoder().encode(jwtSecretBase64)

      for (const secretBytes of [decodedBytes, rawBytes]) {
        const key = await crypto.subtle.importKey(
          'raw', secretBytes,
          { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'],
        )
        valid = await crypto.subtle.verify('HMAC', key, sigBytes, data)
        if (valid) break
      }
    } else {
      console.error('[verifyJWT] unsupported algorithm:', header.alg)
      return null
    }

    if (!valid) {
      console.error('[verifyJWT] signature invalid for alg:', header.alg)
      return null
    }

    const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')))
    if (payload.exp && payload.exp < Date.now() / 1000) {
      console.error('[verifyJWT] token expired')
      return null
    }
    if (!payload.sub) return null
    return { sub: payload.sub, email: payload.email }
  } catch (e) {
    console.error('[verifyJWT] error:', e)
    return null
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!token) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

  const stripeKey        = Deno.env.get('STRIPE_SECRET_KEY')
  const supabaseUrl      = Deno.env.get('SUPABASE_URL')!
  const serviceKey       = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const jwksUrl          = Deno.env.get('CLERK_JWKS_URL')!
  const jwtSecret        = Deno.env.get('JWT_SECRET')!
  const appUrl           = Deno.env.get('APP_URL') ?? 'http://localhost:5173'
  const masterCouponCode = Deno.env.get('STRIPE_MASTER_COUPON_CODE')

  if (!stripeKey || !serviceKey) {
    return new Response('Server misconfiguration', { status: 500, headers: corsHeaders })
  }

  const claims = await verifyJWT(token, jwksUrl, jwtSecret)
  if (!claims) return new Response('Unauthorized', { status: 401, headers: corsHeaders })
  const userId = claims.sub

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

  // If a master coupon code is configured (for testing), pre-apply it.
  // 'allow_promotion_codes' and 'discounts' are mutually exclusive in Stripe.
  const checkoutBody: Record<string, string> = {
    mode: 'subscription',
    'line_items[0][price]': priceId,
    'line_items[0][quantity]': '1',
    'subscription_data[metadata][user_id]': userId,
    success_url: `${appUrl}?checkout=success`,
    cancel_url:  `${appUrl}?checkout=cancel`,
    ...(masterCouponCode
      ? { 'discounts[0][coupon]': masterCouponCode }
      : { 'allow_promotion_codes': 'true' }
    ),
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
