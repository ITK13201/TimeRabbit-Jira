export type ActivityType = "design" | "implementation" | "review" | "other";

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  design: "設計",
  implementation: "実装",
  review: "レビュー",
  other: "その他",
} as const;

export const ACTIVITY_COLORS: Record<ActivityType, string> = {
  design: "#0052cc",
  implementation: "#36b37e",
  review: "#ff991f",
  other: "#97a0af",
} as const;

export interface JiraSprint {
  id: number;
  name: string;
  state: "active" | "closed" | "future";
}

export interface JiraTaskMeta {
  taskKey: string;
  taskTitle: string;
  projectKey: string;
  issueType: string;
  labels: string[];
  storyPoints: number | null;
  sprint: JiraSprint | null;
  fixVersions: string[];
  parentKey: string | null;
  parentTitle: string | null;
  fetchedAt: number;
}

export interface TimeLog {
  id: string;
  taskKey: string;
  taskTitle: string;      // タイマー停止時点のスナップショット
  projectKey: string;
  activityType: ActivityType;
  startedAt: number;
  stoppedAt: number | null;
  durationMs: number;
  syncedAt: number | null;
}

export interface ActiveTimer {
  logId: string;
  taskKey: string;
  activityType: ActivityType;
  startedAt: number;
}

export interface TaskSummary {
  taskKey: string;
  taskTitle: string;
  totalDurationMs: number;
  byActivity: Record<ActivityType, number>;
  lastActiveAt: number;
}

export interface DailyTotal {
  date: string; // "2026-03-16"
  byActivity: Record<ActivityType, number>;
  totalMs: number;
}

export interface ExtensionSettings {
  storyPointsFieldId: string;
  sprintFieldId: string;
  metaCacheTtlMs: number;
  archiveThresholdDays: number;
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  storyPointsFieldId: "customfield_10053",
  sprintFieldId: "customfield_10020",
  metaCacheTtlMs: 3_600_000,
  archiveThresholdDays: 90,
};

export interface StorageSchema {
  timeLogs: TimeLog[];
  activeTimer: ActiveTimer | null;
  taskMetaCache: Record<string, JiraTaskMeta>;
  settings: ExtensionSettings;
}

export interface DashboardFilter {
  dateRange: { from: number; to: number };
  projectKeys: string[];
  activityTypes: ActivityType[];
  sprintIds: number[];
  labels: string[];
  fixVersions: string[];
  issueTypes: string[];
}

export interface ExportData {
  exportedAt: number;
  version: string;
  logs: TimeLog[];
  metaCache: Record<string, JiraTaskMeta>;
}
