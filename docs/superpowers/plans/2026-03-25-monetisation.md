# Loci Monetisation — Plan A: Subscription Gating

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the freemium subscription model — Supabase subscriptions table, `useSubscription` hook, Stripe trial and checkout flow, feature gating in all components, and a redesigned landing page.

**Architecture:** `useSubscription(supabase, userId)` is called once in `AppContent` (App.tsx) and the result is passed as props down to `Library`, `Reader`, and all gating components. A `canAccess(feature)` function is the single gate used everywhere. Stripe checkout is handled server-side via two Supabase edge functions (`create-trial` and `create-checkout`). Subscription state is kept in sync via a `stripe-webhook` edge function. The TTS provider migration (ElevenLabs → Azure) is **Plan B** and is not in this plan — narration gating in this plan is wired up correctly but uses the existing ElevenLabs pathway.

**Tech Stack:** React 18 + TypeScript, Supabase (Postgres + edge functions + RLS), Stripe API (subscriptions, webhooks, customer portal), Clerk auth (JWT template: `supabase`), Vite

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `supabase/migrations/20260321000005_subscriptions.sql` | Create | subscriptions table + RLS |
| `src/hooks/useSubscription.ts` | Create | Load subscription state; expose `canAccess` |
| `supabase/functions/create-trial/index.ts` | Create | Create Stripe customer + 7-day Scholar trial on first sign-up |
| `src/components/UpgradeModal.tsx` | Create | Two-tier pricing modal shown when gated feature is tapped |
| `src/components/TrialBanner.tsx` | Create | "X days left in trial" persistent banner |
| `src/App.tsx` | Modify | Call `useSubscription`; pass `subscription` to Library and Reader; render `TrialBanner` |
| `src/components/Library.tsx` | Modify | Gate 6th-book upload behind `canAccess('unlimited-books')` |
| `src/components/Reader.tsx` | Modify | Gate scratchpad open behind `canAccess('scratchpad')` |
| `src/components/AudioBar.tsx` | Modify | Replace `HAS_ELEVENLABS` with `canAccess` checks for narration tiers |
| `src/components/StudyPanel.tsx` | Modify | Gate quiz/brief/study-guide/flashcards behind `canAccess` |
| `src/services/subscriptionService.ts` | Create | `createCheckoutSession`, `openCustomerPortal` client helpers |
| `supabase/functions/create-checkout/index.ts` | Create | Create Stripe checkout session server-side |
| `supabase/functions/create-portal/index.ts` | Create | Create Stripe customer portal session server-side |
| `supabase/functions/stripe-webhook/index.ts` | Create | Handle Stripe subscription lifecycle events |
| `src/components/Landing.tsx` | Modify | Three-tier pricing, updated copy, FAQ rewrites, student note, AI footnote |

---

## Task 1: Database migration — subscriptions table

**Files:**
- Create: `supabase/migrations/20260321000005_subscriptions.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260321000005_subscriptions.sql
create table if not exists public.subscriptions (
  user_id                 text primary key,
  tier                    text not null default 'free',
  status                  text not null default 'trialing',
  trial_ends_at           timestamptz,
  current_period_end      timestamptz,
  stripe_customer_id      text unique,
  stripe_subscription_id  text unique,
  updated_at              timestamptz not null default now()
);

comment on column public.subscriptions.tier   is 'free | reader | scholar';
comment on column public.subscriptions.status is 'trialing | active | canceled | past_due';

alter table public.subscriptions enable row level security;

create policy "Users can read own subscription"
  on public.subscriptions for select
  using ((auth.jwt() ->> 'sub') = user_id);

create policy "Service role can manage subscriptions"
  on public.subscriptions for all
  using (auth.role() = 'service_role');
```

- [ ] **Step 2: Apply to local Supabase**

```bash
npx supabase db push
```
Expected: migration applied, no errors.

- [ ] **Step 3: Verify table exists**

```bash
npx supabase db diff --local
```
Expected: no diff (migration is applied).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260321000005_subscriptions.sql
git commit -m "feat: add subscriptions table with RLS"
```

---

## Task 2: `useSubscription` hook

**Files:**
- Create: `src/hooks/useSubscription.ts`

This hook loads the user's subscription from Supabase, calls `create-trial` if no row exists (first-ever sign-in), and exposes `canAccess(feature)`.

`canAccess` rules:
- `'loci-narration'` → tier is `reader` or `scholar` (or trialing scholar)
- `'loci-narration-pro'` → tier is `scholar`
- `'unlimited-books'` → tier is `reader` or `scholar`
- `'scratchpad'` → tier is `reader` or `scholar`
- `'practice-quizzes'` → tier is `scholar`
- `'chapter-briefs'` → tier is `scholar`
- `'study-guide'` → tier is `scholar`
- `'flashcards'` → tier is `scholar`

During a Scholar trial (`status === 'trialing'` and `tier === 'scholar'`), `canAccess` returns `true` for all Scholar features.

- [ ] **Step 1: Write the hook**

```typescript
// src/hooks/useSubscription.ts
import { useState, useEffect, useCallback } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

export type SubscriptionTier = 'free' | 'reader' | 'scholar'
export type SubscriptionStatus = 'loading' | 'trialing' | 'active' | 'canceled' | 'past_due'

export type SubscriptionFeature =
  | 'loci-narration'
  | 'loci-narration-pro'
  | 'unlimited-books'
  | 'scratchpad'
  | 'practice-quizzes'
  | 'chapter-briefs'
  | 'study-guide'
  | 'flashcards'

export interface SubscriptionState {
  tier: SubscriptionTier
  status: SubscriptionStatus
  trialEndsAt: Date | null
  isTrialing: boolean
  canAccess: (feature: SubscriptionFeature) => boolean
}

const READER_FEATURES: SubscriptionFeature[] = [
  'loci-narration',
  'unlimited-books',
  'scratchpad',
]

const SCHOLAR_FEATURES: SubscriptionFeature[] = [
  'loci-narration',
  'loci-narration-pro',
  'unlimited-books',
  'scratchpad',
  'practice-quizzes',
  'chapter-briefs',
  'study-guide',
  'flashcards',
]

// Trialing Scholar users have tier='scholar' and status='trialing'.
// Because tier drives canAccess (not status), all Scholar features are accessible during the trial.
// The status field is used only to show the TrialBanner and for display purposes.
function buildCanAccess(tier: SubscriptionTier, status: SubscriptionStatus): (f: SubscriptionFeature) => boolean {
  if (status === 'loading') return () => false
  if (status === 'canceled') return () => false
  if (tier === 'scholar') return (f) => SCHOLAR_FEATURES.includes(f)
  if (tier === 'reader') return (f) => READER_FEATURES.includes(f)
  return () => false
}

const LOADING_STATE: SubscriptionState = {
  tier: 'free',
  status: 'loading',
  trialEndsAt: null,
  isTrialing: false,
  canAccess: () => false,
}

export function useSubscription(
  supabase: SupabaseClient | null,
  userId: string | null | undefined,
): SubscriptionState {
  const [state, setState] = useState<SubscriptionState>(LOADING_STATE)

  const load = useCallback(async () => {
    if (!supabase || !userId) {
      setState(LOADING_STATE)
      return
    }

    const { data, error } = await supabase
      .from('subscriptions')
      .select('tier, status, trial_ends_at, current_period_end')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) {
      console.error('[useSubscription] load error:', error)
      setState({ ...LOADING_STATE, status: 'active' })
      return
    }

    if (!data) {
      // First ever sign-in — start the Scholar trial
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        const token = sessionData?.session?.access_token
        await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-trial`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
          },
        )
        // Re-load after trial creation
        await load()
      } catch (e) {
        console.error('[useSubscription] create-trial error:', e)
        // Fall back to free so app is usable
        setState({ tier: 'free', status: 'active', trialEndsAt: null, isTrialing: false, canAccess: () => false })
      }
      return
    }

    const tier = (data.tier ?? 'free') as SubscriptionTier
    const status = (data.status ?? 'active') as SubscriptionStatus
    const trialEndsAt = data.trial_ends_at ? new Date(data.trial_ends_at) : null
    const isTrialing = status === 'trialing'

    setState({
      tier,
      status,
      trialEndsAt,
      isTrialing,
      canAccess: buildCanAccess(tier, status),
    })
  }, [supabase, userId])

  useEffect(() => {
    load()
  }, [load])

  return state
}
```

- [ ] **Step 2: Build to verify types**

```bash
npm run build 2>&1 | head -30
```
Expected: builds without TypeScript errors related to the new hook.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useSubscription.ts
git commit -m "feat: add useSubscription hook with canAccess gating"
```

---

## Task 3: `create-trial` Supabase edge function

**Files:**
- Create: `supabase/functions/create-trial/index.ts`

This function is called once per new user. It creates a Stripe customer, starts a 7-day Scholar trial subscription (no payment method required), and inserts a row in the `subscriptions` table.

**Required Supabase secrets (set before deploying):**
- `STRIPE_SECRET_KEY` — Stripe API secret key
- `STRIPE_SCHOLAR_MONTHLY_PRICE_ID` — Stripe Price ID for Scholar monthly plan

- [ ] **Step 1: Write the edge function**

```typescript
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
```

- [ ] **Step 2: Build to verify types**

```bash
npm run build 2>&1 | head -10
```
Expected: no new TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/create-trial/index.ts
git commit -m "feat: add create-trial edge function for Stripe Scholar trial"
```

---

## Task 4: `UpgradeModal` and `TrialBanner` components

**Files:**
- Create: `src/components/UpgradeModal.tsx`
- Create: `src/components/TrialBanner.tsx`

`UpgradeModal` shows the Reader/Scholar pricing cards with a monthly/annual toggle and a "Get started" CTA. It also shows the STUDENT code note on the Scholar card. It calls `createCheckoutSession` (from `subscriptionService.ts`, wired in Task 10) when the user clicks a CTA.

For now, `UpgradeModal` accepts an `onCheckout` callback so it can be tested independently of Stripe.

`TrialBanner` shows "X days left in your Scholar trial" with an "Upgrade" button.

- [ ] **Step 1: Write `UpgradeModal.tsx`**

```typescript
// src/components/UpgradeModal.tsx
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export type BillingInterval = 'monthly' | 'annual'

interface UpgradeModalProps {
  isOpen: boolean
  onClose: () => void
  onCheckout: (tier: 'reader' | 'scholar', interval: BillingInterval) => void
  defaultTier?: 'reader' | 'scholar'
}

export default function UpgradeModal({ isOpen, onClose, onCheckout, defaultTier = 'scholar' }: UpgradeModalProps) {
  const [interval, setInterval] = useState<BillingInterval>('monthly')
  const [loading, setLoading] = useState<string | null>(null)

  const readerPrice  = interval === 'monthly' ? '$7.99/mo' : '$79/yr'
  const scholarPrice = interval === 'monthly' ? '$13.99/mo' : '$139/yr'

  async function handleCTA(tier: 'reader' | 'scholar') {
    setLoading(tier)
    try {
      await onCheckout(tier, interval)
    } finally {
      setLoading(null)
    }
  }

  const card: React.CSSProperties = {
    flex: 1,
    borderRadius: 14,
    padding: '20px 18px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  }

  const btn: React.CSSProperties = {
    width: '100%',
    padding: '11px 0',
    borderRadius: 9,
    border: 'none',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: '"DM Sans", system-ui, sans-serif',
    marginTop: 'auto',
  }

  const featureList = (items: string[]) => (
    <ul style={{ margin: 0, padding: '0 0 0 14px', fontSize: 13, lineHeight: 1.9, opacity: 0.8, fontFamily: '"DM Sans", system-ui, sans-serif' }}>
      {items.map((item) => <li key={item}>{item}</li>)}
    </ul>
  )

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            style={{ background: 'var(--bg-primary)', borderRadius: 18, padding: 24, width: '100%', maxWidth: 600, boxShadow: '0 24px 80px rgba(0,0,0,0.25)' }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <div style={{ fontFamily: '"Playfair Display", Georgia, serif', fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>
                  Upgrade Loci
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-tertiary)', fontFamily: '"DM Sans", system-ui, sans-serif', marginTop: 4 }}>
                  Choose the plan that fits how you read.
                </div>
              </div>
              <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 4 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Billing toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, fontFamily: '"DM Sans", system-ui, sans-serif', fontSize: 13 }}>
              <span style={{ opacity: interval === 'monthly' ? 1 : 0.5, fontWeight: interval === 'monthly' ? 600 : 400 }}>Monthly</span>
              <button
                onClick={() => setInterval(i => i === 'monthly' ? 'annual' : 'monthly')}
                style={{
                  width: 42, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', position: 'relative',
                  background: interval === 'annual' ? 'var(--accent)' : 'var(--border)',
                  transition: 'background 200ms',
                }}
              >
                <span style={{
                  position: 'absolute', top: 3, left: interval === 'annual' ? 21 : 3,
                  width: 18, height: 18, borderRadius: 9, background: '#fff',
                  transition: 'left 200ms', display: 'block',
                }} />
              </button>
              <span style={{ opacity: interval === 'annual' ? 1 : 0.5, fontWeight: interval === 'annual' ? 600 : 400 }}>
                Annual <span style={{ background: 'var(--accent)', color: '#fff', fontSize: 11, borderRadius: 99, padding: '1px 7px', marginLeft: 4 }}>Save 2 months</span>
              </span>
            </div>

            {/* Cards */}
            <div style={{ display: 'flex', gap: 14 }}>
              {/* Reader */}
              <div style={{ ...card, border: defaultTier === 'reader' ? '2px solid #2563eb' : '1px solid var(--border)', background: defaultTier === 'reader' ? 'rgba(37,99,235,0.03)' : 'var(--bg-secondary)' }}>
                <div style={{ fontFamily: '"DM Sans", system-ui, sans-serif', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#2563eb' }}>Loci Reader</div>
                <div style={{ fontFamily: '"Playfair Display", Georgia, serif', fontSize: 26, fontWeight: 800, color: '#2563eb' }}>{readerPrice}</div>
                {featureList(['Unlimited books', 'Loci Narration — lifelike voices', 'Word-by-word highlighting', 'Scratchpad'])}
                <button
                  style={{ ...btn, background: '#2563eb', color: '#fff', opacity: loading ? 0.7 : 1 }}
                  disabled={loading !== null}
                  onClick={() => handleCTA('reader')}
                >
                  {loading === 'reader' ? 'Loading…' : 'Get Reader'}
                </button>
              </div>

              {/* Scholar */}
              <div style={{ ...card, border: '2px solid #7c3aed', background: 'rgba(124,58,237,0.03)', position: 'relative' }}>
                <div style={{ position: 'absolute', top: -1, right: 16, background: '#7c3aed', color: '#fff', fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: '0 0 8px 8px', letterSpacing: '0.04em', fontFamily: '"DM Sans", system-ui, sans-serif' }}>MOST POPULAR</div>
                <div style={{ fontFamily: '"DM Sans", system-ui, sans-serif', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#7c3aed' }}>Loci Scholar</div>
                <div style={{ fontFamily: '"Playfair Display", Georgia, serif', fontSize: 26, fontWeight: 800, color: '#7c3aed' }}>{scholarPrice}</div>
                {featureList(['Everything in Reader', 'Narration Pro — audiobook-quality voices', 'Practice Quizzes', 'Chapter Briefs', 'Study Guide', 'Flashcards'])}
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: '"DM Sans", system-ui, sans-serif', opacity: 0.7 }}>
                  Students: use code <strong>STUDENT</strong> at checkout for $9.99/mo
                </div>
                <button
                  style={{ ...btn, background: '#7c3aed', color: '#fff', opacity: loading ? 0.7 : 1 }}
                  disabled={loading !== null}
                  onClick={() => handleCTA('scholar')}
                >
                  {loading === 'scholar' ? 'Loading…' : 'Get Scholar'}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
```

- [ ] **Step 2: Write `TrialBanner.tsx`**

```typescript
// src/components/TrialBanner.tsx
interface TrialBannerProps {
  trialEndsAt: Date | null
  onUpgrade: () => void
}

export default function TrialBanner({ trialEndsAt, onUpgrade }: TrialBannerProps) {
  if (!trialEndsAt) return null
  const daysLeft = Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
  if (daysLeft === 0) return null

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: '8px 16px',
        background: 'rgba(124,58,237,0.08)',
        borderBottom: '1px solid rgba(124,58,237,0.15)',
        fontFamily: '"DM Sans", system-ui, sans-serif',
        fontSize: 13,
        color: 'var(--text-secondary)',
      }}
    >
      <span>
        {daysLeft === 1
          ? 'Last day of your Scholar trial'
          : `${daysLeft} days left in your Scholar trial`}
      </span>
      <button
        onClick={onUpgrade}
        style={{
          background: '#7c3aed',
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          padding: '4px 12px',
          fontSize: 12,
          fontWeight: 700,
          cursor: 'pointer',
          fontFamily: '"DM Sans", system-ui, sans-serif',
        }}
      >
        Upgrade
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Build to verify types**

```bash
npm run build 2>&1 | head -30
```
Expected: no new TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/UpgradeModal.tsx src/components/TrialBanner.tsx
git commit -m "feat: add UpgradeModal and TrialBanner components"
```

---

## Task 5: Wire subscription into App.tsx

**Files:**
- Modify: `src/App.tsx`

Call `useSubscription` in `AppContent`, pass `subscription` to `Library` and `Reader`, render `TrialBanner` at the top of the authenticated app, and manage `UpgradeModal` state centrally.

- [ ] **Step 1: Add imports to App.tsx**

Add after existing imports (around line 14):

```typescript
import { useSubscription } from './hooks/useSubscription'
import UpgradeModal from './components/UpgradeModal'
import TrialBanner from './components/TrialBanner'
import type { SubscriptionState } from './hooks/useSubscription'
```

- [ ] **Step 2: Call `useSubscription` in AppContent**

Inside `AppContent`, after `const { user } = useUser()` (around line 99), add:

```typescript
const subscription = useSubscription(supabase, user?.id)
const [upgradeOpen, setUpgradeOpen] = useState(false)
```

- [ ] **Step 3: Pass subscription to Library and Reader**

Update the `Library` JSX (line ~159) to add:
```typescript
subscription={subscription}
onUpgrade={() => setUpgradeOpen(true)}
```

Update the `Reader` JSX (line ~161) to add:
```typescript
subscription={subscription}
onUpgrade={() => setUpgradeOpen(true)}
```

- [ ] **Step 4: Add TrialBanner and UpgradeModal to the render**

Wrap the `AnimatePresence` return in a fragment and add the banner and modal:

```typescript
return (
  <>
    {subscription.isTrialing && (
      <TrialBanner
        trialEndsAt={subscription.trialEndsAt}
        onUpgrade={() => setUpgradeOpen(true)}
      />
    )}
    <AnimatePresence mode="wait">
      {/* ...existing Library/Reader AnimatePresence content unchanged... */}
    </AnimatePresence>
    <UpgradeModal
      isOpen={upgradeOpen}
      onClose={() => setUpgradeOpen(false)}
      onCheckout={async (tier, interval) => {
        // Wired in Task 10
        const { createCheckoutSession } = await import('./services/subscriptionService')
        await createCheckoutSession(tier, interval)
      }}
    />
  </>
)
```

- [ ] **Step 5: Update Library props interface**

In `src/components/Library.tsx`, find the `interface LibraryProps` (or inline props type) and add:

```typescript
subscription: SubscriptionState
onUpgrade: () => void
```

- [ ] **Step 6: Update Reader props interface**

In `src/components/Reader.tsx`, find the `interface ReaderProps` and add:

```typescript
subscription: SubscriptionState
onUpgrade: () => void
```

- [ ] **Step 7: Build to verify types**

```bash
npm run build 2>&1 | head -40
```
Expected: TypeScript errors only about unused `subscription`/`onUpgrade` props until the next tasks gate features — that's fine, the build should fail only on "declared but never read" if tsconfig has `noUnusedParameters`; otherwise it should pass.

- [ ] **Step 8: Commit**

```bash
git add src/App.tsx src/components/Library.tsx src/components/Reader.tsx
git commit -m "feat: wire useSubscription into App, add TrialBanner and UpgradeModal"
```

---

## Task 6: Feature gate — Library book count

**Files:**
- Modify: `src/components/Library.tsx`
- Modify: `src/hooks/useLibrary.ts`

Free tier is limited to 5 books. When a Free user tries to upload a 6th, show the upgrade modal instead.

- [ ] **Step 1: Add guard to `handleFiles` in Library.tsx**

Find `handleFiles` (around line 150). Replace it with:

```typescript
const handleFiles = useCallback(
  async (files: FileList | null) => {
    if (!files?.length) return
    const file = files[0]
    if (!file.name.toLowerCase().endsWith('.epub')) return
    // Free tier: cap at 5 books
    if (!subscription.canAccess('unlimited-books') && books.length >= 5) {
      onUpgrade()
      return
    }
    const book = await upload(file)
    if (book) onOpenBook(file, book.id)
  },
  [upload, onOpenBook, subscription, books.length, onUpgrade],
)
```

- [ ] **Step 2: Show upgrade nudge on the upload button when at limit**

Find the upload/drag-drop area in Library.tsx. Add a visual indicator when Free tier is at the 5-book limit. Locate the upload button/area (search for `fileInputRef`) and add a note next to it:

```typescript
{!subscription.canAccess('unlimited-books') && books.length >= 5 && (
  <div style={{ fontFamily: '"DM Sans", system-ui, sans-serif', fontSize: 12, color: 'var(--text-tertiary)', marginTop: 6 }}>
    Free plan: 5 books maximum.{' '}
    <button
      onClick={onUpgrade}
      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7c3aed', fontSize: 12, padding: 0, fontFamily: 'inherit', textDecoration: 'underline' }}
    >
      Upgrade to add more
    </button>
  </div>
)}
```

- [ ] **Step 3: Build and verify**

```bash
npm run build 2>&1 | head -20
```
Expected: clean build.

- [ ] **Step 4: Manual verification**

1. Set `tier = 'free'` in the `subscriptions` table for your dev user in Supabase dashboard.
2. Reload app. Upload 5 books. On the 6th upload attempt, the upgrade modal should appear.

- [ ] **Step 5: Commit**

```bash
git add src/components/Library.tsx
git commit -m "feat: gate 6th book upload behind unlimited-books access"
```

---

## Task 7: Feature gate — Scratchpad

**Files:**
- Modify: `src/components/Reader.tsx`

The scratchpad is a Reader+ feature. Free users who tap the scratchpad button should see the upgrade modal instead.

- [ ] **Step 1: Update `openScratchpad` in Reader.tsx**

Find `openScratchpad` function (around line 167):

```typescript
const openScratchpad = () => {
  setScratchpadOpen(true)
}
```

Replace with:

```typescript
const openScratchpad = () => {
  if (!subscription.canAccess('scratchpad')) {
    onUpgrade()
    return
  }
  setScratchpadOpen(true)
}
```

- [ ] **Step 2: Also guard the studyOptions auto-open**

Find where `studyOptions?.panel === 'scratchpad'` is handled (around line 177):

```typescript
} else if (studyOptions?.panel === 'scratchpad') {
  setScratchpadOpen(true)
}
```

Replace with:

```typescript
} else if (studyOptions?.panel === 'scratchpad') {
  if (subscription.canAccess('scratchpad')) {
    setScratchpadOpen(true)
  }
}
```

- [ ] **Step 3: Build and verify**

```bash
npm run build 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add src/components/Reader.tsx
git commit -m "feat: gate scratchpad behind Reader+ subscription"
```

---

## Task 8: Feature gate — AudioBar narration tiers

**Files:**
- Modify: `src/components/AudioBar.tsx`

Replace the `HAS_ELEVENLABS` constant with subscription-aware gating. The play button should gate on `canAccess('loci-narration')`. The voice picker should show Narration Pro options only for Scholar.

**Note:** This plan wires the subscription gate but keeps the existing ElevenLabs provider. Plan B (TTS migration) will replace the provider. The gate logic must be in place for when Plan B ships.

AudioBar currently receives props from Reader.tsx. Add `subscription` and `onUpgrade` to AudioBar's props.

- [ ] **Step 1: Update AudioBar props interface**

Find the `interface AudioBarProps` (around line 14 in AudioBar.tsx). Remove the existing narration gate comments and add:

```typescript
subscription: SubscriptionState
onUpgrade: () => void
```

Also add the import at the top:

```typescript
import type { SubscriptionState } from '../hooks/useSubscription'
```

- [ ] **Step 2: Replace `HAS_ELEVENLABS` constant**

Remove line 12:
```typescript
const HAS_ELEVENLABS = hasElevenLabs()
```

Replace all references to `HAS_ELEVENLABS` in the file with `subscription.canAccess('loci-narration')`.

**Find all occurrences:**
```bash
grep -n "HAS_ELEVENLABS" src/components/AudioBar.tsx
```

Replace each `HAS_ELEVENLABS` with `subscription.canAccess('loci-narration')`.

- [ ] **Step 3: Gate the play button**

Find the main play/pause button in AudioBar. When `!subscription.canAccess('loci-narration')` and the user tries to trigger narration (i.e. they're on Free), intercept the play action to call `onUpgrade()` instead.

Locate the `onPlay` or play button's `onClick` handler. Wrap it:

```typescript
onClick={() => {
  if (!subscription.canAccess('loci-narration')) {
    onUpgrade()
    return
  }
  // existing play handler
}}
```

- [ ] **Step 4: Pass subscription and onUpgrade from Reader.tsx to AudioBar**

In `src/components/Reader.tsx`, find where `<AudioBar` is rendered and add:

```typescript
subscription={subscription}
onUpgrade={onUpgrade}
```

- [ ] **Step 5: Build and verify**

```bash
npm run build 2>&1 | head -20
```

- [ ] **Step 6: Commit**

```bash
git add src/components/AudioBar.tsx src/components/Reader.tsx
git commit -m "feat: gate narration behind subscription tier in AudioBar"
```

---

## Task 9: Feature gate — StudyPanel scholar tools

**Files:**
- Modify: `src/components/StudyPanel.tsx`

Quiz, Chapter Brief, Study Guide, and Flashcards are Scholar-only. Add `subscription` and `onUpgrade` props, then gate each tool's entry point.

- [ ] **Step 1: Add props to StudyPanel**

Find the props interface (around line 11 of StudyPanel.tsx). Add:

```typescript
subscription: SubscriptionState
onUpgrade: () => void
```

Add import at the top:

```typescript
import type { SubscriptionState } from '../hooks/useSubscription'
```

- [ ] **Step 2: Gate each scholar feature button**

StudyPanel has buttons/triggers for: Quiz, Chapter Brief (Summary), Study Guide, Flashcards. For each, wrap the `onClick` handler:

```typescript
onClick={() => {
  if (!subscription.canAccess('practice-quizzes')) { // use correct feature key per button
    onUpgrade()
    return
  }
  // existing handler
}}
```

Feature keys by tool:
- Quiz → `'practice-quizzes'`
- Chapter Brief / Summary → `'chapter-briefs'`
- Study Guide → `'study-guide'`
- Flashcards → `'flashcards'`

Also add a visual lock indicator next to each gated feature button when `!subscription.canAccess(feature)`:

```typescript
{!subscription.canAccess('practice-quizzes') && (
  <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 4 }}>Scholar</span>
)}
```

- [ ] **Step 3: Pass subscription and onUpgrade from Reader.tsx to StudyPanel**

Find `<StudyPanel` render in Reader.tsx and add:

```typescript
subscription={subscription}
onUpgrade={onUpgrade}
```

- [ ] **Step 4: Build and verify**

```bash
npm run build 2>&1 | head -20
```
Expected: clean build.

- [ ] **Step 5: Manual end-to-end gating test**

1. In Supabase, set `tier = 'free', status = 'active'` for your dev user.
2. Reload app. Verify:
   - Play button → upgrade modal
   - Scratchpad button → upgrade modal
   - Quiz button → upgrade modal
   - Upload 6th book → upgrade modal
3. Set `tier = 'reader', status = 'active'`. Verify:
   - Narration works
   - Scratchpad works
   - Unlimited books allowed
   - Quiz/Brief/Study Guide/Flashcards → upgrade modal
4. Set `tier = 'scholar', status = 'active'`. Verify all features work.
5. Set `status = 'trialing'` with `tier = 'scholar'`. Verify trial banner shows and all Scholar features work.

- [ ] **Step 6: Commit**

```bash
git add src/components/StudyPanel.tsx src/components/Reader.tsx
git commit -m "feat: gate scholar study tools behind subscription in StudyPanel"
```

---

## Task 10: `subscriptionService.ts` + `create-checkout` edge function

**Files:**
- Create: `src/services/subscriptionService.ts`
- Create: `supabase/functions/create-checkout/index.ts`

`createCheckoutSession` creates a Stripe checkout session via the edge function and redirects the user to Stripe. `openCustomerPortal` redirects to the Stripe customer portal for plan management and cancellation.

**Required Supabase secrets:**
- `STRIPE_SECRET_KEY`
- `STRIPE_READER_MONTHLY_PRICE_ID`
- `STRIPE_READER_ANNUAL_PRICE_ID`
- `STRIPE_SCHOLAR_MONTHLY_PRICE_ID`
- `STRIPE_SCHOLAR_ANNUAL_PRICE_ID`
- `STRIPE_STUDENT_COUPON_ID` (optional, for STUDENT code enforcement)
- `APP_URL` — the app's base URL for success/cancel redirects

**Required Vite env var:**
- `VITE_SUPABASE_URL` — already in use

- [ ] **Step 1: Write the `create-checkout` edge function**

```typescript
// supabase/functions/create-checkout/index.ts
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
  if (!userId) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

  const { tier, interval } = await req.json() as { tier: 'reader' | 'scholar'; interval: 'monthly' | 'annual' }

  const stripeKey   = Deno.env.get('STRIPE_SECRET_KEY')!
  const appUrl      = Deno.env.get('APP_URL') ?? 'http://localhost:5173'
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

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

  // If user already has an active subscription, upgrade via subscription update instead
  // For simplicity at launch, we always create a new checkout session.
  // The webhook handles the tier update when the new subscription activates.

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
```

- [ ] **Step 2: Write `subscriptionService.ts`**

```typescript
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
```

- [ ] **Step 3: Write the `create-portal` edge function**

`openCustomerPortal` in `subscriptionService.ts` calls this function. It creates a Stripe billing portal session so users can manage their plan or cancel.

```typescript
// supabase/functions/create-portal/index.ts
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
  if (!userId) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

  const stripeKey   = Deno.env.get('STRIPE_SECRET_KEY')!
  const appUrl      = Deno.env.get('APP_URL') ?? 'http://localhost:5173'
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

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
      customer:     sub.stripe_customer_id,
      return_url:   appUrl,
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
```

**Note:** Stripe Customer Portal must be configured in the Stripe dashboard (Settings → Customer portal) before this works. Set the portal's "Return URL" to your `APP_URL`.

- [ ] **Step 4: Build and verify**

```bash
npm run build 2>&1 | head -20
```

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/create-checkout/index.ts supabase/functions/create-portal/index.ts src/services/subscriptionService.ts
git commit -m "feat: add create-checkout, create-portal edge functions and subscriptionService"
```

---

## Task 11: `stripe-webhook` edge function

**Files:**
- Create: `supabase/functions/stripe-webhook/index.ts`

This function handles Stripe subscription lifecycle events and keeps the `subscriptions` table in sync.

**Required Supabase secrets:**
- `STRIPE_WEBHOOK_SECRET` — Stripe webhook signing secret (from Stripe dashboard)
- `STRIPE_SECRET_KEY`

**Stripe webhook events to handle:**

| Event | Action |
|---|---|
| `customer.subscription.created` | Upsert with `tier='scholar'`, `status='trialing'` |
| `customer.subscription.updated` | Update `tier`, `status`, `current_period_end` |
| `customer.subscription.deleted` | Set `tier='free'`, `status='canceled'` |
| `invoice.payment_succeeded` | Set `status='active'` |
| `invoice.payment_failed` | Set `status='past_due'` |

**Tier resolution from Stripe subscription:** The price ID on the subscription's items is compared against known price IDs to determine `tier`. Use `metadata.user_id` on the subscription to identify the user.

- [ ] **Step 1: Write the edge function**

```typescript
// supabase/functions/stripe-webhook/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createHmac } from 'https://deno.land/std@0.168.0/crypto/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
}

async function verifyStripeSignature(payload: string, header: string, secret: string): Promise<boolean> {
  const parts = Object.fromEntries(header.split(',').map((p) => p.split('=')))
  const timestamp = parts['t']
  const signature = parts['v1']
  if (!timestamp || !signature) return false

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

    await db.from('subscriptions').upsert({
      user_id:                userId,
      tier,
      status,
      trial_ends_at:          sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
      current_period_end:     new Date(sub.current_period_end * 1000).toISOString(),
      stripe_customer_id:     sub.customer as string,
      stripe_subscription_id: sub.id,
      updated_at:             updatedAt,
    }, { onConflict: 'stripe_subscription_id' })
  }

  else if (event.type === 'customer.subscription.deleted') {
    const sub = obj as { id: string; metadata: { user_id?: string } }
    const userId = sub.metadata?.user_id
    if (!userId) return new Response('ok')

    await db.from('subscriptions')
      .update({ tier: 'free', status: 'canceled', updated_at: new Date().toISOString() })
      .eq('user_id', userId)
  }

  else if (event.type === 'invoice.payment_succeeded') {
    const inv = obj as { subscription: string }
    if (inv.subscription) {
      await db.from('subscriptions')
        .update({ status: 'active', updated_at: new Date().toISOString() })
        .eq('stripe_subscription_id', inv.subscription)
    }
  }

  else if (event.type === 'invoice.payment_failed') {
    const inv = obj as { subscription: string }
    if (inv.subscription) {
      await db.from('subscriptions')
        .update({ status: 'past_due', updated_at: new Date().toISOString() })
        .eq('stripe_subscription_id', inv.subscription)
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
```

- [ ] **Step 2: Register webhook in Stripe dashboard**

In Stripe dashboard → Webhooks → Add endpoint:
- URL: `https://<project-ref>.supabase.co/functions/v1/stripe-webhook`
- Events: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`
- Copy the signing secret → set as `STRIPE_WEBHOOK_SECRET` Supabase secret

- [ ] **Step 3: Build and verify**

```bash
npm run build 2>&1 | head -10
```

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/stripe-webhook/index.ts
git commit -m "feat: add stripe-webhook edge function for subscription lifecycle"
```

---

## Task 12: Landing page redesign

**Files:**
- Modify: `src/components/Landing.tsx`

Replace the two-tier pricing section with three-tier (Free / Reader / Scholar), update all copy to remove AI references and the "Pro" label, rewrite the three specified FAQ items, add the student discount note, and add the AI footnote before the FAQ.

- [ ] **Step 1: Find and replace all "Pro" tier references**

```bash
grep -n '"Pro"\|"pro"\|Pro plan\|Pro subscription\|/month.*Pro\|Pro.*month' src/components/Landing.tsx
```

Replace every user-facing "Pro" label. This includes:
- Pricing card label: "Pro" → remove (replaced with Reader/Scholar cards below)
- FAQ copy: "Pro subscription" → see FAQ replacement copy in spec

- [ ] **Step 2: Rewrite the pricing section**

Find the pricing cards section in Landing.tsx. Replace the two-card layout with a three-column grid. The pricing section HTML structure should match the approved design:

**Free card:**
```tsx
<div style={{ border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
  <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--border)' }}>
    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.45, marginBottom: 6, fontFamily: '"DM Sans", system-ui, sans-serif' }}>Loci</div>
    <div style={{ fontSize: 30, fontWeight: 800, marginBottom: 2, fontFamily: '"Playfair Display", Georgia, serif' }}>$0</div>
    <div style={{ fontSize: 13, opacity: 0.55, fontFamily: '"DM Sans", system-ui, sans-serif' }}>Always free</div>
  </div>
  <div style={{ padding: '16px 20px', fontFamily: '"DM Sans", system-ui, sans-serif' }}>
    <ul style={{ margin: 0, padding: '0 0 0 16px', fontSize: 13, lineHeight: 2, opacity: 0.8 }}>
      <li>5 books</li>
      <li>Device voice (unlimited)</li>
      <li>Bookmarks &amp; progress sync</li>
      <li>Annotations &amp; highlights</li>
    </ul>
  </div>
</div>
```

**Reader card** (`border: '2px solid #2563eb'`):
- Header: "Loci Reader", "$7.99/mo or $79/yr — Save 2 months"
- Features: "Unlimited books", "Loci Narration — lifelike voices", "Word-by-word highlighting", "Multiple voice choices", "Scratchpad"
- CTA: "Get started" button (links to sign-up)

**Scholar card** (`border: '2px solid #7c3aed'`, "MOST POPULAR" badge):
- Header: "Loci Scholar", "$13.99/mo or $139/yr — Save 2 months"
- Features: "Everything in Reader", "Narration Pro — audiobook-quality voices", "Practice Quizzes", "Chapter Briefs", "Study Guide", "Flashcards"
- Student note: "Students: $9.99/mo with code STUDENT"
- CTA: "Get started" button

- [ ] **Step 3: Update the hero headline and feature section copy**

Find and replace:
- `"AI-powered reading"` → `"Read more. Remember more. Listen anywhere."`
- `"AI narration"` / `"AI Narration"` → `"Loci Narration"` / `"Turn any book into an audiobook"`
- `"AI-powered study tools"` → `"Study tools that work as hard as you do"`
- `"AI-generated quizzes"` → `"Practice quizzes from your chapters"`
- `"AI chapter summaries"` → `"Chapter briefs so nothing slips through"`
- `"ElevenLabs"` (in section titles/copy) → `"Narration"`
- Any remaining `"Pro"` tier label → `"Reader"` or `"Scholar"` as appropriate

```bash
grep -n 'AI\|ElevenLabs\|"Pro"' src/components/Landing.tsx | grep -v '//'
```

Go through each match and apply the replacements from the spec's marketing copy table.

- [ ] **Step 4: Rewrite the three FAQ items**

Find the FAQ section in Landing.tsx. Locate and replace the three items specified in the spec:

**FAQ 1 — ChatGPT comparison:**
```
Q: How is Loci different from other reading apps?
A: Loci is built around your own book collection — not a catalog you subscribe to. You bring your EPUB files; Loci handles the narration, study tools, and cross-device sync. Your library, your annotations, and your progress are yours.
```

**FAQ 2 — Narration FAQ:**
```
Q: [whatever the narration question is]
A: Loci Narration is included with every Reader and Scholar subscription. Reader includes Loci Narration with natural, lifelike voices. Scholar adds Loci Narration Pro — expressive, audiobook-quality voices.
```

**FAQ 3 — Trial/pricing FAQ:**
```
Q: [whatever the trial/price question is]
A: After your 7-day trial you can choose Reader ($7.99/month or $79/year) or Scholar ($13.99/month or $139/year), or continue using Loci for free with up to 5 books and your device's built-in voice. No charge until you add a payment method.
```

- [ ] **Step 5: Add the AI footnote**

Add this line just before the FAQ section (after the pricing cards):

```tsx
<p style={{ textAlign: 'center', fontSize: 12, opacity: 0.45, fontFamily: '"DM Sans", system-ui, sans-serif', margin: '24px 0 0' }}>
  Loci uses advanced language models to power Practice Quizzes, Chapter Briefs, and Study Guide.
</p>
```

- [ ] **Step 6: Build and verify landing page renders**

```bash
npm run build 2>&1 | head -20
npm run preview
```

Open the app (not signed in) and visually verify:
- Three-tier pricing grid renders correctly
- Monthly/annual toggle works
- No "AI" references in visible copy
- No "Pro" label in visible copy
- No "ElevenLabs" in visible copy
- Student code note visible on Scholar card
- AI footnote visible below pricing, above FAQ
- Three FAQ items show updated copy

- [ ] **Step 7: Commit**

```bash
git add src/components/Landing.tsx
git commit -m "feat: redesign landing page with three-tier pricing and updated copy"
```

---

## Verification Checklist

Run through these manually in the browser with your dev Supabase + Stripe test environment:

- [ ] New user sign-up → 7-day Scholar trial starts, TrialBanner visible with correct day count
- [ ] All Scholar features accessible during trial
- [ ] Set `status = 'active', tier = 'free'` → narration, scratchpad, study tools all blocked; 6th book blocked
- [ ] Set `tier = 'reader'` → narration works, scratchpad works, study tools still blocked
- [ ] Set `tier = 'scholar'` → all features work
- [ ] UpgradeModal opens from any gated feature, shows both tier cards
- [ ] Monthly/annual toggle changes prices in modal
- [ ] STUDENT code note visible on Scholar card in modal
- [ ] Landing page: no "AI", no "ElevenLabs", no "Pro" in any visible text
- [ ] `npm run build` exits 0

---

## Environment Setup Reference

Before deploying edge functions, set these Supabase secrets:

```bash
npx supabase secrets set STRIPE_SECRET_KEY=sk_test_...
npx supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
npx supabase secrets set STRIPE_READER_MONTHLY_PRICE_ID=price_...
npx supabase secrets set STRIPE_READER_ANNUAL_PRICE_ID=price_...
npx supabase secrets set STRIPE_SCHOLAR_MONTHLY_PRICE_ID=price_...
npx supabase secrets set STRIPE_SCHOLAR_ANNUAL_PRICE_ID=price_...
npx supabase secrets set APP_URL=https://your-app.vercel.app
```

Deploy edge functions:
```bash
npx supabase functions deploy create-trial
npx supabase functions deploy create-checkout
npx supabase functions deploy create-portal
npx supabase functions deploy stripe-webhook
```

These secrets are **never** committed to git. Vercel deployment uses the same secrets set via Supabase dashboard.
