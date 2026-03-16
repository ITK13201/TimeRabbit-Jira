# TimeRabbit for Jira - アーキテクチャ設計

## 概要

JiraタスクごとおよびアクティビティタイプごとにJira作業時間を計測・記録するChrome拡張機能。
ダッシュボードは将来フェーズで追加する。

## フェーズ計画

| フェーズ | スコープ | ストレージ |
|---|---|---|
| **Phase 1** (現在) | Chrome拡張 + Popup での簡易サマリー | `chrome.storage.local` のみ |
| **Phase 2** | Extension Options Page としてフルページダッシュボード追加 | `chrome.storage.local` のみ（バックエンド不要） |
| **Phase 3** (将来) | スタンドアロン Web ダッシュボード + バックエンド同期 | バックエンド API + ローカルストレージ |

Phase 2 では同一の `chrome.storage.local` データを参照するため、バックエンドなしでダッシュボードを実現できる。
Phase 3 に備え、`TimeLog` に `syncedAt` フィールドを最初から設けておく。

---

## 1. 全体アーキテクチャ

### コンポーネント構成

Chrome Extension Manifest V3の制約に従い構成する。Phase 2 でダッシュボードを追加。

```
┌─────────────────────────────────────────────────────────────────┐
│  Jira Page (Content Script)                                     │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  JiraPageDetector  →  TaskExtractor  →  FloatingTimer   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │ chrome.runtime.sendMessage        │
└──────────────────────────────┼──────────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────────┐
│  Service Worker (Background)                                    │
│  ┌────────────────┐   ┌──────────────────┐   ┌──────────────┐  │
│  │  MessageRouter │→  │  TimerController │→  │StorageService│  │
│  └────────────────┘   └──────────────────┘   └──────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                  ↑                        ↑
┌─────────────────┴──────┐   ┌────────────┴────────────────────────┐
│  Popup (React)          │   │  Dashboard / Options Page (React)   │
│  ・ActiveTimerCard      │   │  ・TimelineChart    [Phase 2]       │
│  ・TaskSummaryList      │   │  ・ActivityPieChart                 │
│  ・ActivityBreakdown    │   │  ・TaskRankingTable                 │
│  ・[ダッシュボードへ]   │   │  ・DateRangePicker                  │
└────────────────────────┘   │  ・ExportButton (CSV/JSON)          │
                             └─────────────────────────────────────┘
```

### データフロー

1. Content Script がJiraのURLパターンを検知し、タスクキー（例: `PROJ-123`）を抽出
2. ページ上にフローティングUIを注入し、ユーザーがタイマー操作を行う
3. タイマー開始/停止のメッセージをService Workerに送信
4. Service Workerが経過時間を管理し、`chrome.storage.local` に永続化
5. Popup UIはService Workerと通信し、サマリーを表示

---

## 2. ディレクトリ構造

```
TimeRabbit-Jira/
├── manifest.json
├── package.json
├── tsconfig.json
├── vite.config.ts
├── src/
│   ├── background/
│   │   ├── index.ts              # Service Worker エントリポイント
│   │   ├── MessageRouter.ts      # メッセージのルーティング
│   │   ├── TimerController.ts    # タイマー状態管理
│   │   └── StorageService.ts     # chrome.storage 抽象化レイヤー
│   ├── content/
│   │   ├── index.ts              # Content Script エントリポイント
│   │   ├── JiraPageDetector.ts   # URLパターン検知・SPA遷移対応
│   │   ├── TaskExtractor.ts      # DOMからタスクキー・タイトル抽出
│   │   └── FloatingTimer.ts      # ページ上フローティングUI
│   ├── popup/
│   │   ├── index.html
│   │   ├── main.tsx              # Reactエントリポイント
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── ActiveTimerCard.tsx    # 現在計測中タイマー表示
│   │   │   ├── TaskSummaryList.tsx    # タスク別サマリー
│   │   │   ├── ActivityBreakdown.tsx  # アクティビティ別内訳
│   │   │   └── ActivitySelector.tsx   # アクティビティ種別選択
│   │   ├── hooks/
│   │   │   ├── useTimer.ts       # タイマー状態取得・操作
│   │   │   └── useLogs.ts        # ログデータ取得
│   │   └── styles/
│   │       └── popup.css
│   ├── dashboard/                # [Phase 2] Extension Options Page
│   │   ├── index.html
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── TimelineChart.tsx      # 日別・週別タイムライン棒グラフ
│   │   │   ├── ActivityPieChart.tsx   # アクティビティ別円グラフ
│   │   │   ├── TaskRankingTable.tsx   # タスク別時間ランキングテーブル
│   │   │   ├── LogEditDrawer.tsx      # ログ編集・削除サイドドロワー
│   │   │   ├── DateRangePicker.tsx    # 期間フィルター
│   │   │   └── ExportButton.tsx       # CSV/JSONエクスポート
│   │   ├── hooks/
│   │   │   └── useDashboard.ts        # 集計・フィルタリングロジック
│   │   └── styles/
│   │       └── dashboard.css
│   ├── shared/
│   │   ├── types.ts              # 共有TypeScriptインターフェース
│   │   ├── messages.ts           # メッセージ型定義
│   │   ├── constants.ts          # 定数定義
│   │   └── utils/
│   │       ├── time.ts           # 時間フォーマット関数
│   │       ├── storage.ts        # ストレージキー定義
│   │       ├── aggregation.ts    # 集計ロジック（PopupとDashboardで共用）
│   │       └── export.ts         # CSV/JSONエクスポートロジック
│   └── assets/
│       ├── icon16.png
│       ├── icon48.png
│       └── icon128.png
├── docs/
│   └── design/                   # 設計ドキュメント
└── dist/                         # ビルド出力 (gitignore)
```

---

## 3. テクノロジースタック

| 用途 | 採用技術 | 理由 |
|---|---|---|
| 言語 | TypeScript 5.x | 型安全性、IDEサポート |
| Popup / Dashboard UI | React 18 + Vite | コンポーネント再利用、HMR開発効率 |
| Content Script UI | Vanilla TS + Shadow DOM | Jira CSSとの干渉回避 |
| ビルド | Vite + vite-plugin-web-extension | Manifest V3対応、マルチエントリ対応 |
| チャートライブラリ | Recharts | React向け・軽量・型定義あり（Dashboard Phase 2） |
| スタイル | CSS Modules (Popup/Dashboard) / Scoped CSS (Content) | スコープ汚染防止 |
| ID生成 | nanoid | 軽量ユニークID生成 |
| テスト | Vitest + @testing-library/react | Viteと統合済み |

---

## 4. 実装シーケンス（推奨順序）

### Phase 1: Chrome 拡張コア

1. **プロジェクト初期化**: `package.json`, `tsconfig.json`, `vite.config.ts`, `manifest.json`
2. **共有型定義**: `src/shared/types.ts`, `src/shared/messages.ts`, `src/shared/constants.ts`
3. **StorageService**: ストレージ抽象化レイヤーの実装とユニットテスト
4. **TimerController + MessageRouter**: Service Worker のコアロジック
5. **集計ユーティリティ**: `src/shared/utils/aggregation.ts`（Dashboard 共用のため先に作成）
6. **JiraPageDetector + TaskExtractor**: Content Script の検知ロジック
7. **FloatingTimer**: Shadow DOM ベースのフローティングUI
8. **Popup UI**: Reactコンポーネント群とカスタムフック
9. **E2Eテスト**: Chrome Extension テスト環境でのシナリオテスト

### Phase 2: ダッシュボード

10. **manifest.json に `options_ui` を追加**
11. **Dashboard エントリポイント**: `src/dashboard/` の各コンポーネント実装
12. **ExportButton**: CSV/JSON エクスポート機能