import type { ActivityType, DailyTotal, DashboardFilter, JiraTaskMeta, TaskSummary, TimeLog } from "../types";
import { toDateString } from "./time";

export function extractProjectKey(taskKey: string): string {
  return taskKey.split("-")[0];
}

export function computeTaskSummaries(
  logs: TimeLog[],
  metaCache: Record<string, JiraTaskMeta> = {}
): TaskSummary[] {
  const map = new Map<string, TaskSummary>();

  for (const log of logs) {
    if (log.stoppedAt === null) continue;
    const existing = map.get(log.taskKey);
    const title = metaCache[log.taskKey]?.taskTitle ?? log.taskTitle;

    if (!existing) {
      map.set(log.taskKey, {
        taskKey: log.taskKey,
        taskTitle: title,
        totalDurationMs: log.durationMs,
        byActivity: {
          design: 0,
          implementation: 0,
          review: 0,
          other: 0,
          [log.activityType]: log.durationMs,
        },
        lastActiveAt: log.stoppedAt,
      });
    } else {
      existing.totalDurationMs += log.durationMs;
      existing.byActivity[log.activityType] += log.durationMs;
      if (log.stoppedAt > existing.lastActiveAt) {
        existing.lastActiveAt = log.stoppedAt;
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => b.lastActiveAt - a.lastActiveAt);
}

export function computeDailyTotals(logs: TimeLog[]): DailyTotal[] {
  const map = new Map<string, DailyTotal>();

  for (const log of logs) {
    if (log.stoppedAt === null) continue;
    const date = toDateString(log.startedAt);
    const existing = map.get(date);

    if (!existing) {
      map.set(date, {
        date,
        byActivity: {
          design: 0,
          implementation: 0,
          review: 0,
          other: 0,
          [log.activityType]: log.durationMs,
        },
        totalMs: log.durationMs,
      });
    } else {
      existing.byActivity[log.activityType] += log.durationMs;
      existing.totalMs += log.durationMs;
    }
  }

  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export function filterLogs(logs: TimeLog[], filter: DashboardFilter): TimeLog[] {
  return logs.filter((log) => {
    if (log.startedAt < filter.dateRange.from || log.startedAt > filter.dateRange.to) return false;
    if (filter.projectKeys.length > 0 && !filter.projectKeys.includes(log.projectKey)) return false;
    if (filter.activityTypes.length > 0 && !filter.activityTypes.includes(log.activityType)) return false;
    return true;
  });
}

export function computeActivityTotals(logs: TimeLog[]): Record<ActivityType, number> {
  const totals: Record<ActivityType, number> = { design: 0, implementation: 0, review: 0, other: 0 };
  for (const log of logs) {
    if (log.stoppedAt !== null) totals[log.activityType] += log.durationMs;
  }
  return totals;
}
