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
    // Parse request — tolerate missing fields (some clients / proxies send partial bodies)
    let raw: unknown
    try {
      raw = await req.json()
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid or empty JSON body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!raw || typeof raw !== 'object') {
      return new Response(JSON.stringify({ error: 'Request body must be a JSON object' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = raw as Record<string, unknown>
    const action = typeof body.action === 'string' ? body.action : 'chat'
    const messages = Array.isArray(body.messages) ? body.messages : []
    const context =
      body.context !== null && body.context !== undefined && typeof body.context === 'object'
        ? (body.context as Record<string, unknown>)
        : {}

    const quizLength: number = typeof context.quizLength === 'number' ? context.quizLength : 5
    const retryQuestions: string[] | undefined =
      Array.isArray(context.retryQuestions) && context.retryQuestions.length > 0
        ? (context.retryQuestions as string[])
        : undefined

    // Build system prompt — tailored to the provider's strengths
    const baseInstructions = `You are an expert study assistant helping a student deeply understand their reading material.
You have access to the current chapter text, the student's notes, their scratchpad, their saved highlights, and their flashcards.

PEDAGOGICAL APPROACH:
- For summaries: Start with a 1-2 sentence overview, then give 3-5 key points as bullet points. Be specific — name characters, events, and ideas from the text.
- For explanations: Use analogies when concepts are abstract. Match depth to complexity.
- For quizzes: Vary question types — test recall, comprehension, and inference. Prefer specific, targeted questions over vague ones. Draw directly from the provided text.
- After correct quiz answers: Reinforce why the answer is right with one concrete detail from the text.
- After wrong answers: Explain clearly and connect it to something the student has already encountered in the text.
- Keep responses concise and to the point. Avoid filler phrases.

FLASHCARD OUTPUT RULE: When the user asks for flashcards, you MUST output ONLY a raw JSON array with no surrounding text, no markdown, no code fences — just the array itself on a single line:
[{"front":"...","back":"..."},{"front":"...","back":"..."}]
Do not write \`\`\`json or any other wrapper. The array must be the entire response.

Never fabricate information not present in the provided text.`

    const providerHint = Deno.env.get('AI_PROVIDER') === 'google'
      ? '\n\nYou have strong reasoning capabilities — use them to give thorough, well-structured answers. Think through the question before responding, especially for quizzes and explanations.'
      : ''

    const systemPrompt = baseInstructions + providerHint

    // Action-specific instruction injected at the tail of the first user message
    const retryNote = retryQuestions
      ? `The student got these questions wrong and wants to retry them — quiz ONLY on these exact topics:\n${retryQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}\n`
      : ''

    const actionInstruction =
      action === 'quiz'
        ? `\n\n[QUIZ INSTRUCTIONS: You are running a ${quizLength}-question quiz. ${retryNote}

⚠️ CRITICAL RULE: After every student answer, you MUST give feedback AND the next question in the SAME response. You can NEVER stop after feedback alone. A response that contains only feedback is WRONG.

EXACT FORMAT TO FOLLOW:

Your very first response (before any student input):
Question 1/${quizLength}: [your question here]

After the student answers questions 1 through ${quizLength - 1}:
✓ Correct. [one sentence of reinforcement]

Question {n+1}/${quizLength}: [next question here]

— OR if wrong —
✗ Incorrect. The answer is: [correct answer]. [one sentence explanation]

Question {n+1}/${quizLength}: [next question here]

After the student answers question ${quizLength} (the final one):
✓ Correct. [one sentence of reinforcement]

Quiz complete. You scored {X}/${quizLength}. [one sentence of encouragement]

— OR if wrong —
✗ Incorrect. The answer is: [correct answer]. [one sentence explanation]

Quiz complete. You scored {X}/${quizLength}. [one sentence of encouragement]

WORKED EXAMPLE (3-question quiz):
→ You output: Question 1/3: What color is the sky?
→ Student: Blue
→ You output: ✓ Correct. The sky appears blue due to Rayleigh scattering.\n\nQuestion 2/3: What is H₂O?
→ Student: Water
→ You output: ✓ Correct. H₂O is the chemical formula for water.\n\nQuestion 3/3: How many planets orbit our sun?
→ Student: 8
→ You output: ✓ Correct. There are 8 planets following Pluto's reclassification in 2006.\n\nQuiz complete. You scored 3/3. Perfect score — excellent work!

Begin immediately with Question 1/${quizLength}:]`
        : action === 'flashcards'
          ? '\n\n[INSTRUCTION: Output ONLY a raw JSON array on a single line. No preamble, no prose, no markdown, no code fences — start with [ and end with ].]'
          : ''

    // Build context string to append to first user message (or as a separate system context)
    const contextParts: string[] = []
    const chapterText = typeof context.chapterText === 'string' ? context.chapterText : ''
    if (chapterText) {
      contextParts.push(`CHAPTER TEXT:\n${chapterText.slice(0, 40000)}`)
    }
    const chapterNotes = Array.isArray(context.chapterNotes) ? context.chapterNotes.filter((x): x is string => typeof x === 'string') : []
    if (chapterNotes.length) {
      contextParts.push(`CHAPTER NOTES:\n${chapterNotes.join('\n')}`)
    }
    const scratchpad = typeof context.scratchpad === 'string' ? context.scratchpad : ''
    if (scratchpad) {
      contextParts.push(`SCRATCHPAD:\n${scratchpad}`)
    }
    const annotations = Array.isArray(context.annotations) ? context.annotations : []
    if (annotations.length) {
      contextParts.push(
        `HIGHLIGHTS & NOTES:\n${
          annotations
            .map((a: { quote?: string; note?: string }) => `"${a.quote ?? ''}" — ${a.note ?? ''}`)
            .join('\n')
        }`,
      )
    }
    const flashcards = Array.isArray(context.flashcards) ? context.flashcards : []
    if (flashcards.length) {
      contextParts.push(
        `SAVED FLASHCARDS:\n${
          flashcards
            .map((f: { front?: string; back?: string }) => `Q: ${f.front ?? ''} / A: ${f.back ?? ''}`)
            .join('\n')
        }`,
      )
    }
    const selectedText = typeof context.selectedText === 'string' ? context.selectedText : ''
    if (selectedText) {
      contextParts.push(`SELECTED TEXT:\n${selectedText}`)
    }
    const contextBlock = contextParts.join('\n\n')

    const provider = Deno.env.get('AI_PROVIDER') ?? 'anthropic'
    console.log(`[ai-study] provider=${provider}`)

    if (!messages.length) {
      return new Response(JSON.stringify({ error: 'messages must be a non-empty array' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Normalize message shape for Anthropic / Gemini (avoid undefined content)
    const augmentedMessages = messages.map((m: { role?: string; content?: unknown }, i: number) => {
      const role = m?.role === 'assistant' ? 'assistant' : 'user'
      const base = typeof m?.content === 'string' ? m.content : String(m?.content ?? '')
      if (i === 0 && role === 'user' && contextBlock) {
        return { role: 'user', content: `${contextBlock}\n\n---\n\n${base}${actionInstruction}` }
      }
      return { role, content: base }
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
      model: 'claude-sonnet-4-6',
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
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:streamGenerateContent?key=${apiKey}&alt=sse`,
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
