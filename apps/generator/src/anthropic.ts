import Anthropic from '@anthropic-ai/sdk'

export const MODEL = 'claude-sonnet-4-5'
export const MAX_TOKENS = 8000
export const TEMPERATURE = 0.7

let _client: Anthropic | undefined

export function getAnthropicClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env['ANTHROPIC_API_KEY']
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is required')
    _client = new Anthropic({ apiKey })
  }
  return _client
}

export async function callWithRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      if (attempt < maxAttempts - 1) {
        await new Promise(resolve =>
          setTimeout(resolve, Math.pow(2, attempt) * 1000),
        )
      }
    }
  }
  throw lastError
}
