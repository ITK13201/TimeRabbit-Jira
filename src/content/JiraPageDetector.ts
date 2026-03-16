const TASK_KEY_PATTERN = /\/browse\/([A-Z][A-Z0-9]+-\d+)|\/issues\/([A-Z][A-Z0-9]+-\d+)/;

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
    const match = TASK_KEY_PATTERN.exec(url);
    if (!match) return null;
    return match[1] ?? match[2] ?? null;
  }
}
