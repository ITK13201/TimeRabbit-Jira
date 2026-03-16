import { useState } from "react";
import { useTimer } from "./hooks/useTimer";
import { useLogs } from "./hooks/useLogs";
import { ActiveTimerCard } from "./components/ActiveTimerCard";
import { ActivitySelector } from "./components/ActivitySelector";
import { TaskSummaryList } from "./components/TaskSummaryList";
import type { ActivityType } from "@/shared/types";

export default function App(): JSX.Element {
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
      <div className="popup-header">TimeRabbit for Jira</div>
      <div className="popup-content">
        {loading ? (
          <div className="empty-state">読み込み中...</div>
        ) : (
          <>
            {/* 未完了タイマーの警告 */}
            {isStaleTimer && (
              <div className="card" style={{ background: "#fffae6", borderColor: "#ffab00" }}>
                <div style={{ fontSize: "12px", color: "#172b4d", marginBottom: "8px" }}>
                  長時間（1時間以上）計測中のタイマーが残っています。
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button className="btn-secondary" onClick={handleStopStale} style={{ flex: 1 }}>
                    停止して保存
                  </button>
                  <button className="btn-danger" onClick={handleDiscardStale} style={{ flex: 1 }}>
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
              <div className="card">
                <div className="card-title">現在のタスク</div>
                <div style={{ fontWeight: 700, fontSize: "14px", color: "#0052cc", marginBottom: "4px" }}>
                  {currentTask.taskKey}
                </div>
                {currentTask.meta && (
                  <div style={{ fontSize: "12px", color: "#5e6c84", marginBottom: "10px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {currentTask.meta.taskTitle}
                  </div>
                )}
                <ActivitySelector value={selectedActivity} onChange={setSelectedActivity} />
                <button className="btn-primary" style={{ width: "100%", marginTop: "8px" }} onClick={handleStart}>
                  計測開始
                </button>
              </div>
            )}

            {/* 別タスクを計測中で、かつ現在別のタスクページを開いている場合 */}
            {currentTask !== null && activeTimer !== null && currentTask.taskKey !== activeTimer.taskKey && (
              <div className="card" style={{ background: "#f4f5f7" }}>
                <div style={{ fontSize: "12px", color: "#5e6c84", marginBottom: "8px" }}>
                  別のタスクに切り替えますか？
                </div>
                <div style={{ fontWeight: 700, fontSize: "13px", color: "#0052cc", marginBottom: "8px" }}>
                  {currentTask.taskKey}{currentTask.meta ? ` — ${currentTask.meta.taskTitle}` : ""}
                </div>
                <ActivitySelector value={selectedActivity} onChange={setSelectedActivity} />
                <button className="btn-primary" style={{ width: "100%", marginTop: "8px" }} onClick={handleStart}>
                  切り替えて計測
                </button>
              </div>
            )}

            {currentTask === null && activeTimer === null && (
              <div className="empty-state">Jiraのタスクページを開くと<br />ここに表示されます</div>
            )}

            <TaskSummaryList summaries={summaries} />
          </>
        )}
      </div>
    </>
  );
}
