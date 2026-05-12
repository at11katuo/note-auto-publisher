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
  },
}

export default nextConfig
