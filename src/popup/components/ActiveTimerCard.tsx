import { useEffect, useRef, useState } from "react";
import type { ActiveTimer, ActivityType, JiraTaskMeta } from "@/shared/types";
import { ACTIVITY_LABELS } from "@/shared/types";
import { formatDurationClock } from "@/shared/utils/time";
import { ActivitySelector } from "./ActivitySelector";

interface ActiveTimerCardProps {
  activeTimer: ActiveTimer;
  meta: JiraTaskMeta | null;
  onStop: () => Promise<void>;
  onSwitchActivity: (activityType: ActivityType) => void;
}

export function ActiveTimerCard({ activeTimer, meta, onStop, onSwitchActivity }: ActiveTimerCardProps) {
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
    <div className="bg-white border border-[#dfe1e6] rounded-md px-3.5 py-3">
      <div className="text-[11px] font-semibold text-[#5e6c84] uppercase tracking-[0.04em] mb-2">
        計測中
      </div>
      <div className="font-bold text-[14px] text-[#0052cc] mb-1">
        {activeTimer.taskKey}
      </div>
      {meta && (
        <div className="text-xs text-[#5e6c84] mb-2 truncate">
          {meta.taskTitle}
        </div>
      )}
      <div className="text-[28px] font-bold tabular-nums tracking-[0.02em] text-center text-[#172b4d] mb-3">
        {formatDurationClock(elapsed)}
      </div>
      <div className="mb-2">
        <div className="text-[11px] text-[#5e6c84] mb-1">アクティビティ変更</div>
        <ActivitySelector value={activeTimer.activityType} onChange={onSwitchActivity} />
      </div>
      <div className="text-[11px] text-[#5e6c84] text-center mb-1">
        現在: {ACTIVITY_LABELS[activeTimer.activityType]}
      </div>
      <div className="flex justify-center">
        <button
          onClick={handleStop}
          className="cursor-pointer border-none rounded px-3 py-1.5 text-xs font-semibold bg-[#de350b] text-white hover:bg-[#ff5630] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          停止
        </button>
      </div>
    </div>
  );
}
