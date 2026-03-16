import { useCallback, useEffect, useState } from "react";
import type { JiraTaskMeta, TaskSummary, TimeLog } from "@/shared/types";
import { sendMessage } from "@/shared/messages";
import { STORAGE_KEYS } from "@/shared/utils/storage";

interface UseLogsResult {
  logs: TimeLog[];
  summaries: TaskSummary[];
  metaCache: Record<string, JiraTaskMeta>;
  loading: boolean;
  refresh: () => void;
}

export function useLogs(): UseLogsResult {
  const [logs, setLogs] = useState<TimeLog[]>([]);
  const [summaries, setSummaries] = useState<TaskSummary[]>([]);
  const [metaCache, setMetaCache] = useState<Record<string, JiraTaskMeta>>({});
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(() => {
    sendMessage({ type: "GET_LOGS" })
      .then((response) => {
        if (response.type === "LOGS") {
          setLogs(response.logs);
          setSummaries(response.summaries);
          setMetaCache(response.metaCache);
        }
      })
      .catch((err: unknown) => {
        console.error("[TimeRabbit] GET_LOGS error:", err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchLogs();

    const listener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (STORAGE_KEYS.TIME_LOGS in changes) {
        fetchLogs();
      }
    };

    chrome.storage.onChanged.addListener(listener);
    return () => {
      chrome.storage.onChanged.removeListener(listener);
    };
  }, [fetchLogs]);

  return {
    logs,
    summaries,
    metaCache,
    loading,
    refresh: fetchLogs,
  };
}
