import type { JiraTaskMeta } from "@/shared/types";
import { JiraPageDetector } from "./JiraPageDetector";
import { TaskExtractor } from "./TaskExtractor";

interface CurrentTaskResponse {
  taskKey: string | null;
  meta: JiraTaskMeta | null;
}

let currentTaskKey: string | null = null;
let currentMeta: JiraTaskMeta | null = null;

const taskExtractor = new TaskExtractor();

// Popupからの「現在のタスクを教えて」リクエストに応答
chrome.runtime.onMessage.addListener(
  (message: unknown, _sender, sendResponse: (response: CurrentTaskResponse) => void) => {
    if (
      message !== null &&
      typeof message === "object" &&
      "type" in message &&
      (message as { type: unknown }).type === "GET_CURRENT_TASK"
    ) {
      sendResponse({ taskKey: currentTaskKey, meta: currentMeta });
    }
    return false;
  }
);

const detector = new JiraPageDetector((taskKey) => {
  currentTaskKey = taskKey;
  currentMeta = null;

  if (taskKey === null) return;

  const baseUrl = `${window.location.protocol}//${window.location.host}`;
  taskExtractor
    .resolveTaskMeta(taskKey, baseUrl)
    .then((meta) => {
      if (currentTaskKey === taskKey) {
        currentMeta = meta;
      }
    })
    .catch((err: unknown) => {
      console.error("[TimeRabbit] Failed to resolve task meta:", err);
    });
});

detector.start();
