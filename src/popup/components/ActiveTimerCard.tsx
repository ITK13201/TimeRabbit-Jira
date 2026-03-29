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
  onUpdateStartTime: (startedAt: number) => Promise<void>;
}

function toTimeInput(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function ActiveTimerCard({ activeTimer, meta, onStop, onSwitchActivity, onUpdateStartTime }: ActiveTimerCardProps) {
  const [elapsed, setElapsed] = useState(() => Date.now() - activeTimer.startedAt);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [editingStart, setEditingStart] = useState(false);
  const [startTimeInput, setStartTimeInput] = useState("");
  const [startTimeError, setStartTimeError] = useState<string | null>(null);

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

  const handleStartEditOpen = (): void => {
    setStartTimeInput(toTimeInput(activeTimer.startedAt));
    setStartTimeError(null);
    setEditingStart(true);
  };

  const handleStartEditSave = (): void => {
    if (!startTimeInput) return;

    const [hh, mm] = startTimeInput.split(":").map(Number);
    const base = new Date(activeTimer.startedAt);
    const candidate = new Date(base.getFullYear(), base.getMonth(), base.getDate(), hh, mm, 0, 0);
    const newStartedAt = candidate.getTime();

    if (newStartedAt >= Date.now()) {
      setStartTimeError("開始時刻は現在時刻より前にしてください");
      return;
    }

    onUpdateStartTime(newStartedAt).catch((err: unknown) => {
      console.error("[TimeRabbit] updateTimerStart error:", err);
    });
    setEditingStart(false);
    setStartTimeError(null);
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

      {/* 経過時間 */}
      <div className="text-[28px] font-bold tabular-nums tracking-[0.02em] text-center text-[#172b4d] mb-2">
        {formatDurationClock(elapsed)}
      </div>

      {/* 開始時刻 */}
      {editingStart ? (
        <div className="mb-3">
          <div className="text-[11px] text-[#5e6c84] mb-1">開始時刻を変更</div>
          <div className="flex items-center gap-2">
            <input
              type="time"
              value={startTimeInput}
              onChange={(e) => { setStartTimeInput(e.target.value); setStartTimeError(null); }}
              className="flex-1 border border-[#dfe1e6] rounded px-2 py-1 text-xs focus:outline-none focus:border-[#0052cc]"
            />
            <button
              onClick={handleStartEditSave}
              className="cursor-pointer border-none rounded px-2 py-1 text-[11px] font-semibold bg-[#0052cc] text-white hover:bg-[#0065ff] transition-colors"
            >
              保存
            </button>
            <button
              onClick={() => { setEditingStart(false); setStartTimeError(null); }}
              className="cursor-pointer border border-[#dfe1e6] rounded px-2 py-1 text-[11px] bg-white text-[#5e6c84] hover:bg-[#f4f5f7] transition-colors"
            >
              ×
            </button>
          </div>
          {startTimeError && (
            <p className="text-[10px] text-[#de350b] mt-1">{startTimeError}</p>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-center gap-1 mb-3">
          <span className="text-[11px] text-[#5e6c84]">
            {toTimeInput(activeTimer.startedAt)} 開始
          </span>
          <button
            onClick={handleStartEditOpen}
            title="開始時刻を変更"
            className="cursor-pointer border-none bg-transparent text-[#5e6c84] hover:text-[#0052cc] text-[11px] leading-none transition-colors"
          >
            ✎
          </button>
        </div>
      )}

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
