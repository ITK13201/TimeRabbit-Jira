import { useState } from "react";
import { useTimer } from "./hooks/useTimer";
import { useLogs } from "./hooks/useLogs";
import { ActiveTimerCard } from "./components/ActiveTimerCard";
import { TaskSummaryList } from "./components/TaskSummaryList";

export default function App(): JSX.Element {
  const { activeTimer, meta, loading: timerLoading, stopTimer, discardTimer } = useTimer();
  const { summaries, loading: logsLoading } = useLogs();
  const [showStaleTimerModal, setShowStaleTimerModal] = useState(() => {
    // ブラウザ再起動時の未完了タイマー検知: 初回レンダリング後に検知するため useState の初期化で判断
    return false;
  });

  // 未完了タイマーの検知: activeTimerが存在し、startedAtが現在のブラウザセッション以前（例: 1時間以上前）の場合にモーダルを表示
  const isStaleTimer = activeTimer !== null && Date.now() - activeTimer.startedAt > 60 * 60 * 1000;

  const handleDiscardStaleTimer = (): void => {
    discardTimer()
      .catch((err: unknown) => {
        console.error("[TimeRabbit] discardTimer error:", err);
      })
      .finally(() => {
        setShowStaleTimerModal(false);
      });
  };

  const handleStopStaleTimer = (): void => {
    stopTimer()
      .catch((err: unknown) => {
        console.error("[TimeRabbit] stopTimer error:", err);
      })
      .finally(() => {
        setShowStaleTimerModal(false);
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
            {activeTimer !== null && (
              <ActiveTimerCard
                activeTimer={activeTimer}
                meta={meta}
                onStop={stopTimer}
              />
            )}
            {isStaleTimer && !showStaleTimerModal && (
              <div
                className="card"
                style={{ background: "#fffae6", borderColor: "#ffab00" }}
              >
                <div style={{ fontSize: "12px", color: "#172b4d", marginBottom: "8px" }}>
                  長時間（1時間以上）計測中のタイマーが残っています。
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button className="btn-secondary" onClick={handleStopStaleTimer} style={{ flex: 1 }}>
                    停止して保存
                  </button>
                  <button className="btn-danger" onClick={handleDiscardStaleTimer} style={{ flex: 1 }}>
                    破棄
                  </button>
                </div>
              </div>
            )}
            <TaskSummaryList summaries={summaries} />
          </>
        )}
      </div>
    </>
  );
}
