# データモデル設計

## 型定義 (`src/shared/types.ts`)

### アクティビティ種別

```typescript
export type ActivityType = "design" | "implementation" | "review" | "other";

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  design: "設計",
  implementation: "実装",
  review: "レビュー",
  other: "その他",
} as const;
```

### JiraTaskMeta - Jira REST API から取得するタスクメタデータ

タイマー開始時にJira REST APIから一度取得し、`taskMetaCache` にキャッシュする。
各 `TimeLog` にはメタを埋め込まず `taskKey` で参照することでストレージを節約する。

```typescript
export interface JiraSprint {
  id: number;
  name: string;
  state: "active" | "closed" | "future";
}

export interface JiraTaskMeta {
  taskKey: string;
  taskTitle: string;
  projectKey: string;
  issueType: string;          // "Story" | "Bug" | "Task" | "Epic" など
  labels: string[];
  storyPoints: number | null; // customfield_10016
  sprint: JiraSprint | null;  // customfield_10020
  fixVersions: string[];
  parentKey: string | null;   // 親タスクキー（例: "PROJ-100"）
  parentTitle: string | null;
  fetchedAt: number;          // キャッシュ取得時のUnix timestamp (ms)
}
```

**取得するJira REST APIフィールド:**

| フィールド | APIフィールド名 |
|---|---|
| タイトル | `summary` |
| 課題タイプ | `issuetype.name` |
| ラベル | `labels` |
| ストーリーポイント | `customfield_10016` |
| スプリント | `customfield_10020` (最後の要素) |
| 修正バージョン | `fixVersions[].name` |
| 親 | `parent.key`, `parent.fields.summary` |

> `customfield_10016`（ストーリーポイント）と `customfield_10020`（スプリント）はJiraインスタンスの設定によりフィールドIDが異なる場合がある。
> 実装時は `/rest/api/3/field` で確認し、設定から上書きできるようにしておく。

---

### TimeLog - 1セッション分のレコード

```typescript
export interface TimeLog {
  id: string;               // nanoidで生成するユニークID
  taskKey: string;          // "PROJ-123"（JiraTaskMeta のキー）
  taskTitle: string;        // タイマー停止時点のスナップショット（キャッシュ消去後も表示可能）
  projectKey: string;       // "PROJ"（タスクキーから自動抽出）
  activityType: ActivityType;
  startedAt: number;        // Unix timestamp (ms)
  stoppedAt: number | null; // null = 現在計測中
  durationMs: number;       // stoppedAt - startedAt (停止後に確定)
  syncedAt: number | null;  // バックエンド同期済みタイムスタンプ（Phase 3用・初期は null）
}
```

> `taskTitle` はスナップショットとして保持し、`taskMetaCache` が消去された後も過去ログのタイトルを表示できる。
> 最新タイトルが必要な場合は `taskMetaCache` を優先して参照する。

### ActiveTimer - タイマーのランタイム状態

Service Workerがメモリ上で保持する現在進行中のタイマー情報。

```typescript
export interface ActiveTimer {
  logId: string;
  taskKey: string;
  activityType: ActivityType;
  startedAt: number;        // Unix timestamp (ms)
}
```

### TaskSummary - 集計結果

```typescript
export interface TaskSummary {
  taskKey: string;
  taskTitle: string;
  totalDurationMs: number;
  byActivity: Record<ActivityType, number>; // 各アクティビティの合計ms
  lastActiveAt: number;
}
```

### ExtensionSettings - 拡張設定

Jiraインスタンスごとに異なるカスタムフィールドIDなどをユーザーが上書きできるようにする。

```typescript
export interface ExtensionSettings {
  storyPointsFieldId: string;   // デフォルト: "customfield_10016"
  sprintFieldId: string;        // デフォルト: "customfield_10020"
  metaCacheTtlMs: number;       // デフォルト: 3_600_000 (1時間)
  archiveThresholdDays: number; // デフォルト: 90（90日以上前のログをアーカイブ対象とする）
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  storyPointsFieldId: "customfield_10016",
  sprintFieldId: "customfield_10020",
  metaCacheTtlMs: 3_600_000,
  archiveThresholdDays: 90,
};
```

### StorageSchema - ストレージ全体の型

```typescript
export interface StorageSchema {
  timeLogs: TimeLog[];
  activeTimer: ActiveTimer | null;
  taskMetaCache: Record<string, JiraTaskMeta>; // キー: taskKey
  settings: ExtensionSettings;
}
```

> `chrome.storage.local` の上限は **5MB**。
> - `taskMetaCache` の削除ルール:
>   - **`timeLogs` に対応するキー（taskKey）は削除しない** — ダッシュボード表示に必要
>   - `timeLogs` に対応しないキー（閲覧だけして計測しなかったタスク）は TTL 超過で削除する
> - `timeLogs`: `archiveThresholdDays`（デフォルト90日）を超えた完了ログをアーカイブ対象とする。アーカイブはエクスポートと同時に行い、ユーザー確認後にローカルから削除する

---

### DashboardFilter - ダッシュボード用フィルター条件

```typescript
export interface DashboardFilter {
  dateRange: { from: number; to: number }; // Unix timestamp (ms)
  projectKeys: string[];                   // 空配列 = 全プロジェクト
  activityTypes: ActivityType[];           // 空配列 = 全アクティビティ
  sprintIds: number[];                     // 空配列 = 全スプリント
  labels: string[];                        // 空配列 = 全ラベル
  fixVersions: string[];                   // 空配列 = 全バージョン
  issueTypes: string[];                    // 空配列 = 全課題タイプ
}
```

### ExportData - エクスポート用フォーマット

```typescript
export interface ExportData {
  exportedAt: number;  // Unix timestamp (ms)
  version: string;     // アプリバージョン（インポート互換性管理用）
  logs: TimeLog[];
  metaCache: Record<string, JiraTaskMeta>; // logs内のtaskKeyに対応するメタのみ含む
}
```

---

## メッセージプロトコル (`src/shared/messages.ts`)

PopupとContent ScriptはどちらもService Workerに `chrome.runtime.sendMessage` で送信する。

```typescript
export type Message =
  | { type: "START_TIMER"; payload: { taskKey: string; activityType: ActivityType; meta: JiraTaskMeta } }
  | { type: "STOP_TIMER" }
  | { type: "SWITCH_ACTIVITY"; payload: { activityType: ActivityType } } // 稼働中タイマーのアクティビティ変更（セッション分割）
  | { type: "DISCARD_TIMER" }  // 未完了タイマーの破棄
  | { type: "GET_STATE" }
  | { type: "GET_LOGS" };

export type MessageResponse =
  | { type: "STATE"; activeTimer: ActiveTimer | null; meta: JiraTaskMeta | null }
  | { type: "LOGS"; logs: TimeLog[]; summaries: TaskSummary[]; metaCache: Record<string, JiraTaskMeta> }
  | { type: "OK" }
  | { type: "ERROR"; message: string };
```

---

## ストレージキー定義 (`src/shared/utils/storage.ts`)

```typescript
export const STORAGE_KEYS = {
  TIME_LOGS: "timeRabbit_timeLogs",
  ACTIVE_TIMER: "timeRabbit_activeTimer",
  TASK_META_CACHE: "timeRabbit_taskMetaCache",
  SETTINGS: "timeRabbit_settings",
} as const;
```
