import { useState } from "react";
import { useTimer } from "./hooks/useTimer";
import { useLogs } from "./hooks/useLogs";
import { ActiveTimerCard } from "./components/ActiveTimerCard";
import { ActivitySelector } from "./components/ActivitySelector";
import { TaskSummaryList } from "./components/TaskSummaryList";
import type { ActivityType } from "@/shared/types";

export default function App() {
  const { activeTimer, meta, currentTask, loading: timerLoading, startTimer, stopTimer, switchActivity, discardTimer } = useTimer();
  const { summaries, loading: logsLoading } = useLogs();
  const [selectedActivity, setSelectedActivity] = useState<ActivityType>("implementation");

  const isStaleTimer = activeTimer !== null && Date.now() - activeTimer.startedAt > 60 * 60 * 1000;

  const handleStart = (): void => {
    if (currentTask === null) return;
    const taskMeta = currentTask.meta ?? {
      taskKey: currentTask.taskKey,
      taskTitle: currentTask.taskKey,
      projectKey: currentTask.taskKey.split("-")[0],
      issueType: "",
      labels: [],
      storyPoints: null,
      sprint: null,
      fixVersions: [],
      parentKey: null,
      parentTitle: null,
      fetchedAt: Date.now(),
    };
    startTimer(currentTask.taskKey, selectedActivity, taskMeta).catch((err: unknown) => {
      console.error("[TimeRabbit] startTimer error:", err);
    });
  };

  const handleStop = (): Promise<void> => stopTimer();

  const handleSwitchActivity = (activityType: ActivityType): void => {
    switchActivity(activityType).catch((err: unknown) => {
      console.error("[TimeRabbit] switchActivity error:", err);
    });
  };

  const handleDiscardStale = (): void => {
    discardTimer().catch((err: unknown) => {
      console.error("[TimeRabbit] discardTimer error:", err);
    });
  };

  const handleStopStale = (): void => {
    stopTimer().catch((err: unknown) => {
      console.error("[TimeRabbit] stopTimer error:", err);
    });
  };

  const loading = timerLoading || logsLoading;

  return (
    <>
      <div className="bg-[#0052cc] text-white px-4 py-3 flex items-center justify-between">
        <span className="text-[15px] font-bold tracking-[0.01em]">TimeRabbit for Jira</span>
        <button
          onClick={() => chrome.runtime.openOptionsPage()}
          title="ダッシュボードを開く"
          className="cursor-pointer border-none bg-transparent text-white/80 hover:text-white text-[16px] leading-none p-0"
        >
          ↗
        </button>
      </div>
      <div className="p-3 flex flex-col gap-3">
        {loading ? (
          <div className="text-[#5e6c84] text-center py-4 text-xs">読み込み中...</div>
        ) : (
          <>
            {/* 未完了タイマーの警告 */}
            {isStaleTimer && (
              <div className="bg-[#fffae6] border border-[#ffab00] rounded-md px-3.5 py-3">
                <p className="text-xs text-[#172b4d] mb-2">
                  長時間（1時間以上）計測中のタイマーが残っています。
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleStopStale}
                    className="flex-1 cursor-pointer border border-[#dfe1e6] rounded px-3 py-1.5 text-xs font-semibold bg-[#f4f5f7] text-[#172b4d] hover:bg-[#ebecf0] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    停止して保存
                  </button>
                  <button
                    onClick={handleDiscardStale}
                    className="flex-1 cursor-pointer border-none rounded px-3 py-1.5 text-xs font-semibold bg-[#de350b] text-white hover:bg-[#ff5630] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    破棄
                  </button>
                </div>
              </div>
            )}

            {/* 計測中タイマー */}
            {activeTimer !== null && (
              <ActiveTimerCard
                activeTimer={activeTimer}
                meta={meta}
                onStop={handleStop}
                onSwitchActivity={handleSwitchActivity}
              />
            )}

            {/* 現在開いているJiraタスク → タイマー開始UI */}
            {currentTask !== null && activeTimer === null && (
              <div className="bg-white border border-[#dfe1e6] rounded-md px-3.5 py-3">
                <div className="text-[11px] font-semibold text-[#5e6c84] uppercase tracking-[0.04em] mb-2">
                  現在のタスク
                </div>
                <div className="font-bold text-[14px] text-[#0052cc] mb-1">
                  {currentTask.taskKey}
                </div>
                {currentTask.meta && (
                  <div className="text-xs text-[#5e6c84] mb-2.5 truncate">
                    {currentTask.meta.taskTitle}
                  </div>
                )}
                <ActivitySelector value={selectedActivity} onChange={setSelectedActivity} />
                <button
                  onClick={handleStart}
                  className="w-full mt-2 cursor-pointer border-none rounded px-3 py-1.5 text-xs font-semibold bg-[#0052cc] text-white hover:bg-[#0065ff] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  計測開始
                </button>
              </div>
            )}

            {/* 別タスクを計測中で、かつ現在別のタスクページを開いている場合 */}
            {currentTask !== null && activeTimer !== null && currentTask.taskKey !== activeTimer.taskKey && (
              <div className="bg-[#f4f5f7] border border-[#dfe1e6] rounded-md px-3.5 py-3">
                <p className="text-xs text-[#5e6c84] mb-2">別のタスクに切り替えますか？</p>
                <div className="font-bold text-[13px] text-[#0052cc] mb-2">
                  {currentTask.taskKey}{currentTask.meta ? ` — ${currentTask.meta.taskTitle}` : ""}
                </div>
                <ActivitySelector value={selectedActivity} onChange={setSelectedActivity} />
                <button
                  onClick={handleStart}
                  className="w-full mt-2 cursor-pointer border-none rounded px-3 py-1.5 text-xs font-semibold bg-[#0052cc] text-white hover:bg-[#0065ff] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  切り替えて計測
                </button>
              </div>
            )}

            {currentTask === null && activeTimer === null && (
              <div className="text-[#5e6c84] text-center py-4 text-xs">
                Jiraのタスクページを開くと<br />ここに表示されます
              </div>
            )}

            <TaskSummaryList summaries={summaries} />
          </>
        )}
      </div>
    </>
  );
}
