import pino, { type Logger } from 'pino'

export type { Logger }

export function createLogger(name: string): Logger {
  const level = process.env['LOG_LEVEL'] ?? 'info'
  const isDev = (process.env['NODE_ENV'] ?? 'development') !== 'production'

  return pino({
    name,
    level,
    ...(isDev && {
      transport: {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'SYS:standard' },
      },
    }),
  })
}
