const PATH_PATTERN = /\/browse\/([A-Z][A-Z0-9]+-\d+)|\/issues\/([A-Z][A-Z0-9]+-\d+)/;

export type TaskKeyChangeCallback = (taskKey: string | null) => void;

export class JiraPageDetector {
  private _currentTaskKey: string | null = null;
  private _observer: MutationObserver | null = null;
  private _callback: TaskKeyChangeCallback;

  constructor(callback: TaskKeyChangeCallback) {
    this._callback = callback;
  }

  start(): void {
    this._checkUrl();

    this._observer = new MutationObserver(() => {
      this._checkUrl();
    });

    this._observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  stop(): void {
    this._observer?.disconnect();
    this._observer = null;
  }

  private _checkUrl(): void {
    const taskKey = this._extractTaskKey(window.location.href);
    if (taskKey !== this._currentTaskKey) {
      this._currentTaskKey = taskKey;
      this._callback(taskKey);
    }
  }

  private _extractTaskKey(url: string): string | null {
    // /browse/TASK-123 または /issues/TASK-123 形式（タスク詳細ページ）
    const pathMatch = PATH_PATTERN.exec(url);
    if (pathMatch) return pathMatch[1] ?? pathMatch[2] ?? null;

    // ?selectedIssue=TASK-123 形式（ボード・バックログの詳細パネル）
    try {
      const params = new URL(url).searchParams;
      const selected = params.get("selectedIssue");
      if (selected && /^[A-Z][A-Z0-9]+-\d+$/.test(selected)) return selected;
    } catch {
      // 不正なURLは無視
    }

    return null;
  }
}
