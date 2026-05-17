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

# 1. Alpine Linuxに必要な部品を追加
RUN apk add --no-cache libc6-compat openssl

# 2. Prismaと部品をインストール
RUN pnpm install prisma @prisma/client -w

# 3. データベースのフォルダに移動して準備を行い、その後ビルドする
RUN cd packages/db && pnpm exec prisma generate
RUN pnpm --filter @note/dashboard build

# Prisma ネイティブバイナリ（.node）を standalone の正しいパスへコピー
# nft は動的 require を解析できないためバイナリが自動トレースされないことがある
RUN set -e; \
    BINARY=$(find /app/node_modules -name "libquery_engine-linux-musl*.node" -print -quit 2>/dev/null); \
    if [ -n "$BINARY" ]; then \
      REL_DIR=$(dirname "$BINARY" | sed 's|^/app/||'); \
      DEST_DIR="/app/apps/dashboard/.next/standalone/$REL_DIR"; \
      mkdir -p "$DEST_DIR"; \
      cp "$BINARY" "$DEST_DIR/"; \
      echo "Prisma binary => $DEST_DIR/$(basename $BINARY)"; \
    else \
      echo "WARNING: libquery_engine-linux-musl*.node not found" >&2; \
    fi

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
