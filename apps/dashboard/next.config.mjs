import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@note/db', '@note/logger', '@note/prompts', '@note/shared'],
  webpack: (config) => {
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.js'],
    }
    return config
  },
  experimental: {
    // monorepo ルートからファイルトレースするために必要
    outputFileTracingRoot: path.join(__dirname, '../../'),
    // Prisma ネイティブバイナリは動的 require のため nft で自動トレースされない
    // pnpm 仮想ストアのパスを含むよう広めのグロブで指定
    outputFileTracingIncludes: {
      '/**': [
        '../../node_modules/.pnpm/**/.prisma/client/**',
        '../../node_modules/.prisma/client/**',
        '../../packages/db/node_modules/.prisma/client/**',
      ],
    },
  },
}

export default nextConfig
