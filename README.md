# TimeRabbit for Jira

Jira タスクの作業時間をアクティビティ種別ごとに計測・記録する Chrome 拡張機能。

## 機能

- Jira タスクページを開くと自動検出、ワンクリックで計測開始
- アクティビティ種別（設計 / 実装 / レビュー実施 / レビュー対応 / その他）ごとに記録
- アクティビティを切り替えると現在のセッションが確定し、新しいアクティビティで即再開
- 別タスクに切り替えると前のタイマーを自動停止
- ダッシュボードで日別・タスク別・アクティビティ別に集計（グラフ表示）
- ログの編集・削除
- CSV / JSON エクスポート

## インストール

### ビルド

```bash
pnpm install
pnpm build
```

### Chrome に読み込む

1. `chrome://extensions` を開く
2. 「デベロッパーモード」を有効化
3. 「パッケージ化されていない拡張機能を読み込む」で `dist/` フォルダを選択

## 使い方

### タイマー計測

1. Jira のタスクページ（`/browse/PROJ-123` など）を開く
2. Chrome ツールバーの拡張機能アイコンをクリック
3. アクティビティを選択して「計測開始」

### ダッシュボード

拡張機能アイコンをクリックし、ヘッダー右上の「↗」からダッシュボードを開く。

- **日別タイムライン**: アクティビティ別の積み上げ棒グラフ
- **アクティビティ内訳**: 期間内の割合を円グラフで表示
- **タスク別ランキング**: 合計時間の降順テーブル。行クリックでログの編集・削除が可能

### エクスポート

ダッシュボード右上の「JSON エクスポート」「CSV エクスポート」から出力。

## 対応 URL

- `https://*.atlassian.net/browse/*`
- `https://*.atlassian.net/jira/software/projects/*/issues/*`
- `https://*.atlassian.net/jira/*/issues/*`

## 設定

`chrome.storage.local` の `timeRabbit_settings` で以下を変更できます。

| キー | デフォルト | 説明 |
|---|---|---|
| `storyPointsFieldId` | `customfield_10053` | ストーリーポイントのカスタムフィールドID |
| `sprintFieldId` | `customfield_10020` | スプリントのカスタムフィールドID |
| `metaCacheTtlMs` | `3600000`（1時間） | タスクメタキャッシュの有効期限 |
| `archiveThresholdDays` | `90` | アーカイブ対象とする経過日数 |

フィールドIDは `GET /rest/api/3/field` で確認できます。ストーリーポイントのフィールドIDは Jira インスタンスにより異なりますが、拡張機能が初回ページロード時に自動検出します。

## 開発

```bash
pnpm dev       # ウォッチモードでビルド
pnpm build     # プロダクションビルド
pnpm test      # テスト実行
```

## 技術スタック

- TypeScript 5 / React 18 / Vite
- Tailwind CSS v4
- Recharts（ダッシュボードグラフ）
- Chrome Extension Manifest V3
