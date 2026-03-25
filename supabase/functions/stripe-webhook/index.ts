// supabase/functions/stripe-webhook/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
}

async function verifyStripeSignature(payload: string, header: string, secret: string): Promise<boolean> {
  const parts = Object.fromEntries(header.split(',').map((p) => p.split('=')))
  const timestamp = parts['t']
  const signature = parts['v1']
  if (!timestamp || !signature) return false

  // Reject signatures older than 5 minutes to prevent replay attacks
  const timestampNum = parseInt(timestamp, 10)
  if (isNaN(timestampNum) || Math.abs(Date.now() / 1000 - timestampNum) > 300) return false

  const signedPayload = `${timestamp}.${payload}`
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedPayload))
  const expected = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('')
  return expected === signature
}

function tierFromPriceId(priceId: string): 'reader' | 'scholar' {
  const readerIds = [
    Deno.env.get('STRIPE_READER_MONTHLY_PRICE_ID'),
    Deno.env.get('STRIPE_READER_ANNUAL_PRICE_ID'),
  ]
  return readerIds.includes(priceId) ? 'reader' : 'scholar'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const body = await req.text()
  const sig  = req.headers.get('stripe-signature') ?? ''
  const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!

  const valid = await verifyStripeSignature(body, sig, secret)
  if (!valid) return new Response('Invalid signature', { status: 400 })

  const event = JSON.parse(body) as { type: string; data: { object: Record<string, unknown> }; created: number }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const db = createClient(supabaseUrl, serviceKey)

  const obj = event.data.object

  if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated') {
    const sub = obj as {
      id: string
      customer: string
      status: string
      trial_end: number | null
      current_period_end: number
      items: { data: Array<{ price: { id: string } }> }
      metadata: { user_id?: string }
    }

    const userId = sub.metadata?.user_id
    if (!userId) {
      console.warn('[stripe-webhook] no user_id in subscription metadata', sub.id)
      return new Response('ok')
    }

    const priceId = sub.items.data[0]?.price?.id ?? ''
    const tier    = tierFromPriceId(priceId)
    const status  = sub.status === 'trialing' ? 'trialing'
                  : sub.status === 'active'   ? 'active'
                  : sub.status === 'past_due' ? 'past_due'
                  : 'canceled'

    const updatedAt = new Date().toISOString()

    const { error: upsertError } = await db.from('subscriptions').upsert({
      user_id:                userId,
      tier,
      status,
      trial_ends_at:          sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
      current_period_end:     new Date(sub.current_period_end * 1000).toISOString(),
      stripe_customer_id:     sub.customer as string,
      stripe_subscription_id: sub.id,
      updated_at:             updatedAt,
    }, { onConflict: 'user_id' })
    if (upsertError) {
      console.error('[stripe-webhook] upsert error:', upsertError)
      return new Response('DB error', { status: 500 })
    }
  }

  else if (event.type === 'customer.subscription.deleted') {
    const sub = obj as { id: string; metadata: { user_id?: string } }
    const userId = sub.metadata?.user_id
    if (!userId) return new Response('ok')

    const { error: updateError } = await db.from('subscriptions')
      .update({ tier: 'free', status: 'canceled', updated_at: new Date().toISOString() })
      .eq('user_id', userId)
    if (updateError) console.error('[stripe-webhook] delete-update error:', updateError)
  }

  else if (event.type === 'invoice.payment_succeeded') {
    const inv = obj as { subscription: string }
    if (inv.subscription) {
      const { error: payErr } = await db.from('subscriptions')
        .update({ status: 'active', updated_at: new Date().toISOString() })
        .eq('stripe_subscription_id', inv.subscription)
      if (payErr) console.error('[stripe-webhook] payment-succeeded update error:', payErr)
    }
  }

  else if (event.type === 'invoice.payment_failed') {
    const inv = obj as { subscription: string }
    if (inv.subscription) {
      const { error: payErr } = await db.from('subscriptions')
        .update({ status: 'past_due', updated_at: new Date().toISOString() })
        .eq('stripe_subscription_id', inv.subscription)
      if (payErr) console.error('[stripe-webhook] payment-failed update error:', payErr)
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
