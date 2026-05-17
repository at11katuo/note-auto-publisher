import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@note/db', '@note/logger', '@note/shared'],
  experimental: {
    // monorepo ルートからファイルトレースするために必要
    outputFileTracingRoot: path.join(__dirname, '../../'),
    // Prisma ネイティブバイナリは自動トレースで漏れることがあるため明示的に含める
    outputFileTracingIncludes: {
      '/**': ['../../node_modules/.prisma/client/**'],
    },
  },
}

export default nextConfig
