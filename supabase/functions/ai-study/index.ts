import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Parse request
    const { action, messages, context } = await req.json()

    // Build system prompt
    const systemPrompt = `You are a study assistant helping a student understand and revise their reading material.
You have access to the current chapter text, the student's notes, their scratchpad, their saved highlights, and their flashcards.

Be concise, clear, and pedagogically sound. When the user asks for flashcards, output them as a JSON array on a single line: [{"front":"...","back":"..."},...].
When quizzing, ask one question at a time and wait for the answer before revealing the correct response.
Never fabricate information not present in the provided text.`

    // Build context string to append to first user message (or as a separate system context)
    const contextParts: string[] = []
    if (context.chapterText) {
      contextParts.push(`CHAPTER TEXT:\n${context.chapterText.slice(0, 40000)}`)
    }
    if (context.chapterNotes?.length) {
      contextParts.push(`CHAPTER NOTES:\n${context.chapterNotes.join('\n')}`)
    }
    if (context.scratchpad) {
      contextParts.push(`SCRATCHPAD:\n${context.scratchpad}`)
    }
    if (context.annotations?.length) {
      contextParts.push(`HIGHLIGHTS & NOTES:\n${context.annotations.map((a: any) => `"${a.quote}" — ${a.note}`).join('\n')}`)
    }
    if (context.flashcards?.length) {
      contextParts.push(`SAVED FLASHCARDS:\n${context.flashcards.map((f: any) => `Q: ${f.front} / A: ${f.back}`).join('\n')}`)
    }
    if (context.selectedText) {
      contextParts.push(`SELECTED TEXT:\n${context.selectedText}`)
    }
    const contextBlock = contextParts.join('\n\n')

    const provider = Deno.env.get('AI_PROVIDER') ?? 'anthropic'

    // Build the augmented messages — prepend context to the first user message
    const augmentedMessages = messages.map((m: any, i: number) => {
      if (i === 0 && m.role === 'user' && contextBlock) {
        return { ...m, content: `${contextBlock}\n\n---\n\n${m.content}` }
      }
      return m
    })

    if (provider === 'google') {
      // Google Gemini
      return await handleGoogle(systemPrompt, augmentedMessages)
    } else {
      // Anthropic Claude (default)
      return await handleAnthropic(systemPrompt, augmentedMessages)
    }

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

async function handleAnthropic(systemPrompt: string, messages: any[]) {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set')

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system: systemPrompt,
      messages,
      stream: true,
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Anthropic error: ${err}`)
  }

  // Transform Anthropic SSE to simple SSE chunks
  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
          break
        }
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6)
          if (data === '[DONE]') continue
          try {
            const parsed = JSON.parse(data)
            // Anthropic streaming: delta type is content_block_delta with delta.text
            const text = parsed?.delta?.text ?? ''
            if (text) {
              controller.enqueue(encoder.encode(`data: ${text}\n\n`))
            }
          } catch { /* skip malformed lines */ }
        }
      }
    },
  })

  return new Response(stream, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
    },
  })
}

async function handleGoogle(systemPrompt: string, messages: any[]) {
  const apiKey = Deno.env.get('GOOGLE_AI_API_KEY')
  if (!apiKey) throw new Error('GOOGLE_AI_API_KEY not set')

  // Convert messages to Gemini format
  const geminiContents = messages.map((m: any) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?key=${apiKey}&alt=sse`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: geminiContents,
        generationConfig: { maxOutputTokens: 2048 },
      }),
    }
  )

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Google AI error: ${err}`)
  }

  // Transform Gemini SSE to simple SSE chunks
  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
          break
        }
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6)
          if (data === '[DONE]') continue
          try {
            const parsed = JSON.parse(data)
            // Gemini streaming: candidates[0].content.parts[0].text
            const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
            if (text) {
              controller.enqueue(encoder.encode(`data: ${text}\n\n`))
            }
          } catch { /* skip malformed lines */ }
        }
      }
    },
  })

  return new Response(stream, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
    },
  })
}
