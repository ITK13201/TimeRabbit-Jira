import type { TaskSummary } from "@/shared/types";
import { formatDurationShort, formatDateTime } from "@/shared/utils/time";
import { ActivityBreakdown } from "./ActivityBreakdown";

interface TaskSummaryListProps {
  summaries: TaskSummary[];
}

export function TaskSummaryList({ summaries }: TaskSummaryListProps) {
  if (summaries.length === 0) {
    return (
      <div className="bg-white border border-[#dfe1e6] rounded-md px-3.5 py-3">
        <div className="text-[#5e6c84] text-center py-4 text-xs">記録されたタスクはありません</div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-[#dfe1e6] rounded-md px-3.5 py-3">
      <div className="text-[11px] font-semibold text-[#5e6c84] uppercase tracking-[0.04em] mb-2">
        タスク別集計
      </div>
      <ul className="list-none m-0 p-0 flex flex-col gap-2.5">
        {summaries.map((summary) => (
          <li key={summary.taskKey} className="border-b border-[#f4f5f7] pb-2.5">
            <div className="flex justify-between items-start mb-1">
              <span className="font-bold text-[#0052cc] text-[13px]">{summary.taskKey}</span>
              <span className="font-semibold text-[13px] tabular-nums">
                {formatDurationShort(summary.totalDurationMs)}
              </span>
            </div>
            <div className="text-[11px] text-[#172b4d] mb-1.5 truncate">
              {summary.taskTitle}
            </div>
            <ActivityBreakdown byActivity={summary.byActivity} />
            <div className="text-[10px] text-[#97a0af] mt-1">
              最終: {formatDateTime(summary.lastActiveAt)}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
