# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev        # ウォッチビルド（Chrome拡張を開発しながらリロード）
pnpm build      # dist/ にビルド出力
pnpm test       # Vitest でテスト実行
npx tsc --noEmit  # 型チェックのみ
```

ビルド後、Chrome の `chrome://extensions` で `dist/` フォルダを「パッケージ化されていない拡張機能を読み込む」で読み込む。

## アーキテクチャ

Manifest V3 の Chrome 拡張。3つのコンテキストが `chrome.runtime.sendMessage` / `chrome.storage.local` で通信する。

```
Jira Page (Content Script)
  └─ JiraPageDetector: MutationObserver で SPA 遷移を検知し taskKey を抽出
  └─ TaskExtractor: Jira REST API でメタ取得（キャッシュファースト・in-flight 重複排除）
  └─ GET_CURRENT_TASK メッセージに応答してメモリ上の現在タスクを返す

Service Worker (Background)
  └─ MessageRouter → TimerController → StorageService
  └─ chrome.alarms heartbeat（1分）で pruneExpiredMetaCache を実行

Popup (React)
  └─ 起動時に chrome.tabs.sendMessage で現在アクティブタブのタスクを取得
  └─ タイマー操作は Service Worker 経由
```

### 重要な設計判断

- **currentTask はストレージに保存しない**: タブをまたいで汚染されるため、Popup が `chrome.tabs.sendMessage` で直接アクティブタブに問い合わせる
- **タイマーの経過時間は「現在時刻 - startedAt」で毎回再計算**: Service Worker がシャットダウンされても継続可能
- **taskMetaCache の削除ルール**: TTL 超過 かつ `timeLogs` に対応するログが存在しないキーのみ削除（ダッシュボード表示に必要なメタは保持）
- **別タスクへの切り替え**: `START_TIMER` 受信時に既存の activeTimer を自動停止してから新規開始
- **アクティビティ変更**: `SWITCH_ACTIVITY` でセッション分割（現在ログを確定し同タスクで新アクティビティ開始）

### ストレージキー（`src/shared/utils/storage.ts`）

| キー | 内容 |
|---|---|
| `timeRabbit_timeLogs` | `TimeLog[]` 全履歴 |
| `timeRabbit_activeTimer` | `ActiveTimer \| null` 現在計測中 |
| `timeRabbit_taskMetaCache` | `Record<taskKey, JiraTaskMeta>` |
| `timeRabbit_settings` | `ExtensionSettings` |

### Jira REST API

Content Script は `credentials: "include"` で `/rest/api/3/issue/{taskKey}` を呼び出す（Jira のセッション Cookie を流用）。`storyPointsFieldId` / `sprintFieldId` は `ExtensionSettings` で上書き可能（デフォルト: `customfield_10016` / `customfield_10020`）。
