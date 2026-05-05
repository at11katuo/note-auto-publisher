# 【リポジトリルートに置くファイル】CLAUDE.md

このファイルを `note-auto-publisher/CLAUDE.md` として保存してください。
Claude Code はセッション開始時にこのファイルを自動的に読み込みます。

---

# note-auto-publisher プロジェクトルール

## プロジェクト概要
note.com に投資・仮想通貨・FIRE系の記事を半自動で投稿するシステム。
ネタ収集と記事生成は自動、最終的な投稿は管理画面からの手動承認制。

## 技術スタック(固定)
- ランタイム: Node.js 20 LTS
- 言語: TypeScript 5.x (strict mode)
- パッケージマネージャ: pnpm 9.x (workspaces)
- モジュール形式: ESM only ("type": "module")
- DB: SQLite + Prisma
- フロント: Next.js 14 (App Router) + Tailwind CSS + shadcn/ui
- ブラウザ自動化: Playwright (Chromium)
- LLM: Anthropic Claude API (claude-sonnet-4-5)
- ロガー: pino
- バリデーション: zod
- エラー処理: neverthrow (Result型)
- プロセス管理: pm2
- コンテナ: Docker + Docker Compose

## ディレクトリ構成(固定)
```
note-auto-publisher/
├── apps/
│   ├── collector/      # ネタ収集ワーカー
│   ├── generator/      # 記事生成ワーカー
│   ├── publisher/      # note 投稿ワーカー
│   └── dashboard/      # Next.js 管理画面
├── packages/
│   ├── db/             # Prisma スキーマ + クライアント
│   ├── prompts/        # 記事生成プロンプト
│   ├── logger/         # pino 共通設定
│   └── shared/         # 共通型定義・zod スキーマ
├── .github/workflows/  # GitHub Actions
├── docker/             # Dockerfile 群
├── docker-compose.yml
├── pnpm-workspace.yaml
├── .env.example
└── CLAUDE.md
```

## コーディング規約
- TypeScript strict mode 必須(any 禁止、unknown を使う)
- 全ての非同期処理は Result 型で返す(neverthrow)
- DB アクセスは必ず `packages/db` 経由、各 app から直接 Prisma を import しない
- 環境変数は `packages/shared/env.ts` で zod パースしてから使用
- 関数は基本 named export、default export は Next.js のページのみ
- ファイル名は kebab-case、型名は PascalCase、変数は camelCase

## 記事の品質ルール
### テーマ範囲
- 仮想通貨: ETH中心、税制(20.315%分離課税移行論)、長期保有戦略、DeFi
- 投資全般: NISA(つみたて投資枠/成長投資枠)、iDeCo、eMAXIS Slim All Country、ETF
- FIRE: サイドFIRE、月30万円生活、週3勤務、副業設計、マイクロ法人
- 副次トピック: 確定申告、節税、保険見直し

### NG表現(プロンプトで明示的に禁止)
- 「絶対儲かる」「100%上がる」などの断定的予測
- 特定銘柄の価格予想
- 煽り系のタイトル(「衝撃」「やばい」「○○すべき理由」乱用)
- 個人を特定可能な情報

### 必須要素
- 文字数: 2000〜3500字
- 見出し: H2 を3〜5個、各セクション 400〜700字
- 末尾に投資判断免責文(packages/prompts/disclaimer.ts に定義)
- 自分の体験ベース(筆者は36歳・電気エンジニア・夜勤・2児の父・FIRE志向 という人物設定)

## セキュリティルール
- note のログイン情報は `.env` のみ、絶対にコミットしない
- Anthropic API キーも同様
- 管理画面は Basic認証必須
- Playwright のセッション情報は `apps/publisher/.auth/` に保存し .gitignore
- GitHub Secrets を使用する CI/CD では、ログに環境変数を出力しない

## 開発フロー
- 各 Phase ごとに feature ブランチを切る
- 動作確認できたら main にマージ
- main への push で GitHub Actions が VPS にデプロイ
- 重要な設計判断は `docs/decisions/` に ADR として残す

## やってはいけないこと
- note への過剰なアクセス(投稿は1日3本まで、間隔は最低2時間空ける)
- 完全自動投稿(必ず人間の最終承認を経る)
- 他者の note 記事のスクレイピング(ネタ元は公開ニュースのみ)
- 仮想通貨の価格予想や投資勧誘になる文言の生成