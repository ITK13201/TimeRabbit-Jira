import type { ActiveTimer, ActivityType, JiraTaskMeta, TimeLog } from "@/shared/types";
import type { StorageService } from "./StorageService";

export class TimerController {
  constructor(private readonly storage: StorageService) {}

  async startTimer(
    taskKey: string,
    activityType: ActivityType,
    meta: JiraTaskMeta
  ): Promise<void> {
    // 既存のactiveTimerがあれば自動停止
    const existing = await this.storage.getActiveTimer();
    if (existing !== null) {
      await this._finalizeTimer(existing);
    }

    // メタをキャッシュに保存
    await this.storage.setTaskMeta(taskKey, meta);

    const logId = this.storage.generateId();
    const now = Date.now();

    const activeTimer: ActiveTimer = {
      logId,
      taskKey,
      activityType,
      startedAt: now,
    };

    await this.storage.setActiveTimer(activeTimer);
  }

  async stopTimer(): Promise<void> {
    const activeTimer = await this.storage.getActiveTimer();
    if (activeTimer === null) return;

    await this._finalizeTimer(activeTimer);
    await this.storage.setActiveTimer(null);
  }

  async switchActivity(newActivityType: ActivityType): Promise<void> {
    const activeTimer = await this.storage.getActiveTimer();
    if (activeTimer === null) return;

    // 現在のセッションを確定
    await this._finalizeTimer(activeTimer);

    // 同タスクで新アクティビティで再開
    const meta = await this.storage.getTaskMeta(activeTimer.taskKey);
    const logId = this.storage.generateId();
    const now = Date.now();

    const newTimer: ActiveTimer = {
      logId,
      taskKey: activeTimer.taskKey,
      activityType: newActivityType,
      startedAt: now,
    };

    if (meta !== null) {
      await this.storage.setTaskMeta(activeTimer.taskKey, meta);
    }

    await this.storage.setActiveTimer(newTimer);
  }

  async discardTimer(): Promise<void> {
    await this.storage.setActiveTimer(null);
  }

  async getState(): Promise<{ activeTimer: ActiveTimer | null; meta: JiraTaskMeta | null }> {
    const activeTimer = await this.storage.getActiveTimer();
    if (activeTimer === null) {
      return { activeTimer: null, meta: null };
    }
    const meta = await this.storage.getTaskMeta(activeTimer.taskKey);
    return { activeTimer, meta };
  }

  private async _finalizeTimer(activeTimer: ActiveTimer): Promise<void> {
    const now = Date.now();
    const meta = await this.storage.getTaskMeta(activeTimer.taskKey);

    const log: TimeLog = {
      id: activeTimer.logId,
      taskKey: activeTimer.taskKey,
      taskTitle: meta?.taskTitle ?? activeTimer.taskKey,
      projectKey: meta?.projectKey ?? activeTimer.taskKey.split("-")[0],
      activityType: activeTimer.activityType,
      startedAt: activeTimer.startedAt,
      stoppedAt: now,
      durationMs: now - activeTimer.startedAt,
      syncedAt: null,
    };

    await this.storage.appendLog(log);
  }
}
