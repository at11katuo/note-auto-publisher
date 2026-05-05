# note-auto-publisher

note.com に投資・仮想通貨・FIRE 系の記事を半自動で投稿するシステム。ネタ収集と記事生成は自動化されており、最終的な投稿は管理画面からの手動承認制を採用しています。

筆者設定: 36歳・電気エンジニア・夜勤・2児の父・FIRE 志向 をペルソナとした記事を生成します。記事の文字数は 2000〜3500 字、免責文・見出し構成などのルールは `packages/prompts/` で管理されます。

## セットアップ

### 前提条件

- Node.js 20 LTS
- pnpm 9.x (`npm install -g pnpm`)

### 手順

```bash
# 1. 依存関係のインストール
pnpm install

# 2. 環境変数の設定
cp .env.example .env
# .env を開いて各値を設定 (最低限 DATABASE_URL が必要)

# 3. DB マイグレーション + Prisma クライアント生成
pnpm db:migrate

# 4. (任意) テスト用シードデータの投入
pnpm db:seed
```

## ネタ収集の実行

```bash
# 全ソース (RSS + X) から収集
pnpm collect

# RSS のみ
pnpm --filter @note/collector start rss

# X のみ (X_BEARER_TOKEN が必要)
pnpm --filter @note/collector start x
```

## DB の確認

```bash
# Prisma Studio (ブラウザで DB を確認)
pnpm db:studio
```

## ディレクトリ構成

```
note-auto-publisher/
├── apps/
│   ├── collector/      # ネタ収集ワーカー        ← Phase 1 ✅
│   ├── generator/      # 記事生成ワーカー         ← Phase 2
│   ├── publisher/      # note 投稿ワーカー        ← Phase 3
│   └── dashboard/      # Next.js 管理画面         ← Phase 4
├── packages/
│   ├── db/             # Prisma スキーマ + クライアント
│   ├── shared/         # 共通型定義・zod スキーマ・Result 型
│   ├── logger/         # pino 共通設定
│   └── prompts/        # 記事生成プロンプト       ← Phase 2
├── docker/             # Dockerfile 群
├── .env.example        # 環境変数サンプル
└── CLAUDE.md           # AI コーディング規約
```

## フェーズ構成

| Phase | 内容 | 状態 |
|-------|------|------|
| 1 | リポジトリ初期化 + DB + collector | ✅ |
| 2 | generator (Claude API で記事生成) | 🔜 |
| 3 | publisher (Playwright で note 投稿) | 🔜 |
| 4 | dashboard (Next.js 管理画面) | 🔜 |
| 5 | 自動化 (pm2 + GitHub Actions + VPS) | 🔜 |

## 環境変数

| 変数名 | 必須 | 説明 |
|--------|------|------|
| `DATABASE_URL` | ✅ | SQLite ファイルパス (例: `file:./dev.db`) |
| `ANTHROPIC_API_KEY` | ✅ | Claude API キー |
| `NOTE_EMAIL` | ✅ | note.com ログインメール |
| `NOTE_PASSWORD` | ✅ | note.com パスワード |
| `DASHBOARD_BASIC_USER` | ✅ | 管理画面 Basic 認証ユーザー名 |
| `DASHBOARD_BASIC_PASS` | ✅ | 管理画面 Basic 認証パスワード |
| `DISCORD_WEBHOOK_URL` | ✅ | Discord エラー通知 Webhook URL |
| `X_BEARER_TOKEN` | - | X API v2 Bearer Token (未設定時は X 収集スキップ) |
| `NODE_ENV` | - | `development` \| `production` (デフォルト: `development`) |
| `LOG_LEVEL` | - | `info` \| `debug` など (デフォルト: `info`) |

## セキュリティ注意事項

- `.env` は絶対にコミットしない (`.gitignore` で除外済み)
- `apps/publisher/.auth/` (Playwright セッション) もコミット禁止
- note への投稿は 1 日 3 本まで、間隔は最低 2 時間空けること
- 完全自動投稿は禁止。必ず管理画面から人間が最終承認すること
