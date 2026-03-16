import type { ActivityType, ActiveTimer, JiraTaskMeta, TaskSummary, TimeLog } from "./types";

export type Message =
  | { type: "START_TIMER"; payload: { taskKey: string; activityType: ActivityType; meta: JiraTaskMeta } }
  | { type: "STOP_TIMER" }
  | { type: "SWITCH_ACTIVITY"; payload: { activityType: ActivityType } }
  | { type: "DISCARD_TIMER" }
  | { type: "GET_STATE" }
  | { type: "GET_LOGS" };

export type MessageResponse =
  | { type: "STATE"; activeTimer: ActiveTimer | null; meta: JiraTaskMeta | null }
  | { type: "LOGS"; logs: TimeLog[]; summaries: TaskSummary[]; metaCache: Record<string, JiraTaskMeta> }
  | { type: "OK" }
  | { type: "ERROR"; message: string };

export function sendMessage(message: Message): Promise<MessageResponse> {
  return chrome.runtime.sendMessage(message);
}
