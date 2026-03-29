# src/content — Content Script

Jira ページに注入されるスクリプト。タスク検出・メタ取得・ページ内ウィジェットを担う。

## ファイル構成

| ファイル | 役割 |
|---|---|
| `index.ts` | エントリポイント。各クラスを初期化し `GET_CURRENT_TASK` メッセージに応答 |
| `JiraPageDetector.ts` | URL の変化を検知してタスクキーを抽出 |
| `TaskExtractor.ts` | Jira REST API でメタデータを取得・キャッシュ |
| `FloatingTimer.ts` | ページ内に浮かせるタイマーウィジェット |

## JiraPageDetector

`MutationObserver` で `document.body` を監視し、SPA 遷移を検知する。タスクキーは以下の正規表現で URL から抽出する:

```
/\/browse\/([A-Z][A-Z0-9]+-\d+)|\/issues\/([A-Z][A-Z0-9]+-\d+)/
```

## TaskExtractor

キャッシュ優先戦略: メモリキャッシュ → `chrome.storage.local` → Jira REST API の順で解決。

- **in-flight 重複排除**: 同じ `taskKey` の並行リクエストを 1 本に束ねる
- **`_ensureFieldIdDetected()`**: 初回フェッチ時に Jira レスポンスから `storyPointsFieldId` を自動検出し、設定値と異なれば `ExtensionSettings` を更新する
- **API 呼び出し**: `credentials: "include"` で `/rest/api/3/issue/{taskKey}` を呼び出す（Jira のセッション Cookie を流用）

## FloatingTimer

**Shadow DOM** を使用してホストページのスタイルから完全に分離する。インライン CSS のみ使用。
