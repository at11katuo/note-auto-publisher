# ── Stage 1: deps ───────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9 --activate

# workspace 設定とすべての package.json を先にコピー（レイヤーキャッシュ最適化）
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/db/package.json       packages/db/
COPY packages/logger/package.json   packages/logger/
COPY packages/prompts/package.json  packages/prompts/
COPY packages/shared/package.json   packages/shared/
COPY apps/dashboard/package.json    apps/dashboard/

RUN pnpm install --frozen-lockfile

# ── Stage 2: builder ─────────────────────────────────────────
FROM deps AS builder
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

# ソースコピー
COPY packages/ packages/
COPY apps/dashboard/ apps/dashboard/

# Alpine Linuxに必要な部品を追加
RUN apk add --no-cache libc6-compat openssl

# Prisma ツールと部品をインストール
RUN pnpm install prisma @prisma/client -w

# 確実にデータベースの準備をしてから、Next.jsをビルドする
RUN pnpm exec prisma generate --schema=packages/db/prisma/schema.prisma
RUN pnpm --filter @note/dashboard build

# ── Stage 3: runner ──────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

# standalone 出力（monorepo 全体のトレース済みファイルを含む）
COPY --from=builder --chown=nextjs:nodejs \
  /app/apps/dashboard/.next/standalone ./

# 静的アセット
COPY --from=builder --chown=nextjs:nodejs \
  /app/apps/dashboard/.next/static \
  ./apps/dashboard/.next/static

# public ディレクトリ
COPY --from=builder --chown=nextjs:nodejs \
  /app/apps/dashboard/public \
  ./apps/dashboard/public

USER nextjs
EXPOSE 3000

# standalone ルートの server.js が monorepo 構造を保持している
CMD ["node", "apps/dashboard/server.js"]
