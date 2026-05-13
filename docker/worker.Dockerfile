# collector / generator / publisher 共通ワーカーイメージ
# Playwright (Chromium) と tsx を含む
#
# 起動コマンドは docker-compose で上書きする:
#   collector:  pnpm --filter @note/collector start
#   generator:  pnpm --filter @note/generator  start
#   publisher:  pnpm --filter @note/publisher  start

FROM node:20-bookworm-slim
WORKDIR /app

ENV NODE_ENV=production
ENV PLAYWRIGHT_HEADLESS=true
ENV PLAYWRIGHT_BROWSERS_PATH=/root/.cache/ms-playwright

RUN corepack enable && corepack prepare pnpm@9 --activate

# ── deps (変更頻度が低い → 上位レイヤーでキャッシュ) ────────
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/db/package.json       packages/db/
COPY packages/logger/package.json   packages/logger/
COPY packages/prompts/package.json  packages/prompts/
COPY packages/shared/package.json   packages/shared/
COPY apps/collector/package.json    apps/collector/
COPY apps/generator/package.json    apps/generator/
COPY apps/publisher/package.json    apps/publisher/

RUN pnpm install --frozen-lockfile

# Chromium + OS 依存ライブラリを一括インストール
RUN pnpm --filter @note/publisher exec playwright install --with-deps chromium

# ── source ───────────────────────────────────────────────────
COPY packages/ packages/
COPY apps/collector/ apps/collector/
COPY apps/generator/ apps/generator/
COPY apps/publisher/ apps/publisher/

# 1. OSの部品（openssl）をインストール
RUN apt-get update -y && apt-get install -y openssl

# 2. Prismaと部品をインストール
RUN NODE_ENV=development pnpm install prisma @prisma/client -w

# 3. データベースのフォルダに移動して、直接準備を実行する
RUN cd packages/db && NODE_ENV=development pnpm exec prisma generate

# 4. 開発モードを装ってPrismaの準備を実行
RUN NODE_ENV=development pnpm exec prisma generate --schema=packages/db/prisma/schema.prisma

# デフォルトは collector（docker-compose で上書き可）
CMD ["pnpm", "--filter", "@note/collector", "start"]
