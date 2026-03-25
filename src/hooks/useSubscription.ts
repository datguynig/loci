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
      .select('tier, status, trial_ends_at')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) {
      console.error('[useSubscription] load error:', error)
      setState({ tier: 'free', status: 'active', trialEndsAt: null, isTrialing: false, canAccess: buildCanAccess('free', 'active') })
      return
    }

    if (!data) {
      // First ever sign-in — start the Scholar trial
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        const token = sessionData?.session?.access_token
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
        // Re-load after trial creation
        await load()
      } catch (e) {
        console.error('[useSubscription] create-trial error:', e)
        // Fall back to free so app is usable
        setState({ tier: 'free', status: 'active', trialEndsAt: null, isTrialing: false, canAccess: buildCanAccess('free', 'active') })
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
