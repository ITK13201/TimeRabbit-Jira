import { useEffect, useRef, useState } from "react";
import type { ActiveTimer, JiraTaskMeta } from "@/shared/types";
import { formatDurationClock } from "@/shared/utils/time";

interface ActiveTimerCardProps {
  activeTimer: ActiveTimer;
  meta: JiraTaskMeta | null;
  onStop: () => Promise<void>;
}

export function ActiveTimerCard({ activeTimer, meta, onStop }: ActiveTimerCardProps): JSX.Element {
  const [elapsed, setElapsed] = useState(() => Date.now() - activeTimer.startedAt);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setElapsed(Date.now() - activeTimer.startedAt);
    intervalRef.current = setInterval(() => {
      setElapsed(Date.now() - activeTimer.startedAt);
    }, 1000);

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
      }
    };
  }, [activeTimer.startedAt]);

  const handleStop = (): void => {
    onStop().catch((err: unknown) => {
      console.error("[TimeRabbit] stopTimer error:", err);
    });
  };

  return (
    <div className="card">
      <div className="card-title">計測中</div>
      <div style={{ fontWeight: 700, fontSize: "14px", color: "#0052cc", marginBottom: "4px" }}>
        {activeTimer.taskKey}
      </div>
      {meta && (
        <div
          style={{
            fontSize: "12px",
            color: "#5e6c84",
            marginBottom: "8px",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {meta.taskTitle}
        </div>
      )}
      <div
        style={{
          fontSize: "28px",
          fontWeight: 700,
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "0.02em",
          textAlign: "center",
          marginBottom: "12px",
          color: "#172b4d",
        }}
      >
        {formatDurationClock(elapsed)}
      </div>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <button className="btn-danger" onClick={handleStop}>
          停止
        </button>
      </div>
    </div>
  );
}
