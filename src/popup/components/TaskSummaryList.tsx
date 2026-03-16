import type { TaskSummary } from "@/shared/types";
import { formatDurationShort, formatDateTime } from "@/shared/utils/time";
import { ActivityBreakdown } from "./ActivityBreakdown";

interface TaskSummaryListProps {
  summaries: TaskSummary[];
}

export function TaskSummaryList({ summaries }: TaskSummaryListProps): JSX.Element {
  if (summaries.length === 0) {
    return (
      <div className="card">
        <div className="empty-state">記録されたタスクはありません</div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-title">タスク別集計</div>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "10px" }}>
        {summaries.map((summary) => (
          <li
            key={summary.taskKey}
            style={{
              borderBottom: "1px solid #f4f5f7",
              paddingBottom: "10px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "4px" }}>
              <span style={{ fontWeight: 700, color: "#0052cc", fontSize: "13px" }}>
                {summary.taskKey}
              </span>
              <span style={{ fontWeight: 600, fontSize: "13px", fontVariantNumeric: "tabular-nums" }}>
                {formatDurationShort(summary.totalDurationMs)}
              </span>
            </div>
            <div
              style={{
                fontSize: "11px",
                color: "#172b4d",
                marginBottom: "6px",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {summary.taskTitle}
            </div>
            <ActivityBreakdown byActivity={summary.byActivity} />
            <div style={{ fontSize: "10px", color: "#97a0af", marginTop: "4px" }}>
              最終: {formatDateTime(summary.lastActiveAt)}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
