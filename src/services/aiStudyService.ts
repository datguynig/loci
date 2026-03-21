import type { SupabaseClient } from '@supabase/supabase-js'

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

export async function* sendStudyMessage(
  supabase: SupabaseClient,
  action: string,
  messages: Message[],
  context: StudyContext,
): AsyncGenerator<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-study`,
    {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + session?.access_token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action, messages, context }),
    },
  )

  if (!response.ok) {
    throw new Error(response.statusText)
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
