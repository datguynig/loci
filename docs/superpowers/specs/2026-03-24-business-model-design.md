# Loci: Business Model, Pricing & Feature Gating

**Date:** 2026-03-24
**Status:** Approved

---

## Context

Loci is a production-ready EPUB reader with cloud library (MinIO), Clerk authentication, Supabase database, and a full suite of reading and study tools. The landing page currently references a two-tier model ("Free" and "Pro" at $9/month) with Stripe mentioned in the Terms of Service, but no payment processing or feature gating is implemented — all features are accessible to all signed-in users.

This document defines the new monetisation model, tier structure, pricing, feature allocation, product naming conventions, and the infrastructure required to implement it.

### Migration from existing "Pro" tier

The current landing page has a two-tier model: Free and Pro ($9/month). The existing "Pro" tier is **replaced entirely** by two new tiers: Reader ($7.99/month) and Scholar ($13.99/month). The "Pro" label is removed from all UI copy. The existing pricing card in `Landing.tsx` is redesigned as a three-column table showing Free, Reader, and Scholar. No existing users are affected during development (feature gating is not live yet).

---

## Business Model: Freemium + Three Tiers

A genuine free tier covers core reading. Two paid tiers target distinct audiences: casual listeners (Reader) and active learners (Scholar).

### All new sign-ups receive a 7-day Scholar trial — no credit card required at sign-up. See Trial section for the conversion flow.

---

## Tier Structure

| Feature | Free | Reader | Scholar |
|---------|------|--------|---------|
| **Monthly price** | $0 | $7.99 | $13.99 |
| **Annual price** | — | $79/yr | $139/yr |
| **Annual saving** | — | ~2 months free | ~2 months free |
| **Book library** | Up to 5 books | Unlimited | Unlimited |
| **Annotations & highlights** | ✅ Unlimited | ✅ Unlimited | ✅ Unlimited |
| **Bookmarks** | ✅ | ✅ | ✅ |
| **Reading progress sync** | ✅ | ✅ | ✅ |
| **Full-text search** | ✅ | ✅ | ✅ |
| **Themes & font settings** | ✅ | ✅ | ✅ |
| **Scratchpad** | ❌ | ✅ | ✅ |
| **Device voice** | ✅ Unlimited | ✅ Unlimited | ✅ Unlimited |
| **Loci Narration** | ❌ | ✅ Unlimited | ✅ Unlimited |
| **Loci Narration Pro** | ❌ | ❌ | ✅ Unlimited |
| **Practice Quizzes** | ❌ | ❌ | ✅ |
| **Chapter Briefs** | ❌ | ❌ | ✅ |
| **Study Guide** | ❌ | ❌ | ✅ |
| **Flashcards** | ❌ | ❌ | ✅ |

### Upgrade moments
- **Free → Reader:** User tries to add a 6th book, or taps the narration button and sees an upgrade gate.
- **Reader → Scholar:** User tries to open a Practice Quiz, Chapter Brief, Study Guide, or Flashcards.

### Upgrade prompt UX
Gated features are **shown but disabled** with a lock icon and a brief inline message ("Available on Scholar — upgrade to unlock"). Tapping the message opens an upgrade modal with the Reader/Scholar pricing cards and a CTA. Features are never hidden entirely — users should always know what they are missing. If a user is mid-narration session when their trial expires, the current sentence completes and the next sentence shows the upgrade gate.

### Billing interval selector
The pricing page and the upgrade modal both show a monthly/annual toggle. Selecting annual shows the yearly price with the "Save 2 months" badge. The toggle defaults to monthly. The selected interval is passed into the Stripe checkout session.

---

## Trial Flow

1. **Sign-up** — New user creates an account. Stripe trial period begins immediately (7 days, Scholar tier). No credit card collected at sign-up.
2. **During trial** — All Scholar features are accessible. A persistent but unobtrusive banner shows "X days left in your trial" with upgrade CTAs.
3. **Trial expiry prompt** — 3 days before expiry and again 1 day before, the user receives an in-app notification prompting them to add payment details.
4. **At expiry** — If no payment method has been added, the subscription lapses to Free automatically. The user sees an upgrade modal on their next session.
5. **Converting from trial** — User adds a card at any point during or after the trial and selects Reader or Scholar. Stripe starts the paid subscription immediately; the previous trial period is not charged.

---

## Narration Product Naming

Provider names (Azure, OpenAI, ElevenLabs) and technical terms (TTS, neural, HD) are **never** exposed to users. Features are named by what they deliver.

| Tier | User-facing name | Description shown to users | Under the hood |
|------|-----------------|---------------------------|----------------|
| Free | **Device voice** | Your device's built-in voice | Browser Web Speech API |
| Reader | **Loci Narration** | Natural, lifelike voices | Azure Neural TTS (~$4/M chars) |
| Scholar | **Loci Narration Pro** | Expressive, audiobook-quality voices | Azure HD / OpenAI TTS (~$16–24/M chars) |

Both Loci Narration tiers include:
- Word-by-word highlighting during playback
- Multiple voice choices
- Speed control
- Auto-scroll

The existing landing page section currently titled "ElevenLabs" (section comment line 815) is renamed to "Narration" and its copy updated to reflect Loci Narration branding. The voice demo on the landing page continues to play audio samples but the voice names shown are Loci's own (e.g. "Natural", "Expressive") — no provider-specific voice names appear.

---

## Study Tool Naming

Consumer research shows explicit "AI" branding reduces product adoption. All features are named by the user outcome, not the underlying technology.

| Current (internal/codebase) name | User-facing name |
|----------------------------------|-----------------|
| AI Quiz / AI-generated quiz | **Practice Quiz** |
| AI Summary / AI Chapter Summary | **Chapter Brief** |
| AI Study Assistant / AI Chat | **Study Guide** |
| AI Flashcards | **Flashcards** *(unchanged — already neutral)* |

### Marketing copy principles

Avoid "AI" in all user-facing surfaces. Name outcomes, not mechanisms.

| ❌ Before | ✅ After |
|-----------|----------|
| "AI-powered reading" | "Read more. Remember more. Listen anywhere." |
| "AI narration for your books" | "Turn any book into an audiobook" |
| "AI-powered study tools" | "Study tools that work as hard as you do" |
| "AI-generated quizzes" | "Practice quizzes from your chapters" |
| "AI chapter summaries" | "Chapter briefs so nothing slips through" |

### Landing page FAQ items to update

The following FAQ entries in `Landing.tsx` must be rewritten with the replacement copy below.

**"How is Loci different from just copying text into ChatGPT?"**
Replace question and answer with:
> **Q: How is Loci different from other reading apps?**
> Loci is built around your own book collection — not a catalog you subscribe to. You bring your EPUB files; Loci handles the narration, study tools, and cross-device sync. Your library, your annotations, and your progress are yours.

**Narration FAQ (currently: "Narration is included with every Pro subscription.")**
Replace with:
> Loci Narration is included with every Reader and Scholar subscription. Reader includes Loci Narration with natural, lifelike voices. Scholar adds Loci Narration Pro — expressive, audiobook-quality voices.

**Trial FAQ (currently: "your subscription starts at $9/month")**
Replace with:
> After your 7-day trial you can choose Reader ($7.99/month or $79/year) or Scholar ($13.99/month or $139/year), or continue using Loci for free with up to 5 books and your device's built-in voice. No charge until you add a payment method.

A discreet footnote — *"Loci uses advanced language models to power Practice Quizzes, Chapter Briefs, and Study Guide"* — is placed at the bottom of the pricing section in `Landing.tsx`, before the FAQ. This satisfies tech-savvy users without leading with AI in headlines.

The primary ICP is **university and college students**. The Scholar pitch should speak directly to student pain: *"Turn your assigned reading into an audiobook, a summary, and a study guide — automatically."* The Scholar pricing card includes a line: *"Students: $9.99/mo with code STUDENT"*.

---

## Unit Economics

### Narration

| | Loci Narration | Loci Narration Pro |
|---|---|---|
| Provider | Azure Neural TTS | Azure HD / OpenAI TTS |
| API cost | ~$4/M chars | ~$16–24/M chars |
| Cost per full book (~550k chars) | ~$2.20 | ~$8.80–13.20 |
| Subscriber revenue | $7.99/mo | $13.99/mo |
| Blended gross margin* | ~80% | ~60–65% |

*At 30–50% utilisation (industry standard for SaaS premium features).

**Breakeven utilisation:** A Reader subscriber breaks even (zero TTS margin) if they listen to ~3.6 full books/month (7.99 / 2.20). A Scholar subscriber breaks even at ~1.06 full books/month at the high end ($13.20/book). This means heavy Scholar listeners (2+ books/month) generate negative TTS margin. Mitigation: blended across the subscriber base, inactive users subsidise active ones. If Scholar utilisation consistently exceeds 1 book/user/month, a soft fair-use cap (e.g. fallback to Loci Narration at 2M chars/month) can be introduced without breaking the core promise.

### Study tools (AI calls)
~$0.01–0.03 per call (Claude/Gemini via Supabase edge function). Negligible at early scale.

### Student discount

Scholar is offered at **$9.99/month or $79/year** for students — a 29% discount on the monthly price, applied via a Stripe coupon code (`STUDENT`). No verification infrastructure required at launch; students self-identify with the promo code. A `.edu` email domain check via Clerk can be added later for enforcement.

The student price is deliberately set at $9.99 rather than $7.99 (Reader price) to:
1. Stay under the $10 psychological threshold students respond to
2. Avoid confusion with Reader — Scholar Student is clearly the better offer at a higher price
3. Maintain better unit economics (~45–50% gross margin vs. ~25–30% at $7.99 for typical student usage)

Students primarily use study tools (Quiz, Summary, Study Guide, Flashcards) rather than marathon narration, so their TTS API costs run lower than general audiobook listeners — the economics hold at $9.99.

### Competitive positioning
- **Reader at $7.99/mo** — matches Audible Plus ($7.99/mo for catalog streaming). Loci works on *any EPUB you own*, not just Audible's catalog.
- **Scholar at $13.99/mo** — below Audible Premium Plus ($14.95/mo). Adds study tools unavailable on Audible.
- **Scholar Student at $9.99/mo** — below Spotify Student ($5.99 + Spotify's costs), Apple Music Student ($5.99). Directly targets university ICP.
- **Annual plans** framed as "Save 2 months" — psychologically compelling, improves cash flow.

---

## Technical Architecture

### Narration provider migration

The current `ttsService.ts` calls ElevenLabs directly and consumes a batch JSON response containing `audio_base64` and an `alignment` object (character-level start/end times). Azure TTS returns audio via a streaming SDK with real-time `WordBoundary` callback events — this is structurally incompatible with the current batch pattern.

**Chosen approach: server-side event collection via a new TTS proxy edge function.**

The proxy (`supabase/functions/tts-proxy/`) accepts `{ text, tier }`, calls the appropriate provider, collects all `WordBoundary` events server-side, and returns a response in the **same shape** `ttsService.ts` currently expects from ElevenLabs:

```json
{
  "audio_base64": "...",
  "alignment": {
    "characters": ["H","e","l","l","o"," ","w",...],
    "character_start_times_seconds": [0.0, 0.05, ...],
    "character_end_times_seconds": [0.04, 0.09, ...]
  }
}
```

The proxy converts Azure's word-level `WordBoundary` events (which include `AudioOffset`, `WordLength`, and `Text`) to character-level arrays matching this shape. This means `ttsService.ts`, `buildWordTimings`, and all of `useSpeech.ts` remain **unchanged**. Only the proxy URL changes.

Provider routing in the proxy:
- `tier === 'reader'` → Azure Neural TTS (standard voices)
- `tier === 'scholar'` → Azure HD / OpenAI TTS voices
- Default (no tier or free) → returns 403; caller falls back to browser TTS

### `useSubscription` hook interface

```typescript
interface SubscriptionState {
  tier: 'free' | 'reader' | 'scholar'       // effective current tier
  status: 'trialing' | 'active' | 'canceled' | 'past_due' | 'loading'
  trialEndsAt: Date | null
  isTrialing: boolean
  canAccess: (feature: SubscriptionFeature) => boolean
}

type SubscriptionFeature =
  | 'loci-narration'        // Reader+
  | 'loci-narration-pro'    // Scholar only
  | 'unlimited-books'       // Reader+
  | 'scratchpad'            // Reader+
  | 'practice-quizzes'      // Scholar only
  | 'chapter-briefs'        // Scholar only
  | 'study-guide'           // Scholar only
  | 'flashcards'            // Scholar only
```

`canAccess` is the single gating function used in all components. During the Scholar trial, it returns `true` for all Scholar features.

---

## Payment Infrastructure

- **Stripe** — monthly and annual billing, trial periods, subscription webhooks
- **No credit card required** at sign-up for 7-day Scholar trial
- Subscription status synced to Supabase via Stripe webhooks → `subscriptions` table
- `useSubscription` hook reads `subscriptions` table on session load and provides `canAccess(feature)` to gated components

### `subscriptions` table

```sql
create table public.subscriptions (
  user_id                 text primary key,
  tier                    text not null default 'free',  -- 'free' | 'reader' | 'scholar'
  status                  text not null default 'trialing', -- 'trialing' | 'active' | 'canceled' | 'past_due'
  trial_ends_at           timestamptz,
  current_period_end      timestamptz,
  stripe_customer_id      text unique,
  stripe_subscription_id  text unique,
  updated_at              timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

-- Users can read only their own subscription
create policy "Users can read own subscription"
  on public.subscriptions for select
  using (user_id = auth.jwt() ->> 'sub');

-- Only the service role (webhook handler) can insert/update
create policy "Service role can manage subscriptions"
  on public.subscriptions for all
  using (auth.role() = 'service_role');
```

New users have a row inserted by the Stripe webhook handler when the trial starts.

### Stripe webhook handler

**Location:** Supabase edge function at `supabase/functions/stripe-webhook/`.

**Stripe events to handle:**

| Event | Action |
|-------|--------|
| `customer.subscription.created` | Insert or upsert row in `subscriptions` with `status = 'trialing'` and `tier = 'scholar'` |
| `customer.subscription.updated` | Update `tier`, `status`, `current_period_end` from the subscription object |
| `customer.subscription.deleted` | Set `tier = 'free'`, `status = 'canceled'` |
| `invoice.payment_failed` | Set `status = 'past_due'`; app shows a payment failure banner |
| `invoice.payment_succeeded` | Set `status = 'active'` |

**Idempotency:** All handlers upsert on `stripe_subscription_id` and check `updated_at` before writing — if the incoming event's `created` timestamp is older than the stored `updated_at`, the update is skipped (handles out-of-order Stripe delivery).

**Verification:** Stripe webhook signature verified using `STRIPE_WEBHOOK_SECRET` env var before processing any event.

---

## Files to Create or Modify

| File | Type | Change |
|------|------|--------|
| `src/components/Landing.tsx` | Modify | Replace 2-tier pricing with 3-tier (Free/Reader/Scholar), update all copy (remove AI refs, remove "Pro" label), update FAQ items, add annual/monthly billing toggle, add AI footnote before FAQ |
| `src/components/AudioBar.tsx` | Modify | Gate Loci Narration behind `canAccess('loci-narration')`; gate Loci Narration Pro behind `canAccess('loci-narration-pro')` |
| `src/components/StudyPanel.tsx` | Modify | Gate Practice Quizzes, Chapter Briefs, Study Guide, Flashcards behind `canAccess(feature)` |
| `src/components/Library.tsx` | Modify | Enforce 5-book limit on Free; show upgrade gate on 6th book attempt |
| `src/components/Scratchpad.tsx` | Modify | Gate behind `canAccess('scratchpad')` (Reader+) |
| `src/hooks/useSubscription.ts` | Create | Load subscription from Supabase, expose `tier`, `status`, `canAccess`, `trialEndsAt`, `isTrialing` |
| `src/services/subscriptionService.ts` | Create | Stripe checkout session creation (`createCheckoutSession`), customer portal redirect (`openCustomerPortal`), tier helpers |
| `src/services/ttsService.ts` | Modify | Replace ElevenLabs direct call with new TTS proxy endpoint; remove `getElevenLabsApiKey` / `getElevenLabsProxyUrl` dependency |
| `supabase/migrations/NNNN_subscriptions.sql` | Create | `subscriptions` table DDL + RLS policies (see above) |
| `supabase/functions/tts-proxy/index.ts` | Create | Azure Neural (Reader) + Azure HD/OpenAI (Scholar) TTS proxy; returns `{ audio_base64, alignment }` |
| `supabase/functions/stripe-webhook/index.ts` | Create | Stripe webhook handler for subscription lifecycle events |

---

## Verification

1. **New user sign-up** → 7-day Scholar trial starts, all Scholar features accessible, "X days left" banner visible
2. **3 days before expiry** → In-app prompt to add payment details appears
3. **Trial expires without card** → Subscription lapses to Free; upgrade modal shown on next session
4. **Trial expires with card + Reader selected** → Paid Reader subscription starts, Loci Narration Pro gates activate, study tools gated
5. **Upgrade to Reader mid-trial** → Loci Narration works, book limit removed, scratchpad enabled; study tools remain gated
6. **Upgrade to Scholar** → Loci Narration Pro + all study tools unlocked
7. **Annual billing** → $79 (Reader) or $139 (Scholar) charged; `current_period_end` set 12 months out
8. **Downgrade / cancel** → Feature gating activates at `current_period_end`
9. **Payment failure** → `past_due` status set; app shows payment failure banner, features remain accessible for a grace period
10. **No "AI" language** in any UI string — audit all visible text in components (not code comments)
11. **No provider names** — "Azure", "OpenAI", "ElevenLabs", "TTS", "neural" appear nowhere in user-facing text
12. **"Pro" label** — removed from all UI copy; only "Reader" and "Scholar" used
