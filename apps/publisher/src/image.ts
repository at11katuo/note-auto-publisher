import { writeFile, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Anthropic from '@anthropic-ai/sdk'
import { createLogger } from '@note/logger'

const log = createLogger('publisher:image')

const POLLINATIONS_BASE = 'https://image.pollinations.ai/prompt'
const IMAGE_WIDTH = 1200
const IMAGE_HEIGHT = 630
const IMAGE_TIMEOUT_MS = 90_000
const POLLINATIONS_MODEL = 'flux-realism'

// claude-haiku: fast and cheap for short prompt generation tasks
const LLM_MODEL = 'claude-haiku-4-5-20251001'

// Quality suffix appended by the LLM instructions — defines the photographic
// style that flux-realism responds to best.
const QUALITY_SUFFIX =
  'Hyper-realistic commercial photography, cinematic lighting, ' +
  'shot on Sony A7R V 85mm f/1.4 lens, shallow depth of field, natural bokeh, ' +
  'professional color grading, 8K ultra-sharp resolution, ' +
  'no text, no letters, no numbers, no watermark'

// Fallback used when the LLM call fails for any reason.
const FALLBACK_PROMPT =
  'professional product photograph of gleaming gold coins and a rising bar chart ' +
  'arranged on a dark premium slate surface, soft key studio lighting, ' +
  'clean upscale corporate aesthetic, wide landscape composition, ' + QUALITY_SUFFIX

const SYSTEM_PROMPT = `You are an expert image generation prompt engineer for a Japanese personal finance blog.

Given a Japanese article title, output ONLY a single English image generation prompt string.
Output nothing else — no explanations, no JSON, no markdown, no commentary — just the raw prompt text.

Strict rules:
1. Interpret the DEEP THEME behind the title, not just its surface words.
   Transform abstract financial concepts into powerful visual metaphors and concrete photographic scenes.
2. Describe the scene as a professional photographer directing a real photoshoot.
   The result must look like an actual photograph, NOT a 3D render or digital illustration.
3. The image must work as a compelling blog thumbnail that makes people want to click.
4. Output must be in English only. No Japanese characters whatsoever.
5. Never describe text, signs, charts on screens, or readable letters within the scene.
6. You MUST end your output with exactly this quality suffix:
   "${QUALITY_SUFFIX}"

Visual metaphor palette for inspiration:
- Saving / accumulation → glass jar overflowing with gold coins, seedling growing from coins
- Investment growth    → stacked gold bars beside a lush green plant, sunrise over farmland
- Financial freedom    → lone figure on a cliff edge with a laptop, open door revealing vast ocean
- Market volatility    → storm clouds over a glass skyscraper, a tightrope over a lit cityscape
- Tax / efficiency     → a precise mechanical gear system made of gold, a magnifying glass over coins
- Crypto / blockchain  → physical gold coins with circuit engravings, electric-blue network in darkness
- Retirement / future  → an elderly couple walking on a sunlit beach, a lighthouse at sunset`

async function generateDynamicPrompt(title: string): Promise<string> {
  const apiKey = process.env['ANTHROPIC_API_KEY']
  if (!apiKey) {
    log.warn('ANTHROPIC_API_KEY not set — using fallback prompt')
    return FALLBACK_PROMPT
  }

  try {
    const client = new Anthropic({ apiKey })

    const response = await client.messages.create({
      model: LLM_MODEL,
      max_tokens: 450,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Article title: "${title}"` }],
    })

    const block = response.content[0]
    if (block?.type !== 'text' || !block.text.trim()) {
      throw new Error('LLM returned empty or non-text response')
    }

    const prompt = block.text.trim()
    log.info(
      { titleSnippet: title.slice(0, 40), promptLength: prompt.length },
      'dynamic image prompt generated',
    )
    return prompt
  } catch (e) {
    log.warn({ err: e }, 'dynamic prompt generation failed — using fallback prompt')
    return FALLBACK_PROMPT
  }
}

export async function generateEyecatch(
  title: string,
  prebuiltPrompt?: string | null,
): Promise<string | null> {
  try {
    const prompt = prebuiltPrompt?.trim()
      ? prebuiltPrompt.trim()
      : await generateDynamicPrompt(title)
    const seed = Date.now() % 100_000
    const url =
      `${POLLINATIONS_BASE}/${encodeURIComponent(prompt)}` +
      `?width=${IMAGE_WIDTH}&height=${IMAGE_HEIGHT}` +
      `&nologo=true&model=${POLLINATIONS_MODEL}&enhance=true&seed=${seed}`

    log.info(
      {
        model: POLLINATIONS_MODEL,
        titleSnippet: title.slice(0, 40),
        source: prebuiltPrompt ? 'db-stored' : 'llm-generated',
      },
      'generating eyecatch via Pollinations.ai',
    )

    const response = await fetch(url, { signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS) })

    if (!response.ok) {
      log.warn({ status: response.status }, 'Pollinations returned non-OK — skipping eyecatch')
      return null
    }

    const contentType = response.headers.get('content-type') ?? ''
    const ext = contentType.includes('png') ? 'png' : 'jpg'
    const imagePath = join(tmpdir(), `eyecatch-${Date.now()}.${ext}`)
    const buffer = Buffer.from(await response.arrayBuffer())
    await writeFile(imagePath, buffer)

    log.info({ imagePath, bytes: buffer.length }, 'eyecatch image saved')
    return imagePath
  } catch (e) {
    log.warn({ err: e }, 'image generation failed — continuing without eyecatch')
    return null
  }
}

export async function cleanupEyecatch(imagePath: string | null): Promise<void> {
  if (!imagePath) return
  try {
    await unlink(imagePath)
  } catch {
    // temp file already gone — ignore
  }
}
