# src/popup — Popup UI

拡張アイコンをクリックした際に表示される React UI。

## データフロー

1. 起動時に `chrome.tabs.sendMessage(tabId, { type: "GET_CURRENT_TASK" })` でアクティブタブのタスクを取得
2. タイマー操作は Service Worker へ `chrome.runtime.sendMessage` で送信
3. `chrome.storage.onChanged` リスナーで Storage の変化を受けて再レンダリング

**currentTask はストレージに保存しない**: タブをまたいで汚染されるため、毎回アクティブタブへ直接問い合わせる。

## hooks

| フック | 説明 |
|---|---|
| `useTimer` | 現在タスク取得・activeTimer 監視・`startTimer` / `stopTimer` / `switchActivity` / `discardTimer` を提供 |
| `useLogs` | `GET_LOGS` メッセージで logs/summaries/metaCache を取得し、Storage 変化で再取得 |

## components

| コンポーネント | 説明 |
|---|---|
| `ActiveTimerCard` | 実行中タイマーを `HH:MM:SS` 形式で表示 |
| `ActivitySelector` | 5種類のアクティビティ選択ドロップダウン |
| `ActivityBreakdown` | アクティビティ別の円グラフ |
| `TaskSummaryList` | 直近タスクと合計時間の一覧 |
