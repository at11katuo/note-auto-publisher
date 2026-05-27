import OpenAI from 'openai'
import { z } from 'zod'
import { ok, err, type Result } from '@note/shared'
import type { Idea } from '@note/db'
import {
  DIRECTOR_SYSTEM_PROMPT,
  buildDirectorUserPrompt,
  type DirectorOutput,
} from '@note/prompts'
import { createLogger } from '@note/logger'

const log = createLogger('generator:director')

export const HERMES_MODEL = 'nousresearch/hermes-3-llama-3.1-70b'

const MAX_AGENT_ITERATIONS = 8
const MAX_JSON_RETRIES = 3

const directorOutputSchema = z.object({
  outline: z.object({
    sections: z
      .array(
        z.object({
          heading: z.string().min(1),
          points: z.array(z.string().min(1)).min(1),
        }),
      )
      .min(2)
      .max(6),
  }),
  image_prompt: z.string().min(50),
  key_facts: z.array(z.string()).optional().default([]),
})

function getOpenRouterClient(apiKey: string): OpenAI {
  return new OpenAI({
    apiKey,
    baseURL: 'https://openrouter.ai/api/v1',
    defaultHeaders: {
      'HTTP-Referer': 'https://github.com/note-auto-publisher',
      'X-Title': 'Note Auto Publisher',
    },
  })
}

async function executeTavilySearch(
  query: string,
  tavilyApiKey: string | undefined,
): Promise<string> {
  if (!tavilyApiKey) {
    log.warn({ query }, 'TAVILY_API_KEY not set — returning empty results')
    return JSON.stringify({ results: [] })
  }

  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: tavilyApiKey,
        query,
        search_depth: 'basic',
        max_results: 5,
        include_answer: false,
      }),
      signal: AbortSignal.timeout(20_000),
    })

    if (!res.ok) {
      return JSON.stringify({ error: `HTTP ${res.status}`, results: [] })
    }

    const data = (await res.json()) as {
      results?: Array<{ title?: string; content?: string; url?: string }>
    }
    const simplified = (data.results ?? []).map((r) => ({
      title: r.title ?? '',
      content: (r.content ?? '').slice(0, 500),
      url: r.url ?? '',
    }))

    log.info({ query, count: simplified.length }, 'Tavily search done')
    return JSON.stringify({ results: simplified })
  } catch (e) {
    log.warn({ query, err: e }, 'Tavily search failed')
    return JSON.stringify({ error: String(e), results: [] })
  }
}

const TAVILY_TOOL: OpenAI.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'tavily_search',
    description:
      'Search the web for the latest Japanese financial news, market data, and relevant information for the article topic.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query in Japanese targeting the article topic',
        },
      },
      required: ['query'],
    },
  },
}

function extractJsonFromText(text: string): string {
  // Try markdown code fence first
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenceMatch?.[1]) return fenceMatch[1].trim()

  // Try to extract a raw JSON object (find outermost braces)
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start !== -1 && end > start) return text.slice(start, end + 1)

  return text.trim()
}

export async function runDirector(
  idea: Idea,
  openrouterApiKey: string,
  tavilyApiKey?: string,
): Promise<Result<DirectorOutput, Error>> {
  const client = getOpenRouterClient(openrouterApiKey)

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: 'system', content: DIRECTOR_SYSTEM_PROMPT },
    { role: 'user', content: buildDirectorUserPrompt(idea) },
  ]

  log.info({ ideaTitle: idea.title.slice(0, 50) }, 'Hermes Director starting')

  // ── Phase 1: Agentic tool-calling loop ──────────────────────────────────
  let finalContent: string | null = null

  try {
    for (let iter = 0; iter < MAX_AGENT_ITERATIONS; iter++) {
      const response = await client.chat.completions.create({
        model: HERMES_MODEL,
        messages,
        tools: [TAVILY_TOOL],
        tool_choice: 'auto',
        temperature: 0.3,
        max_tokens: 2500,
      })

      const msg = response.choices[0]?.message
      if (!msg) return err(new Error('Hermes returned empty choice'))

      // Append assistant turn to history
      messages.push(msg as OpenAI.ChatCompletionMessageParam)

      if (!msg.tool_calls || msg.tool_calls.length === 0) {
        // No tool calls → final answer
        finalContent = msg.content ?? ''
        log.info({ iter, length: finalContent.length }, 'Hermes Director finished thinking')
        break
      }

      // Execute each tool call
      for (const call of msg.tool_calls) {
        if (call.function.name !== 'tavily_search') {
          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: JSON.stringify({ error: `Unknown tool: ${call.function.name}` }),
          })
          continue
        }

        let args: { query: string }
        try {
          args = JSON.parse(call.function.arguments) as { query: string }
        } catch {
          args = { query: idea.title }
        }

        log.info({ query: args.query, iter }, 'Director calling Tavily')
        const result = await executeTavilySearch(args.query, tavilyApiKey)
        messages.push({ role: 'tool', tool_call_id: call.id, content: result })
      }
    }
  } catch (e) {
    return err(e instanceof Error ? e : new Error(String(e)))
  }

  if (!finalContent) {
    return err(new Error('Director exhausted iterations without producing final output'))
  }

  // ── Phase 2: JSON extraction with self-correction ────────────────────────
  let currentContent = finalContent

  for (let attempt = 0; attempt < MAX_JSON_RETRIES; attempt++) {
    try {
      const json = extractJsonFromText(currentContent)
      const parsed = directorOutputSchema.parse(JSON.parse(json))
      log.info(
        { sections: parsed.outline.sections.length, facts: parsed.key_facts?.length ?? 0 },
        'Director output validated',
      )
      return ok(parsed)
    } catch (parseErr) {
      if (attempt === MAX_JSON_RETRIES - 1) {
        return err(
          new Error(
            `Director JSON parse failed after ${MAX_JSON_RETRIES} attempts: ${String(parseErr)}\nRaw: ${currentContent.slice(0, 300)}`,
          ),
        )
      }

      log.warn({ attempt, err: String(parseErr) }, 'Director JSON invalid — requesting correction')

      messages.push({
        role: 'user',
        content: `Your output could not be parsed. Error: ${String(parseErr)}\n\nOutput ONLY the raw JSON object. Start with { and end with }. No markdown, no explanation.`,
      })

      try {
        const fix = await client.chat.completions.create({
          model: HERMES_MODEL,
          messages,
          temperature: 0.1,
          max_tokens: 2500,
        })
        const fixMsg = fix.choices[0]?.message
        currentContent = fixMsg?.content ?? ''
        if (fixMsg) messages.push(fixMsg as OpenAI.ChatCompletionMessageParam)
      } catch (e) {
        return err(e instanceof Error ? e : new Error(String(e)))
      }
    }
  }

  return err(new Error('Director failed to produce valid JSON'))
}
