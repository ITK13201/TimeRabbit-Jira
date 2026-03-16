import { nanoid } from "nanoid";
import type { ActiveTimer, ExtensionSettings, ExportData, JiraTaskMeta, TimeLog, TaskSummary } from "@/shared/types";
import { DEFAULT_SETTINGS } from "@/shared/types";
import { STORAGE_KEYS } from "@/shared/utils/storage";
import { computeTaskSummaries } from "@/shared/utils/aggregation";

export class StorageService {
  async getLogs(): Promise<TimeLog[]> {
    const result = await chrome.storage.local.get(STORAGE_KEYS.TIME_LOGS);
    return (result[STORAGE_KEYS.TIME_LOGS] as TimeLog[] | undefined) ?? [];
  }

  async saveLogs(logs: TimeLog[]): Promise<void> {
    await chrome.storage.local.set({ [STORAGE_KEYS.TIME_LOGS]: logs });
  }

  async appendLog(log: TimeLog): Promise<void> {
    const logs = await this.getLogs();
    logs.push(log);
    await this.saveLogs(logs);
  }

  async computeSummaries(): Promise<TaskSummary[]> {
    const logs = await this.getLogs();
    const metaCache = await this.getAllTaskMeta();
    return computeTaskSummaries(logs, metaCache);
  }

  async archiveLogs(): Promise<ExportData> {
    const settings = await this.getSettings();
    const thresholdMs = settings.archiveThresholdDays * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const logs = await this.getLogs();

    const toArchive: TimeLog[] = [];
    const toKeep: TimeLog[] = [];

    for (const log of logs) {
      if (log.stoppedAt !== null && now - log.stoppedAt > thresholdMs) {
        toArchive.push(log);
      } else {
        toKeep.push(log);
      }
    }

    const metaCache = await this.getAllTaskMeta();
    const relevantMeta = Object.fromEntries(
      toArchive.flatMap((l) => (metaCache[l.taskKey] ? [[l.taskKey, metaCache[l.taskKey]]] : []))
    );

    const exportData: ExportData = {
      exportedAt: now,
      version: chrome.runtime.getManifest().version,
      logs: toArchive,
      metaCache: relevantMeta,
    };

    await this.saveLogs(toKeep);
    return exportData;
  }

  async getActiveTimer(): Promise<ActiveTimer | null> {
    const result = await chrome.storage.local.get(STORAGE_KEYS.ACTIVE_TIMER);
    return (result[STORAGE_KEYS.ACTIVE_TIMER] as ActiveTimer | null | undefined) ?? null;
  }

  async setActiveTimer(timer: ActiveTimer | null): Promise<void> {
    await chrome.storage.local.set({ [STORAGE_KEYS.ACTIVE_TIMER]: timer });
  }

  async getTaskMeta(taskKey: string): Promise<JiraTaskMeta | null> {
    const cache = await this.getAllTaskMeta();
    return cache[taskKey] ?? null;
  }

  async getAllTaskMeta(): Promise<Record<string, JiraTaskMeta>> {
    const result = await chrome.storage.local.get(STORAGE_KEYS.TASK_META_CACHE);
    return (result[STORAGE_KEYS.TASK_META_CACHE] as Record<string, JiraTaskMeta> | undefined) ?? {};
  }

  async setTaskMeta(taskKey: string, meta: JiraTaskMeta): Promise<void> {
    const cache = await this.getAllTaskMeta();
    cache[taskKey] = meta;
    await chrome.storage.local.set({ [STORAGE_KEYS.TASK_META_CACHE]: cache });
  }

  async pruneExpiredMetaCache(): Promise<void> {
    const settings = await this.getSettings();
    const now = Date.now();
    const cache = await this.getAllTaskMeta();
    const logs = await this.getLogs();

    const referencedKeys = new Set(logs.map((l) => l.taskKey));
    const activeTimer = await this.getActiveTimer();
    if (activeTimer) {
      referencedKeys.add(activeTimer.taskKey);
    }

    const pruned: Record<string, JiraTaskMeta> = {};
    for (const [key, meta] of Object.entries(cache)) {
      const isExpired = now - meta.fetchedAt > settings.metaCacheTtlMs;
      const isReferenced = referencedKeys.has(key);
      if (!isExpired || isReferenced) {
        pruned[key] = meta;
      }
    }

    await chrome.storage.local.set({ [STORAGE_KEYS.TASK_META_CACHE]: pruned });
  }

  async getSettings(): Promise<ExtensionSettings> {
    const result = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
    const stored = result[STORAGE_KEYS.SETTINGS] as Partial<ExtensionSettings> | undefined;
    return { ...DEFAULT_SETTINGS, ...stored };
  }

  async saveSettings(settings: ExtensionSettings): Promise<void> {
    await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: settings });
  }

  generateId(): string {
    return nanoid();
  }
}
