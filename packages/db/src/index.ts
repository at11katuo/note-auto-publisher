import { PrismaClient } from '@prisma/client'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

// Prisma は SQLite の相対パスを schema.prisma の場所を基準に解決する。
// packages/db/src/index.ts → packages/db/src → packages/db → packages/db/prisma
function resolveDbUrl(): string {
  const raw = process.env['DATABASE_URL']
  if (!raw) {
    const prismaDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'prisma')
    return `file:${resolve(prismaDir, 'dev.db')}`
  }
  if (!raw.startsWith('file:')) return raw

  const rel = raw.slice('file:'.length)
  // 絶対パスはそのまま返す (Windows 形式も考慮)
  if (rel.startsWith('/') || rel.startsWith('\\') || /^[A-Za-z]:[\\/]/.test(rel)) return raw

  // 相対パスは packages/db/prisma/ を基準に絶対パスへ変換
  const prismaDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'prisma')
  return `file:${resolve(prismaDir, rel)}`
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: resolveDbUrl() } },
    log:
      process.env['NODE_ENV'] === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  })

if (process.env['NODE_ENV'] !== 'production') {
  globalForPrisma.prisma = prisma
}

export * from '@prisma/client'
