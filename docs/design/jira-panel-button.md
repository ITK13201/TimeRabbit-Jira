# Jira 課題詳細パネルへのタイマーボタン注入 設計書

## 背景と目的

ボード・バックログ画面で課題を選択すると右側に詳細パネルが開く。
このパネルから直接タイマーを開始・停止できるボタンを注入し、フローを中断せずに計測を始められるようにする。

現状はフローティングウィジェット（画面右下固定）でしか操作できず、パネルを開きながらウィジェットを操作する必要がある。

---

## 対象URL・画面

| URL パターン | 画面 |
|---|---|
| `*/boards/*?*selectedIssue=*` | ボード（スプリント） |
| `*/boards/*/backlog?*selectedIssue=*` | バックログ |

`manifest.json` の `matches` は既に対応済み。

---

## 設計方針

- **Content Script 内に新モジュール `JiraIssuePanel.ts` を追加する**
- Jira の SPA 遷移と詳細パネルの開閉を `MutationObserver` で検知する
- ボタンは **Shadow DOM を使わず** インライン注入する（パネルの自然なスタイルに溶け込ませるため）
- フローティングウィジェット（`FloatingTimer`）とは独立して動作する。両者は `chrome.storage.onChanged` で `ACTIVE_TIMER` を監視し各自で表示を更新する

---

## 注入ポイントの特定

Jira の課題詳細パネルには以下のヘッダー領域がある。

```
[課題キー]  [タイトル]
[ステータス] [担当者] ...  ← ここにボタンを追加する
```

DOM 特定戦略:
1. `MutationObserver` で `selectedIssue` クエリパラメータの変化を検知（`JiraPageDetector` 経由で `taskKey` が通知される）
2. `taskKey` が確定したら、パネル内で `${taskKey}` というテキストを含む要素を起点に、ヘッダー付近のアクションエリアを探索する
3. 既に注入済みの場合（`data-timerabbit="true"` 属性で識別）はスキップする

セレクター候補（優先順）:

| 優先度 | セレクター | 備考 |
|---|---|---|
| 1 | `[data-testid*="issue-header"] [data-testid*="actions"]` | Jira の testid 規則に依存 |
| 2 | `[data-testid="issue.views.issue-base.foundation.breadcrumbs.current-issue.item"]` の親要素 | パンくず付近 |
| 3 | パネル内でタスクキーを含む `<a>` タグの祖先要素にある `<div role="group">` または `<div>` | フォールバック |

注: Jira の DOM は頻繁に変わるため、候補を複数持ち、どれかにマッチしたら注入する戦略をとる。全候補が見つからない場合は注入しない（フローティングウィジェットが代替として機能する）。

注入リトライ: パネルが開いた直後はまだ DOM が構築中のことがあるため、最大 10 回 × 300ms のポーリングで注入を試みる。

---

## ボタンの状態と外観

| 状態 | 表示 | 操作 |
|---|---|---|
| タイマー未起動 | `▶ 計測開始`（青） + アクティビティ選択 `<select>` | クリックで `START_TIMER` |
| このタスクを計測中 | `⏹ 停止`（赤） + 経過時間テキスト | クリックで `STOP_TIMER` |
| 別タスクを計測中 | `▶ 計測開始`（橙、警告アイコン付き） | クリックで `START_TIMER`（既存タイマーは自動停止→新規開始） |

スタイルは Jira のボタン見た目に合わせる（`border-radius: 3px`, `font-size: 12px`, Atlassian Blue `#0052cc`）。Shadow DOM は使わずインライン `style` 属性で指定する。

---

## 実装構成

### 新規ファイル

#### `src/content/JiraIssuePanel.ts`

```typescript
export class JiraIssuePanel {
  private _currentTaskKey: string | null = null;
  private _currentMeta: JiraTaskMeta | null = null;
  private _activeTimer: ActiveTimer | null = null;
  private _retryTimer: ReturnType<typeof setTimeout> | null = null;
  private _retryCount = 0;

  setTaskKey(taskKey: string | null, meta: JiraTaskMeta | null): void
  // taskKey 変化時に呼ばれる。注入済みボタンを削除して再注入を試みる

  setActiveTimer(activeTimer: ActiveTimer | null): void
  // ストレージ変化時に呼ばれる。ボタン表示を更新する

  private _tryInject(): void
  // DOM を探索してボタンを注入する。失敗時はリトライをスケジュール

  private _findInsertionPoint(): Element | null
  // 複数候補セレクターを試してボタンを挿入する DOM 要素を返す

  private _renderButton(container: Element): void
  // ボタン HTML を生成して container に追加する

  private _bindEvents(container: Element): void
  // ボタンのクリックイベントを登録する

  private _cleanup(): void
  // 注入済みボタンを削除し、リトライタイマーをキャンセルする
}
```

### 変更ファイル

#### `src/content/index.ts`

```typescript
import { JiraIssuePanel } from "./JiraIssuePanel";

const panel = new JiraIssuePanel();
panel.mount(); // storageListener 登録

// JiraPageDetector コールバック内
detector = new JiraPageDetector((taskKey) => {
  currentTaskKey = taskKey;
  currentMeta = null;
  panel.setTaskKey(taskKey, null); // meta は後続の resolveTaskMeta で更新
  floatingTimer.setTaskKey(taskKey, null);

  if (taskKey === null) return;
  taskExtractor.resolveTaskMeta(taskKey, baseUrl).then((meta) => {
    if (currentTaskKey === taskKey) {
      currentMeta = meta;
      panel.setTaskKey(taskKey, meta);
      floatingTimer.setTaskKey(taskKey, meta);
    }
  });
});
```

---

## データフロー

```
JiraPageDetector
  └─ onTaskKeyChange(taskKey)
       ├─ FloatingTimer.setTaskKey()     既存
       └─ JiraIssuePanel.setTaskKey()    新規
            └─ _tryInject() → DOM にボタン挿入

chrome.storage.onChanged (ACTIVE_TIMER)
  ├─ FloatingTimer: ウィジェット更新    既存
  └─ JiraIssuePanel: ボタン状態更新    新規
```

---

## 注意点・制約

- **Jira DOM の変化耐性**: セレクターが全て失敗した場合はフローティングウィジェットが代替として機能するため、機能自体は失われない
- **SPA 遷移**: 別の課題を選択すると `JiraPageDetector` が新しい `taskKey` で `setTaskKey` を呼ぶため、古いボタンは `_cleanup()` で削除される
- **課題パネルを閉じた場合**: パネルが閉じると URL から `selectedIssue` が消え `taskKey = null` になるため、`_cleanup()` が走る
- **FloatingTimer との重複**: 両方にボタンが存在することになるが、それぞれ独立して動作するため問題なし。将来的に FloatingTimer を廃止する選択肢も残る

---

## 確認方法

1. `pnpm build` → エラーなし
2. バックログ画面で課題をクリック → 詳細パネルに「▶ 計測開始」ボタンが表示される
3. ボタンをクリック → タイマーが開始され「⏹ 停止 / 経過時間」に切り替わる
4. 別の課題をクリック → ボタンが新しい課題のものに切り替わる
5. パネルを閉じる → ボタンが消える（フローティングウィジェットは継続表示）
