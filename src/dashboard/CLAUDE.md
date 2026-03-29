# src/dashboard — Dashboard UI

`chrome.runtime.openOptionsPage()` で別タブとして開く React UI。ログの閲覧・集計・編集・エクスポートを担う。

## hooks

### useDashboard

日付範囲フィルタと集計ロジックを一元管理する。

- **日付プリセット**: `"today" | "thisWeek" | "lastWeek" | "thisMonth" | "custom"`
- **返却値**: `filteredLogs`, `summaries`, `dailyTotals`, `activityTotals`
- **ログ編集**: `deleteLog()` / `updateLog()` で `chrome.storage.local` を直接操作

## components

| コンポーネント | 説明 |
|---|---|
| `TimelineChart` | 日別・アクティビティ別の積み上げ棒グラフ（Recharts） |
| `ActivityPieChart` | アクティビティ別の割合円グラフ（Recharts） |
| `TaskRankingTable` | タスク別合計時間のソート可能テーブル。編集・削除操作あり |
| `DateRangePicker` | クイックプリセットまたはカスタム日付範囲選択 |
| `LogEditDrawer` | `TimeLog` の開始・終了時刻を編集するドロワー |
| `ExportButton` | CSV / JSON ダウンロード |

## エクスポート形式

- **JSON**: `timerabbit-export.json`
- **CSV**: `timerabbit-export.csv`（タスクメタデータを結合して出力）
