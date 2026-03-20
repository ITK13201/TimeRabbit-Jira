import { useCallback, useEffect, useMemo, useState } from "react";
import type { ActivityType, DailyTotal, DashboardFilter, JiraTaskMeta, TaskSummary, TimeLog } from "@/shared/types";
import { STORAGE_KEYS } from "@/shared/utils/storage";
import { computeTaskSummaries, computeDailyTotals, filterLogs, computeActivityTotals } from "@/shared/utils/aggregation";

export type DateRangePreset = "today" | "thisWeek" | "lastWeek" | "thisMonth" | "custom";

function getTodayRange(): { from: number; to: number } {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return { from: d.getTime(), to: d.getTime() + 24 * 60 * 60 * 1000 - 1 };
}

function getThisWeekRange(): { from: number; to: number } {
  const now = new Date();
  const day = now.getDay();
  const daysFromMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - daysFromMonday);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { from: monday.getTime(), to: sunday.getTime() };
}

function getLastWeekRange(): { from: number; to: number } {
  const thisWeek = getThisWeekRange();
  const from = thisWeek.from - 7 * 24 * 60 * 60 * 1000;
  const to = thisWeek.from - 1;
  return { from, to };
}

function getThisMonthRange(): { from: number; to: number } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
  return { from, to };
}

export function getPresetRange(preset: DateRangePreset, custom?: { from: number; to: number }): { from: number; to: number } {
  switch (preset) {
    case "today": return getTodayRange();
    case "thisWeek": return getThisWeekRange();
    case "lastWeek": return getLastWeekRange();
    case "thisMonth": return getThisMonthRange();
    case "custom": return custom ?? getThisWeekRange();
  }
}

const DEFAULT_PRESET: DateRangePreset = "thisWeek";

function buildDefaultFilter(): DashboardFilter {
  return {
    dateRange: getPresetRange(DEFAULT_PRESET),
    projectKeys: [],
    activityTypes: [],
    sprintIds: [],
    labels: [],
    fixVersions: [],
    issueTypes: [],
  };
}

export interface UseDashboardReturn {
  logs: TimeLog[];
  filteredLogs: TimeLog[];
  metaCache: Record<string, JiraTaskMeta>;
  filter: DashboardFilter;
  setFilter: (filter: DashboardFilter) => void;
  preset: DateRangePreset;
  setPreset: (preset: DateRangePreset, customRange?: { from: number; to: number }) => void;
  summaries: TaskSummary[];
  dailyTotals: DailyTotal[];
  activityTotals: Record<ActivityType, number>;
  deleteLog: (logId: string) => Promise<void>;
  updateLog: (log: TimeLog) => Promise<void>;
  loading: boolean;
}

export function useDashboard(): UseDashboardReturn {
  const [logs, setLogs] = useState<TimeLog[]>([]);
  const [metaCache, setMetaCache] = useState<Record<string, JiraTaskMeta>>({});
  const [filter, setFilter] = useState<DashboardFilter>(buildDefaultFilter);
  const [preset, setPresetState] = useState<DateRangePreset>(DEFAULT_PRESET);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const result = await chrome.storage.local.get([
      STORAGE_KEYS.TIME_LOGS,
      STORAGE_KEYS.TASK_META_CACHE,
    ]);
    setLogs((result[STORAGE_KEYS.TIME_LOGS] as TimeLog[] | undefined) ?? []);
    setMetaCache((result[STORAGE_KEYS.TASK_META_CACHE] as Record<string, JiraTaskMeta> | undefined) ?? {});
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchData();

    const listener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (STORAGE_KEYS.TIME_LOGS in changes || STORAGE_KEYS.TASK_META_CACHE in changes) {
        void fetchData();
      }
    };

    chrome.storage.onChanged.addListener(listener);
    return () => {
      chrome.storage.onChanged.removeListener(listener);
    };
  }, [fetchData]);

  const setPreset = useCallback((newPreset: DateRangePreset, customRange?: { from: number; to: number }) => {
    setPresetState(newPreset);
    setFilter((prev) => ({
      ...prev,
      dateRange: getPresetRange(newPreset, customRange),
    }));
  }, []);

  const filteredLogs = useMemo(() => filterLogs(logs, filter), [logs, filter]);
  const summaries = useMemo(() => computeTaskSummaries(filteredLogs, metaCache), [filteredLogs, metaCache]);
  const dailyTotals = useMemo(() => computeDailyTotals(filteredLogs), [filteredLogs]);
  const activityTotals = useMemo(() => computeActivityTotals(filteredLogs), [filteredLogs]);

  const deleteLog = useCallback(async (logId: string) => {
    const result = await chrome.storage.local.get(STORAGE_KEYS.TIME_LOGS);
    const current = (result[STORAGE_KEYS.TIME_LOGS] as TimeLog[] | undefined) ?? [];
    const updated = current.filter((l) => l.id !== logId);
    await chrome.storage.local.set({ [STORAGE_KEYS.TIME_LOGS]: updated });
  }, []);

  const updateLog = useCallback(async (log: TimeLog) => {
    const result = await chrome.storage.local.get(STORAGE_KEYS.TIME_LOGS);
    const current = (result[STORAGE_KEYS.TIME_LOGS] as TimeLog[] | undefined) ?? [];
    const updated = current.map((l) => (l.id === log.id ? log : l));
    await chrome.storage.local.set({ [STORAGE_KEYS.TIME_LOGS]: updated });
  }, []);

  return {
    logs,
    filteredLogs,
    metaCache,
    filter,
    setFilter,
    preset,
    setPreset,
    summaries,
    dailyTotals,
    activityTotals,
    deleteLog,
    updateLog,
    loading,
  };
}
