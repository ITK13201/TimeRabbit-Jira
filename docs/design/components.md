# コンポーネント設計

## 1. manifest.json

```json
{
  "manifest_version": 3,
  "name": "TimeRabbit for Jira",
  "version": "1.0.0",
  "description": "Jiraタスクの作業時間をアクティビティ種別ごとに計測・記録する",
  "permissions": [
    "storage",
    "alarms"
  ],
  "host_permissions": [
    "*://*.atlassian.net/*",
    "*://*.jira.com/*"
  ],
  "background": {
    "service_worker": "dist/background/index.js",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": [
        "*://*.atlassian.net/browse/*",
        "*://*.atlassian.net/jira/software/projects/*/boards*",
        "*://*.atlassian.net/jira/*/issues/*"
      ],
      "js": ["dist/content/index.js"],
      "css": ["dist/content/floating-timer.css"],
      "run_at": "document_idle"
    }
  ],
  "action": {
    "default_popup": "popup/index.html",
    "default_icon": {
      "16": "assets/icon16.png",
      "48": "assets/icon48.png",
      "128": "assets/icon128.png"
    }
  },
  "options_ui": {
    "page": "dashboard/index.html",
    "open_in_tab": true
  }
}
```

> **`alarms` パーミッションについて**
> Manifest V3のService Workerはアイドル時にシャットダウンされる。
> `chrome.alarms.create("heartbeat", { periodInMinutes: 1 })` で定期起動させることでタイマー精度を保つ。

---

## 2. Service Worker

### TimerController

- タイマー開始時に `startedAt`（Unixタイムスタンプ）を即座にストレージへ保存
- 経過時間は「現在時刻 - `startedAt`」で毎回再計算（メモリに積算しない）
- これによりService Workerが落ちてもタイマー継続が保証される

#### ① Jiraページ外への遷移・タブクローズ時の挙動

タイマーはService Workerで管理されるため、Jiraのタブを閉じても計測を継続する。
Slack確認・ドキュメント参照など、Jira画面外の作業時間も含めて計測する運用を想定している。
タイマーの停止は FloatingTimer またはPopupから明示的に行う。

#### ② 別タスクへの切り替え（稼働中タイマーあり → 新規 START_TIMER）

前のタイマーを自動停止してから新しいタスクのタイマーを開始する（切り替え型）。
ユーザーの手動停止を不要にし、タスク切り替えをスムーズにする。

```
START_TIMER (新タスク) を受信
  └─ activeTimer が存在する場合
       └─ 現在時刻で前のタイマーを停止・TimeLog を確定
  └─ 新タスクのタイマーを開始
```

#### ② ブラウザ再起動時に未完了タイマーが残っている場合

次回 Content Script 起動時（または Popup を開いたとき）に `activeTimer` を検知したらユーザーに確認する。

```
「前回の計測が残っています。
  PROJ-123 / 実装（開始: 03/16 10:00）

  [今停止する]  [計測を破棄する]」
```

- **今停止する**: 現在時刻で `stoppedAt` を確定し TimeLog を保存
- **計測を破棄する**: `activeTimer` を削除し TimeLog を保存しない

#### ③ 稼働中タイマーのアクティビティ変更（セッション分割）

FloatingTimer のアクティビティセレクトを変更したとき、現在のセッションをその時点で確定し、新しいアクティビティで即座に再開する。

```
アクティビティ変更（実装 → 設計）
  └─ 現在時刻で「実装」タイマーを停止・TimeLog を確定
  └─ 同タスク・「設計」で新しいタイマーを即開始
```

タスクキーは変わらず、ログが2件に分割される。

### StorageService 主要メソッド

```typescript
class StorageService {
  // TimeLog
  async getLogs(): Promise<TimeLog[]>
  async saveLogs(logs: TimeLog[]): Promise<void>
  async appendLog(log: TimeLog): Promise<void>
  async computeSummaries(): Promise<TaskSummary[]>
  /** archiveThresholdDays を超えた完了ログをエクスポートデータとして返し、ストレージから削除する */
  async archiveLogs(): Promise<ExportData>

  // ActiveTimer
  async getActiveTimer(): Promise<ActiveTimer | null>
  async setActiveTimer(timer: ActiveTimer | null): Promise<void>

  // JiraTaskMeta キャッシュ
  async getTaskMeta(taskKey: string): Promise<JiraTaskMeta | null>
  async setTaskMeta(meta: JiraTaskMeta): Promise<void>
  /**
   * TTLを超えたキャッシュエントリのうち、いずれの TimeLog にも参照されていないものだけを削除。
   * TimeLog に対応するメタはダッシュボード表示に必要なため削除しない。
   * heartbeat alarm で定期実行。
   */
  async pruneExpiredMetaCache(): Promise<void>

  // 設定
  async getSettings(): Promise<ExtensionSettings>
  async saveSettings(settings: Partial<ExtensionSettings>): Promise<void>
}
```

---

## 3. Content Script

### JiraPageDetector - SPA遷移対応

JiraはSPAのため、ページ遷移時にContent Scriptが再実行されない。
`MutationObserver` でURLの変化を監視する。

```typescript
let lastUrl = location.href;
const observer = new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    onUrlChange(location.href);
  }
});
observer.observe(document.body, { subtree: true, childList: true });
```

### TaskExtractor - タスクキー抽出 + Jira REST API によるメタ取得

URLからタスクキーを抽出した後、Jira REST API でメタデータを取得する。
Content Scriptはすでにそのページのセッションクッキーを持つため、`credentials: "include"` で認証済みリクエストが可能。

#### Jira API 過負荷対策（キャッシュファースト戦略）

APIコールはキャッシュミス時のみ行う。SPA遷移のたびに叩かない。

```
URL変化を検知
  └─ taskKey を抽出
       └─ chrome.storage から taskMetaCache を確認
            ├─ キャッシュあり & TTL以内  → キャッシュをそのまま使用（APIコールなし）
            ├─ キャッシュあり & TTL超過  → バックグラウンドでAPIフェッチ & キャッシュ更新
            └─ キャッシュなし            → APIフェッチ & キャッシュ保存
```

- **TTL**: `settings.metaCacheTtlMs`（デフォルト1時間）
- **同一キーへの重複リクエスト防止**: `Map<string, Promise<JiraTaskMeta>>` でin-flightなリクエストを管理し、同じ `taskKey` へのリクエストが重複しないようにする

```typescript
// in-flightリクエストの重複排除
const inFlight = new Map<string, Promise<JiraTaskMeta>>();

async function resolveTaskMeta(taskKey: string, baseUrl: string): Promise<JiraTaskMeta> {
  const cached = await storageService.getTaskMeta(taskKey);
  const settings = await storageService.getSettings();
  if (cached && Date.now() - cached.fetchedAt < settings.metaCacheTtlMs) {
    return cached; // キャッシュヒット
  }
  if (inFlight.has(taskKey)) {
    return inFlight.get(taskKey)!; // 同一キーの重複リクエストを排除
  }
  const promise = fetchTaskMeta(taskKey, baseUrl)
    .then(async (meta) => { await storageService.setTaskMeta(meta); return meta; })
    .finally(() => inFlight.delete(taskKey));
  inFlight.set(taskKey, promise);
  return promise;
}
```

```typescript
// タスクキーの抽出
function extractTaskKey(url: string): string | null {
  const match = url.match(/\/browse\/([A-Z][A-Z0-9]+-\d+)|\/issues\/([A-Z][A-Z0-9]+-\d+)/);
  return match ? (match[1] ?? match[2]) : null;
}

// Jira REST API からメタデータ取得
const JIRA_FIELDS = [
  "summary", "issuetype", "labels",
  "customfield_10016",  // ストーリーポイント
  "customfield_10020",  // スプリント
  "fixVersions", "parent",
].join(",");

async function fetchTaskMeta(taskKey: string, baseUrl: string): Promise<JiraTaskMeta> {
  const res = await fetch(
    `${baseUrl}/rest/api/3/issue/${taskKey}?fields=${JIRA_FIELDS}`,
    { credentials: "include" }
  );
  if (!res.ok) throw new Error(`Jira API error: ${res.status}`);
  const data = await res.json();
  return mapToJiraTaskMeta(taskKey, data.fields);
}
```

**レスポンスのマッピング例 (`mapToJiraTaskMeta`):**

```typescript
function mapToJiraTaskMeta(taskKey: string, fields: JiraIssueFields): JiraTaskMeta {
  // スプリント: customfield_10020 は配列で返る。最後の要素がアクティブスプリント
  const rawSprints = fields.customfield_10020 ?? [];
  const lastSprint = rawSprints.at(-1) ?? null;

  return {
    taskKey,
    taskTitle: fields.summary,
    projectKey: taskKey.split("-")[0],
    issueType: fields.issuetype.name,
    labels: fields.labels ?? [],
    storyPoints: fields.customfield_10016 ?? null,
    sprint: lastSprint
      ? { id: lastSprint.id, name: lastSprint.name, state: lastSprint.state }
      : null,
    fixVersions: (fields.fixVersions ?? []).map((v) => v.name),
    parentKey: fields.parent?.key ?? null,
    parentTitle: fields.parent?.fields?.summary ?? null,
    fetchedAt: Date.now(),
  };
}
```

対応URLパターン:
- `https://{workspace}.atlassian.net/browse/{TASK-KEY}`
- `https://{workspace}.atlassian.net/jira/software/projects/{PROJ}/issues/{TASK-KEY}`

> **カスタムフィールドIDの確認方法**: `GET /rest/api/3/field` でインスタンスの全フィールド一覧を取得できる。
> ストーリーポイントが `customfield_10016` 以外の場合に備え、拡張の設定画面でフィールドIDを上書きできるようにしておく。

### FloatingTimer - フローティングUI

- **Vanilla TS + Shadow DOM** で実装することでJiraのCSSと完全に隔離
- Jiraページ右下に固定表示

```
┌─────────────────────────┐
│ PROJ-123                │
│ 実装  ▼                 │
│ 00:23:45                │
│ [■ 停止]               │
└─────────────────────────┘
```

#### マルチタブ同期

複数タブでJiraを開いている場合、各タブのFloatingTimerが独立して存在する。
**Service Workerの `activeTimer` を唯一の正（Single Source of Truth）** とし、FloatingTimerはその状態を反映するだけにする。

```
タブA FloatingTimer          Service Worker           タブB FloatingTimer
      │  GET_STATE ────────────────→ │                       │
      │  ← STATE (activeTimer) ─────┤                       │
      │                             │                       │
      │  START_TIMER ───────────────→ │                      │
      │                             │── chrome.storage.local書き込み
      │                             │                       │
      │                   chrome.storage.onChanged ─────────→ │
      │                             │            状態を再取得・UI更新
```

- 各FloatingTimerは **マウント時に `GET_STATE` を送信** して現在の状態を取得する
- `chrome.storage.onChanged` を監視し、他タブでの操作を即時反映する
- タイマー操作（開始/停止）は必ずService Worker経由で行い、FloatingTimerが直接ストレージを書かない

---

## 4. Popup UI (React)

### 画面構成

```
┌──────────────────────────┐
│ TimeRabbit for Jira  [↗] │  ← [↗] でダッシュボードを新タブで開く
├──────────────────────────┤
│ [計測中] PROJ-123        │
│ 実装  00:23:45  [■停止]  │
├──────────────────────────┤
│ 今週のサマリー            │
│                          │
│ PROJ-123  2h 30m         │
│   設計    30m            │
│   実装    1h 30m         │
│   レビュー 30m           │
│                          │
│ PROJ-456  1h 00m         │
│   実装    1h 00m         │
└──────────────────────────┘
```

### コンポーネント一覧

| コンポーネント | 責務 |
|---|---|
| `ActiveTimerCard` | アクティブタイマーの表示と停止操作 |
| `ActivitySelector` | 設計/実装/レビューのセレクト選択UI |
| `TaskSummaryList` | タスク一覧とその合計時間を表示 |
| `ActivityBreakdown` | 1タスク内のアクティビティ別内訳バー表示 |

### カスタムフック

| フック | 責務 |
|---|---|
| `useTimer` | アクティブタイマーの状態取得と開始/停止操作 |
| `useLogs` | TimeLog一覧とTaskSummary集計結果の取得 |
