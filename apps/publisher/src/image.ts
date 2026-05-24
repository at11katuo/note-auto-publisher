import { writeFile, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createLogger } from '@note/logger'

const log = createLogger('publisher:image')

const MODEL = 'gemini-2.0-flash-exp'

function buildPrompt(title: string): string {
  const t = title.toLowerCase()

  if (/eth|ethereum|bitcoin|btc|crypto|defi|blockchain|仮想通貨|暗号/.test(t)) {
    return (
      'A sleek modern digital artwork showing interconnected glowing blue and gold nodes ' +
      'forming a blockchain network on a deep dark background. Abstract geometric shapes, ' +
      'futuristic technology aesthetic, high contrast, vibrant colors, no text, ' +
      'professional financial illustration, wide landscape format.'
    )
  }
  if (/nisa|オルカン|all.country|index|インデックス|投資信託|emax/.test(t)) {
    return (
      'A minimalist illustration of a steadily rising investment chart with warm golden tones, ' +
      'green upward arrows, and abstract growing plants symbolizing long-term wealth. ' +
      'Clean white background, professional financial concept art, no text, ' +
      'optimistic and trustworthy mood, wide landscape format.'
    )
  }
  if (/fire|早期退職|副業|マイクロ法人|週3|自由/.test(t)) {
    return (
      'A serene lifestyle illustration of a silhouetted person sitting on a mountain peak ' +
      'at sunrise with a laptop, representing financial independence and early retirement. ' +
      'Soft pastel gradient sky, minimal style, peaceful and free atmosphere, ' +
      'no text, inspirational concept art, wide landscape format.'
    )
  }
  if (/frb|fed|金利|米国|市場|株式|dow|nasdaq/.test(t)) {
    return (
      'A sophisticated global financial market visualization with holographic chart lines, ' +
      'world map overlay with glowing connection points, and flowing data streams ' +
      'in blue and emerald green on a dark navy background. ' +
      'Professional fintech aesthetic, no text, wide landscape format.'
    )
  }
  if (/ideco|確定拠出|年金|老後|退職金/.test(t)) {
    return (
      'A warm illustration of golden coins growing into a flourishing tree with leaves ' +
      'shaped like yen symbols, representing retirement savings and compound growth. ' +
      'Soft blue sky background, optimistic and secure mood, clean design, ' +
      'no text, professional financial illustration, wide landscape format.'
    )
  }

  return (
    'A professional financial concept illustration showing golden coins stacked beside ' +
    'an upward trending graph, abstract wealth and growth symbols, ' +
    'blue and gold gradient background. Modern minimalist design, ' +
    'no text, suitable for an investment blog article thumbnail, wide landscape format.'
  )
}

type InlineDataPart = {
  inlineData: { mimeType: string; data: string }
}

function isInlineDataPart(part: unknown): part is InlineDataPart {
  return (
    typeof part === 'object' &&
    part !== null &&
    'inlineData' in part &&
    typeof (part as InlineDataPart).inlineData?.mimeType === 'string' &&
    typeof (part as InlineDataPart).inlineData?.data === 'string'
  )
}

export async function generateEyecatch(title: string): Promise<string | null> {
  const apiKey = process.env['GEMINI_API_KEY']
  if (!apiKey) {
    log.info('GEMINI_API_KEY not set — skipping image generation')
    return null
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: MODEL })

    const prompt = buildPrompt(title)
    log.info({ model: MODEL, titleSnippet: title.slice(0, 40) }, 'generating eyecatch image')

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      // responseModalities is not yet typed in @google/generative-ai v0.21 but supported at runtime
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      generationConfig: { responseModalities: ['IMAGE', 'TEXT'] } as any,
    })

    const parts: unknown[] = result.response.candidates?.[0]?.content?.parts ?? []

    for (const part of parts) {
      if (isInlineDataPart(part) && part.inlineData.mimeType.startsWith('image/')) {
        const ext = part.inlineData.mimeType === 'image/png' ? 'png' : 'jpg'
        const imagePath = join(tmpdir(), `eyecatch-${Date.now()}.${ext}`)
        await writeFile(imagePath, Buffer.from(part.inlineData.data, 'base64'))
        log.info({ imagePath }, 'eyecatch image written to temp file')
        return imagePath
      }
    }

    log.warn('Gemini returned no image part in response')
    return null
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
