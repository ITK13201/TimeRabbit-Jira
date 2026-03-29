import { useState } from "react";
import type { JiraTaskMeta, TaskSummary, TimeLog } from "@/shared/types";
import { ACTIVITY_LABELS, ACTIVITY_COLORS } from "@/shared/types";
import { formatDurationShort } from "@/shared/utils/time";
import { LogEditDrawer } from "./LogEditDrawer";

interface TaskRankingTableProps {
  summaries: TaskSummary[];
  logs: TimeLog[];
  metaCache: Record<string, JiraTaskMeta>;
  jiraBaseUrls?: Record<string, string>;
  onDeleteLog: (logId: string) => Promise<void>;
  onUpdateLog: (log: TimeLog) => Promise<void>;
  onAddLog: (log: TimeLog) => Promise<void>;
}

const ACTIVITY_TYPES = ["design", "implementation", "review", "review_response", "other"] as const;

export function TaskRankingTable({ summaries, logs, metaCache, jiraBaseUrls, onDeleteLog, onUpdateLog, onAddLog }: TaskRankingTableProps) {
  const [selectedSummary, setSelectedSummary] = useState<TaskSummary | null>(null);

  if (summaries.length === 0) {
    return (
      <div className="bg-white border border-[#dfe1e6] rounded-md px-4 py-6 text-center text-xs text-[#5e6c84]">
        この期間のタスクはありません
      </div>
    );
  }

  return (
    <>
      <div className="bg-white border border-[#dfe1e6] rounded-md overflow-hidden">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-[#f4f5f7] border-b border-[#dfe1e6]">
              <th className="text-left px-3 py-2 font-semibold text-[#5e6c84] w-8">#</th>
              <th className="text-left px-3 py-2 font-semibold text-[#5e6c84]">タスク</th>
              {ACTIVITY_TYPES.map((type) => (
                <th key={type} className="text-right px-3 py-2 font-semibold w-20" style={{ color: ACTIVITY_COLORS[type] }}>
                  {ACTIVITY_LABELS[type]}
                </th>
              ))}
              <th className="text-right px-3 py-2 font-semibold text-[#172b4d] w-20">合計</th>
            </tr>
          </thead>
          <tbody>
            {summaries.map((summary, index) => {
              const meta = metaCache[summary.taskKey];
              return (
                <tr
                  key={summary.taskKey}
                  className="border-b border-[#f4f5f7] last:border-0 hover:bg-[#f8f9ff] cursor-pointer transition-colors"
                  onClick={() => setSelectedSummary(summary)}
                >
                  <td className="px-3 py-2.5 text-[#5e6c84]">{index + 1}</td>
                  <td className="px-3 py-2.5">
                    <div className="font-bold text-[#0052cc]">{summary.taskKey}</div>
                    <div className="text-[11px] text-[#5e6c84] truncate max-w-[280px]">
                      {meta?.taskTitle ?? summary.taskTitle}
                    </div>
                  </td>
                  {ACTIVITY_TYPES.map((type) => (
                    <td key={type} className="px-3 py-2.5 text-right tabular-nums text-[#5e6c84]">
                      {summary.byActivity[type] > 0 ? formatDurationShort(summary.byActivity[type]) : "—"}
                    </td>
                  ))}
                  <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-[#172b4d]">
                    {formatDurationShort(summary.totalDurationMs)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selectedSummary !== null && (
        <LogEditDrawer
          summary={selectedSummary}
          logs={logs}
          metaCache={metaCache}
          allLogs={logs}
          jiraBaseUrls={jiraBaseUrls}
          onDelete={onDeleteLog}
          onUpdate={onUpdateLog}
          onAddLog={onAddLog}
          onClose={() => setSelectedSummary(null)}
        />
      )}
    </>
  );
}
