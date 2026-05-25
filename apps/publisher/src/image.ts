import { writeFile, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createLogger } from '@note/logger'

const log = createLogger('publisher:image')

const POLLINATIONS_BASE = 'https://image.pollinations.ai/prompt'
const IMAGE_WIDTH = 1200
const IMAGE_HEIGHT = 630
const TIMEOUT_MS = 90_000 // flux-realism takes longer than flux

// flux-realism: Pollinations' dedicated photorealism model — produces output
// indistinguishable from real photography when given photographic prompts.
// enhance=true: Pollinations' built-in LLM prompt enhancer runs before generation.
const MODEL = 'flux-realism'
const ENHANCE = 'true'

// Photographic quality suffix — framing output as a real editorial photograph,
// not digital art, is the single most effective way to avoid the "AI look".
const PHOTO_QUALITY =
  'award-winning editorial photography, ' +
  'shot on Sony A7R V mirrorless camera, 85mm f/1.4 lens, ' +
  'perfect exposure, razor-sharp focus on subject, ' +
  'shallow depth of field with smooth natural bokeh, ' +
  'professional color grading, high dynamic range, ' +
  'no text, no letters, no numbers, no watermark, no logo'

function buildPrompt(title: string): string {
  const t = title.toLowerCase()

  // ── Crypto / Blockchain ──────────────────────────────────────────────────
  if (/eth|ethereum|bitcoin|btc|crypto|defi|blockchain|仮想通貨|暗号/.test(t)) {
    return (
      'macro product photograph of several gleaming gold physical Bitcoin coins ' +
      'resting on a sleek dark brushed-metal surface, ' +
      'fine condensation droplets catching a single directional spotlight, ' +
      'rich specular highlights on the embossed coin edges, ' +
      'cool blue-tinted background bokeh evoking a data-center ambience, ' +
      'dramatic chiaroscuro lighting with deep precise shadows, ' +
      `wide landscape composition, ${PHOTO_QUALITY}`
    )
  }

  // ── NISA / Index investing ───────────────────────────────────────────────
  if (/nisa|オルカン|all.country|index|インデックス|投資信託|emax/.test(t)) {
    return (
      'overhead flat-lay photograph on a minimalist pale-oak desk: ' +
      'a slim open notebook with a hand-drawn rising-arrow sketch, ' +
      'a luxury matte-black ballpoint pen, two neat stacks of gold coins, ' +
      'and one small bright-green succulent plant, ' +
      'soft diffused natural window light from the upper left, ' +
      'clean warm-white surface with gentle long shadows, ' +
      `wide landscape composition, ${PHOTO_QUALITY}`
    )
  }

  // ── FIRE / Early retirement ──────────────────────────────────────────────
  if (/fire|早期退職|副業|マイクロ法人|週3|自由/.test(t)) {
    return (
      'cinematic wide-angle photograph of a relaxed man in his early 30s ' +
      'sitting on a rocky cliff edge at golden hour, ' +
      'using a silver MacBook Pro, overlooking a vast valley filled with low morning cloud, ' +
      'warm amber and rose-pink sky, long directional shadows across the rocky foreground, ' +
      'Fujifilm Velvia film-emulation color grade, aspirational lifestyle feel, ' +
      `wide landscape composition, ${PHOTO_QUALITY}`
    )
  }

  // ── FRB / US markets / interest rates ────────────────────────────────────
  if (/frb|fed|金利|米国|市場|株式|dow|nasdaq/.test(t)) {
    return (
      'dramatic low-angle night photograph looking up at the glass facade ' +
      'of a towering modern skyscraper in a major financial district, ' +
      'vivid blue and amber city lights reflected across the curved glass panels, ' +
      'bright bokeh circles from street lamps below, ' +
      'deep inky shadows at street level, ' +
      'high-contrast urban-night aesthetic with a powerful sense of scale, ' +
      `wide landscape composition, ${PHOTO_QUALITY}`
    )
  }

  // ── iDeCo / Pension / Retirement savings ─────────────────────────────────
  if (/ideco|確定拠出|年金|老後|退職金/.test(t)) {
    return (
      'close-up macro photograph of a clear glass jar half-filled with gold coins, ' +
      'a single bright-green plant sprout growing upward from between the coins, ' +
      'resting on a dark matte slate surface, ' +
      'single soft overhead key light creating a warm pool of light on the jar, ' +
      'foreground and background gently blurred, ' +
      'calm optimistic atmosphere suggesting patient long-term growth, ' +
      `wide landscape composition, ${PHOTO_QUALITY}`
    )
  }

  // ── Default / General investment ─────────────────────────────────────────
  return (
    'professional product photograph of a neat row of polished gold coins ' +
    'and a small gleaming silver trophy cup on a premium dark-leather surface, ' +
    'three-point studio lighting creating smooth tonal gradients on each coin, ' +
    'subtle warm reflections in the leather, ' +
    'shallow depth of field, clean upscale corporate aesthetic, ' +
    `wide landscape composition, ${PHOTO_QUALITY}`
  )
}

export async function generateEyecatch(title: string): Promise<string | null> {
  try {
    const prompt = buildPrompt(title)
    const seed = Date.now() % 100_000
    const url =
      `${POLLINATIONS_BASE}/${encodeURIComponent(prompt)}` +
      `?width=${IMAGE_WIDTH}&height=${IMAGE_HEIGHT}` +
      `&nologo=true&model=${MODEL}&enhance=${ENHANCE}&seed=${seed}`

    log.info({ model: MODEL, titleSnippet: title.slice(0, 40) }, 'generating eyecatch via Pollinations.ai')

    const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })

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
