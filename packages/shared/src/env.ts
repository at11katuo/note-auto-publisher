import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().min(1),
  NOTE_EMAIL: z.string().email(),
  NOTE_PASSWORD: z.string().min(1),
  DASHBOARD_BASIC_USER: z.string().min(1),
  DASHBOARD_BASIC_PASS: z.string().min(1),
  DISCORD_WEBHOOK_URL: z.string().url().optional().or(z.literal('')),
  X_BEARER_TOKEN: z.string().optional(),
  TAVILY_API_KEY: z.string().optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z
    .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal'])
    .default('info'),
})

export type Env = z.infer<typeof envSchema>

export function parseEnv(): Env {
  const result = envSchema.safeParse(process.env)
  if (!result.success) {
    throw new Error(`Invalid environment variables:\n${result.error.message}`)
  }
  return result.data
}
