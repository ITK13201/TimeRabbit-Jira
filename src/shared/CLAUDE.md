# src/shared — 共有コード

全コンテキスト（Background / Content / Popup / Dashboard）から参照する型・メッセージ・ユーティリティ。

## 主要ファイル

| ファイル | 役割 |
|---|---|
| `types.ts` | 全型定義（`TimeLog`, `ActiveTimer`, `JiraTaskMeta`, `ActivityType` など） |
| `messages.ts` | メッセージスキーマと型付き `sendMessage()` ラッパー |
| `constants.ts` | `chrome.alarms` 名などの定数 |
| `utils/storage.ts` | ストレージキー定数 |
| `utils/aggregation.ts` | ログ集計ロジック |
| `utils/time.ts` | 時間フォーマット関数 |
| `utils/export.ts` | CSV / JSON エクスポート |

## メッセージ型（messages.ts）

Popup / Dashboard → Service Worker:

| メッセージ | ペイロード |
|---|---|
| `START_TIMER` | `{ taskKey, activityType, meta }` |
| `STOP_TIMER` | `{}` |
| `SWITCH_ACTIVITY` | `{ activityType }` |
| `DISCARD_TIMER` | `{}` |
| `GET_STATE` | `{}` → `{ activeTimer, meta }` |
| `GET_LOGS` | `{}` → `{ logs, summaries, metaCache }` |

Content Script → Popup:

| メッセージ | 説明 |
|---|---|
| `GET_CURRENT_TASK` | アクティブタブのメモリ上の現在タスクを返す |

## 主要型（types.ts）

```typescript
ActivityType = "design" | "implementation" | "review" | "review_response" | "other"

TimeLog {
  id: string;
  taskKey: string;
  taskTitle: string;
  projectKey: string;
  activityType: ActivityType;
  startedAt: number;        // Unix ms
  stoppedAt: number | null; // null = 計測中
  durationMs: number;
  syncedAt: number | null;
}

ActiveTimer {
  logId: string;
  taskKey: string;
  activityType: ActivityType;
  startedAt: number;
}
```

## utils/aggregation.ts

| 関数 | 説明 |
|---|---|
| `computeTaskSummaries()` | `TimeLog[]` をタスクキーで集計し `TaskSummary[]` を返す |
| `computeDailyTotals()` | 日付別に集計し `DailyTotal[]` を返す |
| `filterLogs()` | 日付範囲・プロジェクト・アクティビティでフィルタ |
| `computeActivityTotals()` | アクティビティ別合計時間を返す |

## utils/time.ts

| 関数 | 出力例 |
|---|---|
| `formatDuration()` | `"1h 23m 45s"` |
| `formatDurationClock()` | `"01:23:45"` |
| `formatDurationShort()` | `"1h 23m"` |
| `formatDateTime()` | `"03/16 10:00"` |
| `toDateString()` | `"2026-03-16"` |
