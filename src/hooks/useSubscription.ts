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
  isLoading: boolean
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
  // past_due: user retains access during payment grace period (Stripe retry window)
  if (tier === 'scholar') return (f) => SCHOLAR_FEATURES.includes(f)
  if (tier === 'reader') return (f) => READER_FEATURES.includes(f)
  return () => false
}

const LOADING_STATE: SubscriptionState = {
  tier: 'free',
  status: 'loading',
  trialEndsAt: null,
  isTrialing: false,
  isLoading: true,
  canAccess: () => false,
}

async function fetchRow(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('tier, status, trial_ends_at')
    .eq('user_id', userId)
    .maybeSingle()
  return { data, error }
}

export function useSubscription(
  supabase: SupabaseClient | null,
  userId: string | null | undefined,
  /** Clerk JWT for Supabase (same as `createSupabaseClient` — template `supabase`). Required here because `persistSession: false` means `supabase.auth.getSession()` is always empty. */
  getSupabaseAccessToken?: () => Promise<string | null>,
): SubscriptionState {
  const [state, setState] = useState<SubscriptionState>(LOADING_STATE)

  const load = useCallback(async () => {
    if (!supabase || !userId) {
      setState(LOADING_STATE)
      return
    }

    function applyRow(data: { tier: unknown; status: unknown; trial_ends_at: unknown }) {
      const tier = (data.tier ?? 'free') as SubscriptionTier
      const status = (data.status ?? 'active') as SubscriptionStatus
      const trialEndsAt = data.trial_ends_at ? new Date(data.trial_ends_at as string) : null
      const isTrialing = status === 'trialing'
      setState({
        tier,
        status,
        trialEndsAt,
        isTrialing,
        isLoading: false,
        canAccess: buildCanAccess(tier, status),
      })
    }

    const { data, error } = await fetchRow(supabase, userId)

    if (error) {
      console.error('[useSubscription] load error:', error)
      setState({ tier: 'free', status: 'active', trialEndsAt: null, isTrialing: false, isLoading: false, canAccess: buildCanAccess('free', 'active') })
      return
    }

    if (!data) {
      // First sign-in — create the Scholar trial (Edge Function validates JWT via Supabase auth.getUser)
      try {
        const token = getSupabaseAccessToken
          ? await getSupabaseAccessToken()
          : (await supabase.auth.getSession()).data.session?.access_token ?? null
        if (!token) throw new Error('No access token available')
        const trialRes = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-trial`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
          },
        )
        if (!trialRes.ok) throw new Error(`create-trial failed: ${trialRes.status}`)
        // Fetch the row directly — no recursive load()
        const { data: newData, error: newError } = await fetchRow(supabase, userId)
        if (newError || !newData) throw new Error('Row not found after trial creation')
        applyRow(newData)
      } catch (e) {
        console.error('[useSubscription] create-trial error:', e)
        setState({ tier: 'free', status: 'active', trialEndsAt: null, isTrialing: false, isLoading: false, canAccess: buildCanAccess('free', 'active') })
      }
      return
    }

    applyRow(data)
  }, [supabase, userId, getSupabaseAccessToken])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!supabase || !userId) return

    const channel = supabase
      .channel(`subscription-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'subscriptions',
          filter: `user_id=eq.${userId}`,
        },
        async () => {
          // Row changed — re-fetch to get the latest state
          const { data, error } = await fetchRow(supabase, userId)
          if (!error && data) {
            const tier = (data.tier ?? 'free') as SubscriptionTier
            const status = (data.status ?? 'active') as SubscriptionStatus
            const trialEndsAt = data.trial_ends_at ? new Date(data.trial_ends_at as string) : null
            setState({
              tier,
              status,
              trialEndsAt,
              isTrialing: status === 'trialing',
              isLoading: false,
              canAccess: buildCanAccess(tier, status),
            })
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, userId])

  return state
}
