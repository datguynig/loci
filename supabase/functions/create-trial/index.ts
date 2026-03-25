// supabase/functions/create-trial/index.ts
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

// Verify a Clerk JWT. Supports both HS256 (Supabase JWT template) and RS256
// (default Clerk signing). The alg is read from the JWT header so this works
// regardless of how the Clerk JWT template is configured.
//
// For HS256 the Supabase JWT secret is base64-encoded in storage; both
// PostgREST and Clerk sign/verify using the decoded raw bytes.  We also try
// the raw string bytes as a fallback to cover edge-cases.
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
      // Try base64-decoded bytes first (the standard Supabase/Clerk interpretation),
      // then raw UTF-8 bytes as a fallback.
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
  const token = authHeader.replace('Bearer ', '')
  if (!token) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

  const supabaseUrl     = Deno.env.get('SUPABASE_URL')!
  const supabaseService = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const jwksUrl         = Deno.env.get('CLERK_JWKS_URL')!
  const jwtSecret       = Deno.env.get('JWT_SECRET')!
  const stripeKey       = Deno.env.get('STRIPE_SECRET_KEY')!
  const priceId         = Deno.env.get('STRIPE_SCHOLAR_MONTHLY_PRICE_ID')!

  const claims = await verifyJWT(token, jwksUrl, jwtSecret)
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
