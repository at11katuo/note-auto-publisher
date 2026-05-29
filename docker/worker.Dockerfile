# collector / generator / publisher 共通ワーカーイメージ
# Playwright (Chromium) と tsx を含む
#
# 起動コマンドは docker-compose で上書きする:
#   collector: pnpm --filter @note/collector start
#   generator: pnpm --filter @note/generator  start
#   publisher: pnpm --filter @note/publisher  start

FROM node:20-bookworm-slim
WORKDIR /app

# 【最重要】ビルド時は開発モードにして pnpm の制限を回避する
ENV NODE_ENV=development
ENV PLAYWRIGHT_HEADLESS=true
ENV PLAYWRIGHT_BROWSERS_PATH=/root/.cache/ms-playwright

RUN corepack enable && corepack prepare pnpm@9 --activate

# ── deps (変更頻度が低い → 上位レイヤーでキャッシュ) ────────
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/db/package.json       packages/db/
COPY packages/logger/package.json   packages/logger/
COPY packages/prompts/package.json  packages/prompts/
COPY packages/shared/package.json   packages/shared/
COPY packages/agent/package.json    packages/agent/
COPY apps/collector/package.json    apps/collector/
COPY apps/generator/package.json    apps/generator/
COPY apps/publisher/package.json    apps/publisher/

# NODE_ENV=development なので、devDependencies も含めてすべてインストールされる
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

# 2. Prismaツールと部品をインストール（-w でルートに配置）
RUN pnpm install prisma @prisma/client -w

# 3. データベースのフォルダに移動して、確実に準備を実行
RUN cd packages/db && pnpm exec prisma generate

# デフォルトは collector（docker-compose で上書き可）
CMD ["pnpm", "--filter", "@note/collector", "start"]