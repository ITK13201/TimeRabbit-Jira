# ダッシュボード設計 [Phase 2]

## 概要

Chrome Extension の `options_ui`（`open_in_tab: true`）として実装するフルページダッシュボード。
バックエンド不要で `chrome.storage.local` のデータを直接参照する。
Popup からアイコン横の `[↗]` ボタンで新タブとして開く。

## メタデータの表示方針

ダッシュボードは `chrome-extension://` オリジンで動作するため、**Jiraのセッションクッキーを持たず、Jira REST APIを直接呼び出せない**。
そのため、メタデータは `taskMetaCache` に格納済みのものだけを使用する。

```
timeLogs の各レコードに対して：
  taskMetaCache[log.taskKey] が存在する
    → メタの全フィールドを表示（TTLは無視。古くても表示する）
  taskMetaCache[log.taskKey] が存在しない（アーカイブ後などで消えた場合）
    → log.taskTitle をタイトルとして表示
    → labels / sprint / storyPoints / fixVersions / parentKey は "—" で表示
```

> **メタを最新化したい場合**: 対象タスクの Jira ページを開くと Content Script がキャッシュを更新する。ダッシュボードは `chrome.storage.onChanged` を監視しており、更新が反映されると自動的に再描画される。

---

## 画面レイアウト

```
┌──────────────────────────────────────────────────────────────────────┐
│ TimeRabbit for Jira                              [JSONエクスポート]   │
│                                                  [CSVエクスポート]    │
├──────────────────────────────────────────────────────────────────────┤
│ 期間: [今週 ▼]  [2026-03-10] 〜 [2026-03-16]                        │
│ プロジェクト: [すべて ▼]   アクティビティ: [すべて ▼]               │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌────────────────────────────┐  ┌──────────────────────────────┐   │
│  │ 日別タイムライン            │  │ アクティビティ内訳 (円グラフ) │   │
│  │ [棒グラフ: 設計/実装/レビュー積み上げ]  │  │  設計 20% / 実装 60% / レビュー 20%  │   │
│  └────────────────────────────┘  └──────────────────────────────┘   │
│                                                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ タスク別ランキング                                              │  │
│  │ # | タスクキー   | タイトル            | 設計  | 実装  | レビュー | 合計  │  │
│  │ 1 | PROJ-123    | ログイン機能の実装   | 30m  | 1h30m | 30m   | 2h30m │  │
│  │ 2 | PROJ-456    | ダッシュボード設計   | 1h   | -     | -     | 1h    │  │
│  └───────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

---

## コンポーネント詳細

### DateRangePicker

プリセット選択 + カスタム日付範囲入力の両方をサポートする。

| プリセット | 内容 |
|---|---|
| 今日 | 当日 |
| 今週 | 月曜〜日曜 |
| 先週 | 先週の月曜〜日曜 |
| 今月 | 当月1日〜末日 |
| カスタム | 任意の開始日〜終了日 |

### TimelineChart

- ライブラリ: Recharts `BarChart`
- X軸: 日付、Y軸: 分（または時間）
- 設計/実装/レビューを色分けした積み上げ棒グラフ
- ホバーでその日の内訳ツールチップを表示

### ActivityPieChart

- ライブラリ: Recharts `PieChart`
- フィルタ期間内の全アクティビティ合計時間の割合を表示
- ラベルに時間（例: `実装 3h 20m`）を表示

### TaskRankingTable

- 合計時間の降順でソート
- 各行はアクティビティ別の内訳を列として表示
- タスクキーをクリックすると Jira の該当タスクを新タブで開く（`https://*.atlassian.net/browse/{taskKey}`）
- 行をクリックすると該当タスクの `LogEditDrawer` を開く

### LogEditDrawer [Phase 2]

タスク別のタイムログ一覧を表示し、誤計測の修正・削除を行うサイドドロワー。

```
┌─────────────────────────────────────┐
│ PROJ-123 のログ               [×]   │
├─────────────────────────────────────┤
│ 03/16 10:00〜10:45  実装  45m  [削除] │
│ 03/16 11:00〜11:30  設計  30m  [削除] │
│ 03/16 14:00〜15:20  実装  80m  [削除] │
└─────────────────────────────────────┘
```

- **削除**: 該当 TimeLog を `timeLogs` から除去（確認ダイアログあり）
- **編集**: 開始・終了時刻を変更可能。`durationMs` は自動再計算する
- 編集・削除は `chrome.storage.local` への直接書き込みで完結（Service Worker不要）

### ExportButton

```typescript
// src/shared/utils/export.ts

function exportAsJson(
  logs: TimeLog[],
  metaCache: Record<string, JiraTaskMeta>
): void {
  // logsに含まれるtaskKeyのメタのみを抽出
  const relevantMeta = Object.fromEntries(
    logs.map((l) => [l.taskKey, metaCache[l.taskKey]]).filter(([, v]) => v)
  );
  const data: ExportData = {
    exportedAt: Date.now(),
    version: chrome.runtime.getManifest().version,
    logs,
    metaCache: relevantMeta,
  };
  downloadFile(JSON.stringify(data, null, 2), "timerabbit-export.json", "application/json");
}

function exportAsCsv(
  logs: TimeLog[],
  metaCache: Record<string, JiraTaskMeta>
): void {
  const header = [
    "id", "taskKey", "taskTitle", "projectKey", "activityType",
    "startedAt", "stoppedAt", "durationMs",
    "issueType", "storyPoints", "sprintName", "labels", "fixVersions",
    "parentKey", "parentTitle",
  ].join(",");
  const rows = logs.map((l) => {
    const m = metaCache[l.taskKey];
    return [
      l.id, l.taskKey, `"${l.taskTitle}"`, l.projectKey, l.activityType,
      l.startedAt, l.stoppedAt ?? "", l.durationMs,
      m?.issueType ?? "", m?.storyPoints ?? "",
      m?.sprint ? `"${m.sprint.name}"` : "",
      m?.labels.length ? `"${m.labels.join(";")}"` : "",
      m?.fixVersions.length ? `"${m.fixVersions.join(";")}"` : "",
      m?.parentKey ?? "", m?.parentTitle ? `"${m.parentTitle}"` : "",
    ].join(",");
  });
  downloadFile([header, ...rows].join("\n"), "timerabbit-export.csv", "text/csv");
}
```

---

## カスタムフック

### useDashboard

```typescript
// src/dashboard/hooks/useDashboard.ts

interface UseDashboardReturn {
  logs: TimeLog[];
  filteredLogs: TimeLog[];
  metaCache: Record<string, JiraTaskMeta>; // storage から読み込んだキャッシュをそのまま保持
  filter: DashboardFilter;
  setFilter: (filter: DashboardFilter) => void;
  summaries: TaskSummary[];
  dailyTotals: DailyTotal[];   // 日別集計（TimelineChart用）
  activityTotals: Record<ActivityType, number>; // 全体アクティビティ集計（PieChart用）
}
```

`chrome.storage.onChanged` を購読し、Content Script がキャッシュを更新した際に `metaCache` を自動再取得してUIを再描画する。

### DailyTotal - 日別集計型

```typescript
// src/shared/types.ts に追加

export interface DailyTotal {
  date: string;                            // "2026-03-16"
  byActivity: Record<ActivityType, number>; // 各アクティビティの合計ms
  totalMs: number;
}
```

---

## 集計ロジック (`src/shared/utils/aggregation.ts`)

Popup の `useLogs` と Dashboard の `useDashboard` の両方から呼び出す共用モジュール。

```typescript
// 主要関数シグネチャ

/** TimeLog[] から TaskSummary[] を集計 */
function computeTaskSummaries(logs: TimeLog[]): TaskSummary[]

/** TimeLog[] から日別集計を生成 */
function computeDailyTotals(logs: TimeLog[]): DailyTotal[]

/** TimeLog[] をフィルター条件で絞り込む */
function filterLogs(logs: TimeLog[], filter: DashboardFilter): TimeLog[]

/** タスクキー "PROJ-123" からプロジェクトキー "PROJ" を抽出 */
function extractProjectKey(taskKey: string): string
```

---

## Phase 3 への移行パス（将来）

Phase 3 でバックエンドを追加する場合、以下の変更のみで対応可能：

1. `StorageService` に `syncToBackend()` メソッドを追加
2. `TimeLog.syncedAt` を使って未同期ログのみを送信
3. ダッシュボードを拡張ページから独立した Web アプリへ分離
4. `DashboardFilter` はそのまま API クエリパラメータに転用できる

Phase 1/2 の実装をほぼ変更せずに Phase 3 へ移行できるよう、集計ロジックは `src/shared/utils/aggregation.ts` に集約しておくことが重要。
