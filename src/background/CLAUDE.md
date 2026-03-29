# src/background — Service Worker

Manifest V3 の Service Worker。メッセージルーティング・タイマー制御・ストレージ管理を担う。

## ファイル構成

| ファイル | 役割 |
|---|---|
| `index.ts` | エントリポイント。`chrome.alarms` ハートビート（1分）で `pruneExpiredMetaCache` を実行 |
| `MessageRouter.ts` | `chrome.runtime.onMessage` を受け取り、各ハンドラへディスパッチ |
| `TimerController.ts` | タイマーのビジネスロジック |
| `StorageService.ts` | `chrome.storage.local` の読み書き抽象化 |

## TimerController

| メソッド | 説明 |
|---|---|
| `startTimer()` | 既存の activeTimer を自動停止してから新規開始 |
| `stopTimer()` | 現在のタイマーを確定し `TimeLog` として保存 |
| `switchActivity()` | 現セッションを確定し、同タスクで新アクティビティを開始（セッション分割） |
| `discardTimer()` | ログを残さず破棄 |
| `getState()` | `{ activeTimer, meta }` を返す |

## StorageService

| メソッド | 説明 |
|---|---|
| `getLogs()` / `saveLogs()` / `appendLog()` | TimeLog の CRUD |
| `getActiveTimer()` / `setActiveTimer()` | 現在のタイマー管理 |
| `getTaskMeta()` / `setTaskMeta()` / `getAllTaskMeta()` | メタデータキャッシュ |
| `pruneExpiredMetaCache()` | TTL 超過 かつ `timeLogs` に対応ログがないキーのみ削除 |
| `computeSummaries()` | ログをタスクキーで集計して `TaskSummary[]` を返す |

## 設計上の注意

- **タイマーの経過時間は保存しない**: `Date.now() - startedAt` で毎回再計算。Service Worker のシャットダウン後も継続可能。
- **pruneExpiredMetaCache の削除条件**: TTL 超過 **かつ** `timeLogs` に対応ログが存在しないキーのみ（ダッシュボード表示に必要なメタは保持）。
