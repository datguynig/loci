# Loci: Business Model, Pricing & Feature Gating

**Date:** 2026-03-24
**Status:** Approved

---

## Context

Loci is a production-ready EPUB reader with cloud library (MinIO), Clerk authentication, Supabase database, and a full suite of reading and study tools. The landing page currently references a subscription model and Stripe in the Terms of Service, but no payment processing or feature gating is implemented — all features are accessible to all signed-in users.

This document defines the monetisation model, tier structure, pricing, feature allocation, product naming conventions, and the infrastructure required to implement it.

---

## Business Model: Freemium + Three Tiers

A genuine free tier covers core reading. Two paid tiers target distinct audiences: casual listeners (Reader) and active learners (Scholar).

### All new sign-ups receive a 7-day Scholar trial — no credit card required. After the trial, users choose a plan or continue on Free.

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
- **Free → Reader:** User wants to add a 6th book, or taps the Loci Narration option and sees an upgrade prompt.
- **Reader → Scholar:** User finishes a chapter and wants a Chapter Brief, or tries to open a Practice Quiz.

---

## Narration Product Naming

Provider names (Azure, OpenAI, ElevenLabs) and technical terms (TTS, neural, HD) are never exposed to users. Features are named by what they deliver.

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

---

## Study Tool Naming

Consumer research shows explicit "AI" branding reduces product adoption. All features are named by the user outcome, not the underlying technology.

| Current (internal) name | User-facing name |
|------------------------|-----------------|
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

A discreet footnote — *"Loci uses advanced language models to power Practice Quizzes, Chapter Briefs, and Study Guide"* — satisfies tech-savvy users on the pricing page without leading with AI in headlines or feature names.

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

### Study tools (AI calls)
~$0.01–0.03 per call (Claude/Gemini via Supabase edge function). Negligible at early scale.

### Competitive positioning
- **Reader at $7.99/mo** — matches Audible Plus ($7.99/mo). Loci works on *any EPUB you own*, not just Audible's catalog.
- **Scholar at $13.99/mo** — below Audible Premium Plus ($14.95/mo). Adds study tools unavailable on Audible.
- **Annual plans** framed as "Save 2 months" — psychologically compelling, improves cash flow.

---

## Technical Architecture for Narration

The current `ttsService.ts` calls ElevenLabs directly. This needs to be replaced with a provider-agnostic proxy pattern:

1. **New Supabase/Vercel edge function** (`/tts-proxy`) — accepts `{ text, tier }`, calls appropriate provider (Azure Neural for Reader, Azure HD/OpenAI for Scholar), returns `{ audio_base64, wordTimings[] }` in the same shape `ttsService.ts` currently expects from ElevenLabs.
2. **`ttsService.ts`** — update to call the new proxy endpoint instead of ElevenLabs directly. The `buildWordTimings` function may need adaptation for Azure's `WordBoundary` event format.
3. **Provider abstracted completely** — `useSpeech.ts` and all UI components remain unchanged.

---

## Payment Infrastructure

- **Stripe** — monthly and annual billing, trial periods, subscription webhooks
- **No credit card required** for 7-day Scholar trial (Stripe supports trial-without-card)
- Subscription status synced to Supabase via Stripe webhook → `subscriptions` table
- Feature gating reads `subscription_tier` from Supabase on session load

### `subscriptions` table (new)
```sql
create table subscriptions (
  user_id      text primary key,
  tier         text not null default 'free', -- 'free' | 'reader' | 'scholar'
  status       text not null,               -- 'trialing' | 'active' | 'canceled' | 'past_due'
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  stripe_customer_id text,
  stripe_subscription_id text,
  updated_at   timestamptz default now()
);
```

---

## Files to Create or Modify

| File | Type | Change |
|------|------|--------|
| `src/components/Landing.tsx` | Modify | Update pricing section (3 tiers), all copy (remove AI references), feature names |
| `src/components/AudioBar.tsx` | Modify | Gate Loci Narration behind Reader+ tier check |
| `src/components/StudyPanel.tsx` | Modify | Gate Practice Quizzes, Chapter Briefs, Study Guide, Flashcards behind Scholar |
| `src/components/Library.tsx` | Modify | Enforce 5-book limit on Free tier with upgrade prompt |
| `src/hooks/useSubscription.ts` | Create | Hook to load and expose current user's subscription tier |
| `src/services/subscriptionService.ts` | Create | Stripe checkout session creation, portal redirect, tier helpers |
| `src/services/ttsService.ts` | Modify | Replace ElevenLabs direct calls with new proxy endpoint |
| `supabase/migrations/NNNN_subscriptions.sql` | Create | `subscriptions` table with RLS |
| `supabase/functions/tts-proxy/` | Create | Edge function: Azure Neural + Azure HD TTS proxy |
| Stripe webhook handler | Create | Vercel API route or Supabase edge fn to handle `customer.subscription.*` events |

---

## Verification

1. **New user sign-up** → 7-day Scholar trial starts automatically, all Scholar features accessible
2. **Trial expires** → drops to Free (5-book limit, device voice only, no study tools), upgrade prompt shown
3. **Upgrade to Reader** → Loci Narration unlocked, book limit removed, scratchpad enabled
4. **Upgrade to Scholar** → Loci Narration Pro + all study tools unlocked
5. **Annual billing** → correct price applied ($79 or $139), renews at 12-month interval
6. **Downgrade / cancel** → feature gating applied at `current_period_end`
7. **No "AI" language** in any UI string — audit all component text content
8. **Provider names hidden** — "Azure", "OpenAI", "ElevenLabs", "TTS", "neural" appear nowhere in user-facing surfaces
