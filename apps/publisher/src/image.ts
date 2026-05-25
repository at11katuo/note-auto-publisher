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

// Shared quality suffix appended to every prompt.
// Flux (Pollinations.ai) responds strongly to these terms for sharp, premium output.
const QUALITY =
  'hyper-realistic commercial photography, crisp studio lighting, deep shadows, ' +
  'ray-traced reflections, high-end 3D metallic shading, sharp lines, ' +
  'solid geometric shapes, polished gold textures, ' +
  'modern financial corporate design, premium minimalist aesthetic, ' +
  'vibrant but professional color gradient, 8K ultra-sharp, no text, no letters, no watermark'

function buildPrompt(title: string): string {
  const t = title.toLowerCase()

  if (/eth|ethereum|bitcoin|btc|crypto|defi|blockchain|仮想通貨|暗号/.test(t)) {
    return (
      'a cluster of polished solid gold and chrome cryptocurrency coins floating in mid-air, ' +
      'intricate circuit-board engravings on each coin surface, ' +
      'electric blue blockchain network lines connecting them, ' +
      'deep matte black background with subtle neon-blue ambient glow, ' +
      'dramatic three-point studio lighting casting hard shadows, ' +
      `wide landscape format, ${QUALITY}`
    )
  }
  if (/nisa|オルカン|all.country|index|インデックス|投資信託|emax/.test(t)) {
    return (
      'a sleek polished gold bar and stacked silver coins arranged on a dark slate surface, ' +
      'sharp upward-trending graph rendered in glowing green lines behind them, ' +
      'crisp reflections on the metal surfaces, ' +
      'clean gradient background from deep navy to soft white, ' +
      `wide landscape format, ${QUALITY}`
    )
  }
  if (/fire|早期退職|副業|マイクロ法人|週3|自由/.test(t)) {
    return (
      'a lone figure standing on a dramatic mountain ridge at golden hour, ' +
      'arms raised in triumph, warm orange and magenta sky behind, ' +
      'a sleek silver laptop resting on a rock in the foreground, ' +
      'long hard shadows, cinematic depth of field, photorealistic landscape, ' +
      `wide landscape format, ${QUALITY}`
    )
  }
  if (/frb|fed|金利|米国|市場|株式|dow|nasdaq/.test(t)) {
    return (
      'a towering polished chrome globe with glowing financial chart lines etched across continents, ' +
      'sharp gold candlestick chart bars rising in the foreground, ' +
      'dramatic rim lighting on all metallic surfaces, ' +
      'deep dark blue background with subtle city-light bokeh, ' +
      `wide landscape format, ${QUALITY}`
    )
  }
  if (/ideco|確定拠出|年金|老後|退職金/.test(t)) {
    return (
      'a stack of gleaming gold coins beside a robust metal piggy bank, ' +
      'both objects reflecting studio lights with mirror-like clarity, ' +
      'a single green upward arrow cast from solid metal standing next to them, ' +
      'minimalist dark charcoal background with a focused spotlight, ' +
      `wide landscape format, ${QUALITY}`
    )
  }

  return (
    'a perfectly arranged row of polished gold coins and a chrome bar graph rising sharply, ' +
    'all objects rendered with hyper-realistic metallic reflections on a dark premium surface, ' +
    'focused key light from above casting crisp hard shadows, ' +
    'deep navy to black gradient background, ' +
    `wide landscape format, ${QUALITY}`
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
