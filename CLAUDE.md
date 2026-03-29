# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

各ディレクトリの詳細は対応する `CLAUDE.md` に記載する。

- `src/background/CLAUDE.md` — Service Worker（タイマー制御・ストレージ）
- `src/content/CLAUDE.md` — Content Script（Jira ページ検出・API・ウィジェット）
- `src/popup/CLAUDE.md` — Popup UI（React）
- `src/dashboard/CLAUDE.md` — Dashboard UI（React・集計・エクスポート）
- `src/shared/CLAUDE.md` — 共有型・メッセージ定義・ユーティリティ

## Commands

```bash
pnpm dev                                    # ウォッチビルド
pnpm build                                  # dist/ にビルド出力
pnpm test                                   # Vitest でテスト実行（全件）
npx vitest run src/path/to/file.test.ts     # 単一テストファイルを実行
npx tsc --noEmit                            # 型チェックのみ
```

ビルド後、Chrome の `chrome://extensions` で `dist/` フォルダを「パッケージ化されていない拡張機能を読み込む」で読み込む。

## アーキテクチャ概要

Manifest V3 の Chrome 拡張。4つのコンテキストが `chrome.runtime.sendMessage` / `chrome.storage.local` で通信する。

```
Content Script  ──sendMessage──▶  Service Worker (Background)
     ▲                                      │
     │ tabs.sendMessage                 storage.local
     │                                      │
  Popup (React)                    Dashboard (React)
```

パスエイリアス: `@/*` → `src/*`
