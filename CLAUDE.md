# CLAUDE.md

このファイルは、リポジトリ内のコードを扱う際に Claude Code (claude.ai/code) へ指針を提供します。

## アーキテクチャ

Bun モノレポ構成で、2つのアプリを含みます。

- **`apps/web`** — React 19 + Vite フロントエンド（TypeScript、strict モード）
- **`apps/api`** — Cloudflare Workers 上で動作する Hono API（TypeScript、strict モード、Wrangler でデプロイ）

## コマンド

特記がない限り、リポジトリルートで実行します。

```sh
# 依存関係のインストール
bun install

# 開発サーバー
bun run dev:web       # フロントエンド用 Vite 開発サーバー
bun run dev:api       # API 用 Wrangler 開発サーバー

# ビルド
bun run build         # 全ワークスペースをビルド

# Lint & フォーマット（Biome）
bun run lint          # 全ファイルをチェック
bun run lint:fix      # Lint の自動修正
bun run format        # 全ファイルを自動フォーマット

# API を Cloudflare Workers へデプロイ（apps/api から実行）
bun run deploy
```

## コードスタイル

Lint とフォーマットは Biome に統一されています。主な設定:
- インデント: スペース2つ
- JS/TS の文字列はダブルクォート
- セミコロンなし（ASI）
