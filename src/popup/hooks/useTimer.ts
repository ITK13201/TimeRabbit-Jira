import { useCallback, useEffect, useState } from "react";
import type { ActiveTimer, ActivityType, JiraTaskMeta } from "@/shared/types";
import { sendMessage } from "@/shared/messages";
import { STORAGE_KEYS } from "@/shared/utils/storage";

interface UseTimerResult {
  activeTimer: ActiveTimer | null;
  meta: JiraTaskMeta | null;
  loading: boolean;
  startTimer: (taskKey: string, activityType: ActivityType, meta: JiraTaskMeta) => Promise<void>;
  stopTimer: () => Promise<void>;
  switchActivity: (activityType: ActivityType) => Promise<void>;
  discardTimer: () => Promise<void>;
  refresh: () => void;
}

export function useTimer(): UseTimerResult {
  const [activeTimer, setActiveTimer] = useState<ActiveTimer | null>(null);
  const [meta, setMeta] = useState<JiraTaskMeta | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchState = useCallback(() => {
    sendMessage({ type: "GET_STATE" })
      .then((response) => {
        if (response.type === "STATE") {
          setActiveTimer(response.activeTimer);
          setMeta(response.meta);
        }
      })
      .catch((err: unknown) => {
        console.error("[TimeRabbit] GET_STATE error:", err);
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

  return {
    activeTimer,
    meta,
    loading,
    startTimer,
    stopTimer,
    switchActivity,
    discardTimer,
    refresh: fetchState,
  };
}
