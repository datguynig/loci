export interface StudyContext {
  chapterText: string
  chapterNotes: string[]
  scratchpad: string
  annotations: { quote: string; note: string }[]
  flashcards: { front: string; back: string }[]
  selectedText: string | null
}

export interface Message {
  role: 'user' | 'assistant'
  content: string
}

/**
 * Streams a study assistant response from the ai-study edge function.
 *
 * Accepts a `getToken` callback rather than a Supabase session because this
 * app uses Clerk for auth — `supabase.auth.getSession()` always returns null.
 * Falls back to the anon key so the function can be reached even if the Clerk
 * JWT template is not yet configured.
 */
export async function* sendStudyMessage(
  getToken: () => Promise<string | null>,
  action: string,
  messages: Message[],
  context: StudyContext,
): AsyncGenerator<string> {
  const clerkToken = await getToken().catch(() => null)
  const authToken = clerkToken ?? (import.meta.env.VITE_SUPABASE_ANON_KEY as string)

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL as string}/functions/v1/ai-study`,
    {
      method: 'POST',
      headers: {
        // apikey is always the anon key — Supabase gateway requires it
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action, messages, context }),
    },
  )

  if (!response.ok) {
    const msg = await response.text().catch(() => response.statusText)
    throw new Error(msg || response.statusText)
  }

  const reader = response.body!.getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const chunk = decoder.decode(value, { stream: true })
    const lines = chunk.split('\n')
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const payload = line.slice('data: '.length)
        if (payload === '[DONE]') continue
        yield payload
      }
    }
  }
}
