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

# Prisma 生成クライアント（index.js + .so.node バイナリ）を standalone へコピー
# @prisma/client は .prisma/client/ ディレクトリ内のファイルを動的 require するため
# nft（Next.js ファイルトレーサー）では追跡されず standalone に含まれない
# → pnpm ストア内の .prisma/client/ を特定してディレクトリごとコピーする
RUN set -e; \
    # 優先: pnpm 仮想ストア内の @prisma+client に隣接する .prisma/client/
    PRISMA_DIR=$(find /app/node_modules/.pnpm -type d -name "client" \
        -path "*/.prisma/client" 2>/dev/null | head -1); \
    # フォールバック: packages/db/node_modules/.prisma/client/
    if [ -z "$PRISMA_DIR" ]; then \
      PRISMA_DIR=$(find /app/packages/db/node_modules -type d -name "client" \
          -path "*/.prisma/client" 2>/dev/null | head -1); \
    fi; \
    if [ -n "$PRISMA_DIR" ]; then \
      REL_DIR=$(echo "$PRISMA_DIR" | sed 's|^/app/||'); \
      DEST_DIR="/app/apps/dashboard/.next/standalone/$REL_DIR"; \
      mkdir -p "$DEST_DIR"; \
      cp -r "$PRISMA_DIR/." "$DEST_DIR/"; \
      echo "Copied .prisma/client => $DEST_DIR"; \
    else \
      echo "WARNING: .prisma/client directory not found" >&2; \
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
