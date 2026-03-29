import { useCallback, useEffect, useState } from "react";
import type { ActiveTimer, ActivityType, JiraTaskMeta } from "@/shared/types";
import { sendMessage } from "@/shared/messages";
import { STORAGE_KEYS } from "@/shared/utils/storage";

export interface CurrentTask {
  taskKey: string;
  meta: JiraTaskMeta | null;
}

interface UseTimerResult {
  activeTimer: ActiveTimer | null;
  meta: JiraTaskMeta | null;
  currentTask: CurrentTask | null;
  loading: boolean;
  startTimer: (taskKey: string, activityType: ActivityType, meta: JiraTaskMeta) => Promise<void>;
  stopTimer: () => Promise<void>;
  switchActivity: (activityType: ActivityType) => Promise<void>;
  discardTimer: () => Promise<void>;
  updateTimerStart: (startedAt: number) => Promise<void>;
  refresh: () => void;
}

async function fetchCurrentTaskFromActiveTab(): Promise<CurrentTask | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return null;
  try {
    const response = await chrome.tabs.sendMessage(tab.id, { type: "GET_CURRENT_TASK" }) as
      | { taskKey: string | null; meta: JiraTaskMeta | null }
      | undefined;
    if (!response?.taskKey) return null;
    return { taskKey: response.taskKey, meta: response.meta };
  } catch {
    // Jiraページでない場合など content script が存在しないタブではエラーになる
    return null;
  }
}

export function useTimer(): UseTimerResult {
  const [activeTimer, setActiveTimer] = useState<ActiveTimer | null>(null);
  const [meta, setMeta] = useState<JiraTaskMeta | null>(null);
  const [currentTask, setCurrentTask] = useState<CurrentTask | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchState = useCallback(() => {
    Promise.all([
      sendMessage({ type: "GET_STATE" }),
      fetchCurrentTaskFromActiveTab(),
    ])
      .then(([response, task]) => {
        if (response.type === "STATE") {
          setActiveTimer(response.activeTimer);
          setMeta(response.meta);
        }
        setCurrentTask(task);
      })
      .catch((err: unknown) => {
        console.error("[TimeRabbit] fetchState error:", err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchState();

    const listener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (STORAGE_KEYS.ACTIVE_TIMER in changes) {
        fetchState();
      }
    };

    chrome.storage.onChanged.addListener(listener);
    return () => {
      chrome.storage.onChanged.removeListener(listener);
    };
  }, [fetchState]);

  const startTimer = useCallback(
    async (taskKey: string, activityType: ActivityType, taskMeta: JiraTaskMeta) => {
      await sendMessage({ type: "START_TIMER", payload: { taskKey, activityType, meta: taskMeta } });
      fetchState();
    },
    [fetchState]
  );

  const stopTimer = useCallback(async () => {
    await sendMessage({ type: "STOP_TIMER" });
    fetchState();
  }, [fetchState]);

  const switchActivity = useCallback(
    async (activityType: ActivityType) => {
      await sendMessage({ type: "SWITCH_ACTIVITY", payload: { activityType } });
      fetchState();
    },
    [fetchState]
  );

  const discardTimer = useCallback(async () => {
    await sendMessage({ type: "DISCARD_TIMER" });
    fetchState();
  }, [fetchState]);

  const updateTimerStart = useCallback(async (startedAt: number) => {
    await sendMessage({ type: "UPDATE_TIMER_START", payload: { startedAt } });
    fetchState();
  }, [fetchState]);

  return {
    activeTimer,
    meta,
    currentTask,
    loading,
    startTimer,
    stopTimer,
    switchActivity,
    discardTimer,
    updateTimerStart,
    refresh: fetchState,
  };
}
