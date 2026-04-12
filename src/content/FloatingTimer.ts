import type { ActiveTimer, ActivityType, JiraTaskMeta } from "@/shared/types";
import { ACTIVITY_LABELS } from "@/shared/types";
import { sendMessage } from "@/shared/messages";
import { formatDurationClock } from "@/shared/utils/time";
import { STORAGE_KEYS } from "@/shared/utils/storage";

const WIDGET_ID = "time-rabbit-widget";

export class FloatingTimer {
  private _host: HTMLElement | null = null;
  private _shadow: ShadowRoot | null = null;
  private _currentTaskKey: string | null = null;
  private _currentMeta: JiraTaskMeta | null = null;
  private _activeTimer: ActiveTimer | null = null;
  private _timerInterval: ReturnType<typeof setInterval> | null = null;
  private _storageListener: ((changes: { [key: string]: chrome.storage.StorageChange }) => void) | null = null;
  private _visible = true;
  private _dismissed = false;
  private _collapsed = false;
  private _posX: number | null = null;
  private _posY: number | null = null;
  private _collapseToCorner = false;
  private _barSnapLeft: number | null = null;
  private _barSnapTop: number | null = null;

  mount(): void {
    // 重複防止
    if (document.getElementById(WIDGET_ID)) return;

    this._host = document.createElement("div");
    this._host.id = WIDGET_ID;
    this._shadow = this._host.attachShadow({ mode: "open" });
    document.body.appendChild(this._host);

    this._loadVisibility();
    this._renderWidget();
    this._fetchState();
    this._startStorageListener();
  }

  private _loadVisibility(): void {
    chrome.storage.local.get(STORAGE_KEYS.SETTINGS).then((result) => {
      const settings = result[STORAGE_KEYS.SETTINGS] as { showFloatingTimer?: boolean; floatingTimerCollapseToCorner?: boolean } | undefined;
      this._visible = settings?.showFloatingTimer ?? true;
      this._collapseToCorner = settings?.floatingTimerCollapseToCorner ?? false;
      this._applyVisibility();
    }).catch(() => { /* context invalidated */ });
  }

  private _applyVisibility(): void {
    if (this._host) {
      this._host.style.display = (this._visible && !this._dismissed) ? "" : "none";
    }
  }

  unmount(): void {
    this._stopTimer();
    this._stopStorageListener();
    this._host?.remove();
    this._host = null;
    this._shadow = null;
  }

  setTaskKey(taskKey: string | null, meta: JiraTaskMeta | null): void {
    this._currentTaskKey = taskKey;
    this._currentMeta = meta;
    this._applyVisibility();
    this._renderWidget();
  }

  private _fetchState(): void {
    sendMessage({ type: "GET_STATE" })
      .then((response) => {
        if (response.type === "STATE") {
          this._activeTimer = response.activeTimer;
          this._currentMeta = response.meta ?? this._currentMeta;
          this._renderWidget();
          if (this._activeTimer) {
            this._startTimer();
          }
        }
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.message.includes("Extension context invalidated")) {
          this.unmount();
          return;
        }
        console.error("[TimeRabbit] GET_STATE error:", err);
      });
  }

  private _startStorageListener(): void {
    this._storageListener = (changes) => {
      if (STORAGE_KEYS.ACTIVE_TIMER in changes) {
        const newTimer = changes[STORAGE_KEYS.ACTIVE_TIMER]?.newValue as ActiveTimer | null | undefined;
        this._activeTimer = newTimer ?? null;

        if (this._activeTimer) {
          this._startTimer();
        } else {
          this._stopTimer();
        }
        this._renderWidget();
      }
      if (STORAGE_KEYS.SETTINGS in changes) {
        const settings = changes[STORAGE_KEYS.SETTINGS]?.newValue as { showFloatingTimer?: boolean; floatingTimerCollapseToCorner?: boolean } | undefined;
        this._visible = settings?.showFloatingTimer ?? true;
        this._collapseToCorner = settings?.floatingTimerCollapseToCorner ?? false;
        this._applyVisibility();
      }
    };
    chrome.storage.onChanged.addListener(this._storageListener);
  }

  private _stopStorageListener(): void {
    if (this._storageListener) {
      chrome.storage.onChanged.removeListener(this._storageListener);
      this._storageListener = null;
    }
  }

  private _startTimer(): void {
    this._stopTimer();
    this._timerInterval = setInterval(() => {
      this._updateElapsedTime();
    }, 1000);
  }

  private _stopTimer(): void {
    if (this._timerInterval !== null) {
      clearInterval(this._timerInterval);
      this._timerInterval = null;
    }
  }

  private _updateElapsedTime(): void {
    if (!this._shadow || !this._activeTimer) return;
    const elapsed = this._shadow.getElementById("tr-elapsed");
    if (elapsed) {
      const ms = Date.now() - this._activeTimer.startedAt;
      elapsed.textContent = formatDurationClock(ms);
    }
  }

  private _getActivityOptions(selected: ActivityType): string {
    return (Object.entries(ACTIVITY_LABELS) as [ActivityType, string][])
      .map(([value, label]) => `<option value="${value}"${value === selected ? " selected" : ""}>${label}</option>`)
      .join("");
  }

  private _renderWidget(): void {
    if (!this._shadow) return;

    const isCurrentTask = this._activeTimer !== null && this._activeTimer.taskKey === this._currentTaskKey;
    const isOtherTask = this._activeTimer !== null && this._activeTimer.taskKey !== this._currentTaskKey;
    const elapsed = this._activeTimer ? formatDurationClock(Date.now() - this._activeTimer.startedAt) : "00:00:00";
    const defaultActivity: ActivityType = this._activeTimer?.activityType ?? "implementation";

    const positionStyle = this._collapsed
      ? (this._collapseToCorner
          ? `bottom: 24px; right: 24px; top: auto; left: auto;`
          : (this._barSnapTop !== null
              ? `top: ${this._barSnapTop}px; left: ${this._barSnapLeft ?? 0}px; bottom: auto; right: auto;`
              : `bottom: 24px; right: 24px;`))
      : (this._posX !== null
          ? `top: ${this._posY}px; left: ${this._posX}px; bottom: auto; right: auto;`
          : `bottom: 24px; right: 24px;`);

    const commonStyle = `
      <style>
        :host { all: initial; }
        #tr-widget {
          position: fixed;
          z-index: 9999;
          background: #fff;
          border: 1px solid #dfe1e6;
          border-radius: 8px;
          box-shadow: 0 4px 16px rgba(0,0,0,0.18);
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          font-size: 13px;
          color: #172b4d;
          user-select: none;
        }
        .tr-icon-btn {
          background: none;
          border: none;
          cursor: pointer;
          color: #5e6c84;
          font-size: 15px;
          line-height: 1;
          padding: 2px 5px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .tr-icon-btn:hover {
          background: #f4f5f7;
          color: #172b4d;
        }
      </style>
    `;

    if (this._collapsed) {
      const isRunning = this._activeTimer !== null;
      this._shadow.innerHTML = `
        ${commonStyle}
        <div id="tr-widget" style="${positionStyle} padding: 8px 12px; display: flex; align-items: center; gap: 10px; min-width: 0; cursor: grab;">
          <span style="font-weight: 600; font-size: 11px; color: #5e6c84; text-transform: uppercase; letter-spacing: 0.04em; white-space: nowrap;">TimeRabbit</span>
          ${isRunning ? `<span style="width: 7px; height: 7px; border-radius: 50%; background: #36b37e; flex-shrink: 0;"></span>` : ""}
          <span id="tr-elapsed" style="font-size: 14px; font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap;">${elapsed}</span>
          <button class="tr-icon-btn" id="tr-btn-expand" title="展開">＋</button>
          <button class="tr-icon-btn" id="tr-btn-close" title="非表示">✕</button>
        </div>
      `;
    } else {
      this._shadow.innerHTML = `
        ${commonStyle}
        <style>
          #tr-widget { padding: 14px 16px; min-width: 220px; }
          #tr-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 8px;
            cursor: grab;
          }
          #tr-header:active { cursor: grabbing; }
          #tr-header-actions { cursor: default; }
          #tr-title {
            font-weight: 600;
            font-size: 12px;
            color: #5e6c84;
            text-transform: uppercase;
            letter-spacing: 0.04em;
          }
          #tr-header-actions { display: flex; align-items: center; gap: 2px; }
          #tr-task-key {
            font-weight: 700;
            font-size: 14px;
            color: #0052cc;
            margin-bottom: 6px;
          }
          #tr-task-title {
            font-size: 12px;
            color: #5e6c84;
            margin-bottom: 8px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 240px;
          }
          #tr-elapsed {
            font-size: 22px;
            font-weight: 700;
            font-variant-numeric: tabular-nums;
            letter-spacing: 0.02em;
            color: #172b4d;
            margin-bottom: 8px;
            text-align: center;
          }
          #tr-activity-row {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 10px;
          }
          #tr-activity-label { font-size: 12px; color: #5e6c84; white-space: nowrap; }
          #tr-activity-select {
            flex: 1;
            padding: 4px 6px;
            border: 1px solid #dfe1e6;
            border-radius: 4px;
            font-size: 12px;
            background: #fafbfc;
            cursor: pointer;
          }
          #tr-buttons { display: flex; gap: 6px; }
          .tr-btn {
            flex: 1;
            padding: 6px 10px;
            border: none;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            transition: background 0.15s;
          }
          .tr-btn-start { background: #0052cc; color: #fff; }
          .tr-btn-start:hover { background: #0065ff; }
          .tr-btn-stop { background: #de350b; color: #fff; }
          .tr-btn-stop:hover { background: #ff5630; }
          .tr-btn-switch { background: #ff991f; color: #fff; }
          .tr-btn-switch:hover { background: #ffab00; }
          #tr-other-task-notice {
            font-size: 12px;
            color: #ff5630;
            margin-bottom: 8px;
            padding: 6px 8px;
            background: #ffebe6;
            border-radius: 4px;
          }
          #tr-no-task { color: #5e6c84; font-size: 12px; text-align: center; padding: 8px 0; }
        </style>
        <div id="tr-widget" style="${positionStyle}">
          <div id="tr-header">
            <span id="tr-title">TimeRabbit</span>
            <div id="tr-header-actions">
              <button class="tr-icon-btn" id="tr-btn-collapse" title="最小化">－</button>
              <button class="tr-icon-btn" id="tr-btn-close" title="非表示">✕</button>
            </div>
          </div>
          ${this._currentTaskKey === null
            ? `<div id="tr-no-task">Jiraタスクページを開いてください</div>`
            : `
            <div id="tr-task-key">${this._currentTaskKey}</div>
            ${this._currentMeta ? `<div id="tr-task-title">${this._currentMeta.taskTitle}</div>` : ""}
            ${isOtherTask
              ? `<div id="tr-other-task-notice">他のタスクを計測中: ${this._activeTimer!.taskKey}</div>`
              : ""
            }
            <div id="tr-elapsed">${isCurrentTask ? elapsed : "00:00:00"}</div>
            <div id="tr-activity-row">
              <span id="tr-activity-label">種別:</span>
              <select id="tr-activity-select">
                ${this._getActivityOptions(defaultActivity)}
              </select>
            </div>
            <div id="tr-buttons">
              ${isCurrentTask
                ? `
                  <button class="tr-btn tr-btn-switch" id="tr-btn-switch">切替</button>
                  <button class="tr-btn tr-btn-stop" id="tr-btn-stop">停止</button>
                `
                : `<button class="tr-btn tr-btn-start" id="tr-btn-start">開始</button>`
              }
            </div>
            `
          }
        </div>
      `;
    }

    this._bindEvents();
  }

  private _bindEvents(): void {
    if (!this._shadow) return;

    const dragHandle = this._shadow.getElementById(this._collapsed ? "tr-widget" : "tr-header");
    dragHandle?.addEventListener("mousedown", (e: Event) => {
      const me = e as MouseEvent;
      if ((me.target as HTMLElement).closest("button, select")) return;

      const widget = this._shadow!.getElementById("tr-widget")!;
      const rect = widget.getBoundingClientRect();
      const offsetX = me.clientX - rect.left;
      const offsetY = me.clientY - rect.top;

      const onMouseMove = (me2: MouseEvent) => {
        const newX = Math.max(0, Math.min(me2.clientX - offsetX, window.innerWidth - rect.width));
        const newY = Math.max(0, Math.min(me2.clientY - offsetY, window.innerHeight - rect.height));
        if (this._collapsed) {
          this._barSnapLeft = newX;
          this._barSnapTop = newY;
          widget.style.left = `${newX}px`;
          widget.style.top = `${newY}px`;
          widget.style.right = "auto";
          widget.style.bottom = "auto";
        } else {
          this._posX = newX;
          this._posY = newY;
          widget.style.left = `${newX}px`;
          widget.style.top = `${newY}px`;
          widget.style.right = "auto";
          widget.style.bottom = "auto";
        }
      };

      const onMouseUp = () => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
      me.preventDefault();
    });

    this._shadow.getElementById("tr-btn-collapse")?.addEventListener("click", () => {
      const widget = this._shadow!.getElementById("tr-widget")!;
      const rect = widget.getBoundingClientRect();
      this._barSnapLeft = rect.left;
      this._barSnapTop = rect.top;
      this._collapsed = true;
      this._renderWidget();
    });

    this._shadow.getElementById("tr-btn-expand")?.addEventListener("click", () => {
      this._collapsed = false;
      this._renderWidget();
    });

    this._shadow.getElementById("tr-btn-close")?.addEventListener("click", () => {
      this._dismissed = true;
      this._applyVisibility();
    });

    const startBtn = this._shadow.getElementById("tr-btn-start");
    const stopBtn = this._shadow.getElementById("tr-btn-stop");
    const switchBtn = this._shadow.getElementById("tr-btn-switch");
    const activitySelect = this._shadow.getElementById("tr-activity-select") as HTMLSelectElement | null;

    startBtn?.addEventListener("click", () => {
      if (!this._currentTaskKey || !this._currentMeta) return;
      const activity = (activitySelect?.value ?? "implementation") as ActivityType;
      sendMessage({
        type: "START_TIMER",
        payload: {
          taskKey: this._currentTaskKey,
          activityType: activity,
          meta: this._currentMeta,
        },
      }).catch((err: unknown) => {
        console.error("[TimeRabbit] START_TIMER error:", err);
      });
    });

    stopBtn?.addEventListener("click", () => {
      sendMessage({ type: "STOP_TIMER" }).catch((err: unknown) => {
        console.error("[TimeRabbit] STOP_TIMER error:", err);
      });
    });

    switchBtn?.addEventListener("click", () => {
      const activity = (activitySelect?.value ?? "implementation") as ActivityType;
      sendMessage({
        type: "SWITCH_ACTIVITY",
        payload: { activityType: activity },
      }).catch((err: unknown) => {
        console.error("[TimeRabbit] SWITCH_ACTIVITY error:", err);
      });
    });
  }
}
