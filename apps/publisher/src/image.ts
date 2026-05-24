import { writeFile, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createLogger } from '@note/logger'

const log = createLogger('publisher:image')

// Pollinations.ai — free, no API key, uses Flux model (open-source SDXL variant)
const POLLINATIONS_BASE = 'https://image.pollinations.ai/prompt'
const IMAGE_WIDTH = 1200
const IMAGE_HEIGHT = 630
const TIMEOUT_MS = 60_000

function buildPrompt(title: string): string {
  const t = title.toLowerCase()

  if (/eth|ethereum|bitcoin|btc|crypto|defi|blockchain|仮想通貨|暗号/.test(t)) {
    return (
      'interconnected glowing blue and gold nodes forming a blockchain network, ' +
      'deep dark background, abstract geometric shapes, futuristic fintech aesthetic, ' +
      'high contrast, vibrant colors, no text, no letters, professional financial illustration'
    )
  }
  if (/nisa|オルカン|all.country|index|インデックス|投資信託|emax/.test(t)) {
    return (
      'steadily rising investment chart, warm golden tones, green upward arrow, ' +
      'abstract growing plant symbolizing long-term wealth, clean white background, ' +
      'professional financial concept art, no text, no letters, optimistic mood'
    )
  }
  if (/fire|早期退職|副業|マイクロ法人|週3|自由/.test(t)) {
    return (
      'silhouetted person relaxing on a mountain peak at sunrise, laptop open, ' +
      'representing financial freedom and early retirement, soft pastel gradient sky, ' +
      'minimal style, peaceful atmosphere, no text, no letters, inspirational'
    )
  }
  if (/frb|fed|金利|米国|市場|株式|dow|nasdaq/.test(t)) {
    return (
      'global financial market visualization, holographic chart lines, world map overlay, ' +
      'glowing data streams in blue and emerald green, dark navy background, ' +
      'professional fintech aesthetic, no text, no letters'
    )
  }
  if (/ideco|確定拠出|年金|老後|退職金/.test(t)) {
    return (
      'golden coins growing into a flourishing tree, retirement savings concept, ' +
      'compound growth illustration, soft blue sky background, optimistic secure mood, ' +
      'clean minimal design, no text, no letters, professional financial illustration'
    )
  }

  return (
    'golden coins beside upward trending graph, abstract wealth and growth symbols, ' +
    'blue and gold gradient background, modern minimalist financial design, ' +
    'no text, no letters, investment blog thumbnail'
  )
}

export async function generateEyecatch(title: string): Promise<string | null> {
  try {
    const prompt = buildPrompt(title)
    const seed = Date.now() % 100_000
    const url =
      `${POLLINATIONS_BASE}/${encodeURIComponent(prompt)}` +
      `?width=${IMAGE_WIDTH}&height=${IMAGE_HEIGHT}&nologo=true&model=flux&seed=${seed}`

    log.info({ titleSnippet: title.slice(0, 40) }, 'generating eyecatch via Pollinations.ai')

    const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })

    if (!response.ok) {
      log.warn({ status: response.status, url }, 'Pollinations returned non-OK — skipping eyecatch')
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
