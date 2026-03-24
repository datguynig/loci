import type { SupabaseClient } from '@supabase/supabase-js'
import { type Preferences, loadPreferences, savePreferences } from '../hooks/usePreferences'

export async function syncPreferencesFromSupabase(supabase: SupabaseClient): Promise<void> {
  const { data, error } = await supabase.from('preferences').select('*').single()
  if (error || !data) return
  const local = loadPreferences()
  const merged: Preferences = {
    theme: data.theme ?? local.theme,
    colorScheme: local.colorScheme,
    fontSize: data.font_size ?? local.fontSize,
    layoutMode: data.layout_mode ?? local.layoutMode,
    highlightEnabled: data.highlight_enabled ?? local.highlightEnabled,
    autoscrollEnabled: data.autoscroll_enabled ?? local.autoscrollEnabled,
  }
  savePreferences(merged)
}

export async function pushPreferencesToSupabase(
  supabase: SupabaseClient,
  userId: string,
  prefs: Preferences,
): Promise<void> {
  await supabase.from('preferences').upsert(
    {
      user_id: userId,
      theme: prefs.theme,
      font_size: prefs.fontSize,
      layout_mode: prefs.layoutMode,
      highlight_enabled: prefs.highlightEnabled,
      autoscroll_enabled: prefs.autoscrollEnabled,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )
}
