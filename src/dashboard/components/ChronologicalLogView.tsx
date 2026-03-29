import { useMemo, useState } from "react";
import type { ActivityType, JiraTaskMeta, TaskSummary, TimeLog } from "@/shared/types";
import { ACTIVITY_COLORS, ACTIVITY_LABELS } from "@/shared/types";
import { formatDurationShort, formatTimeHHMM, toDateString } from "@/shared/utils/time";
import { LogEditDrawer } from "./LogEditDrawer";

interface ChronologicalLogViewProps {
  logs: TimeLog[];
  allLogs: TimeLog[];
  metaCache: Record<string, JiraTaskMeta>;
  onDeleteWithUndo: (logId: string) => void;
  onUpdate: (log: TimeLog) => Promise<void>;
  onAddLog: (log: TimeLog) => Promise<void>;
  onOpenAddModal: (opts: { date: string; startTime: string; endTime: string }) => void;
  onShowToast: (message: string, isError?: boolean) => void;
}

type LogRow = { type: "log"; log: TimeLog };
type GapRow = { type: "gap"; startMs: number; endMs: number; durationMs: number };
type Row = LogRow | GapRow;

interface DateGroup {
  date: string;
  totalMs: number;
  rows: Row[];
}

const GAP_THRESHOLD_MS = 30 * 60 * 1000; // 30 分

/** 1 件のログから最小限の TaskSummary を生成 */
function logToSummary(log: TimeLog, metaCache: Record<string, JiraTaskMeta>): TaskSummary {
  const cached = metaCache[log.taskKey];
  const byActivity = {
    design: 0,
    implementation: 0,
    review: 0,
    review_response: 0,
    other: 0,
  } as Record<ActivityType, number>;
  byActivity[log.activityType] = log.durationMs;
  return {
    taskKey: log.taskKey,
    taskTitle: cached?.taskTitle ?? log.taskTitle,
    totalDurationMs: log.durationMs,
    byActivity,
    lastActiveAt: log.stoppedAt ?? log.startedAt,
  };
}

function buildDateGroups(logs: TimeLog[]): DateGroup[] {
  const completed = logs.filter((l) => l.stoppedAt !== null);

  // 日付降順、同日は startedAt 昇順
  const sorted = [...completed].sort((a, b) => {
    const da = toDateString(a.startedAt);
    const db = toDateString(b.startedAt);
    if (da !== db) return db.localeCompare(da);
    return a.startedAt - b.startedAt;
  });

  const groups = new Map<string, TimeLog[]>();
  for (const log of sorted) {
    const d = toDateString(log.startedAt);
    if (!groups.has(d)) groups.set(d, []);
    groups.get(d)!.push(log);
  }

  return [...groups.entries()].map(([date, dayLogs]) => {
    const rows: Row[] = [];
    let totalMs = 0;
    for (let i = 0; i < dayLogs.length; i++) {
      const log = dayLogs[i];
      totalMs += log.durationMs;

      if (i > 0) {
        const prev = dayLogs[i - 1];
        const gap = log.startedAt - prev.stoppedAt!;
        if (gap >= GAP_THRESHOLD_MS) {
          rows.push({ type: "gap", startMs: prev.stoppedAt!, endMs: log.startedAt, durationMs: gap });
        }
      }

      rows.push({ type: "log", log });
    }
    return { date, totalMs, rows };
  });
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}/${mm}/${dd} (${weekdays[d.getDay()]})`;
}

export function ChronologicalLogView({
  logs,
  metaCache,
  onDeleteWithUndo,
  allLogs,
  onUpdate,
  onAddLog,
  onOpenAddModal,
  onShowToast,
}: ChronologicalLogViewProps) {
  const [drawerLog, setDrawerLog] = useState<TimeLog | null>(null);

  const dateGroups = useMemo(() => buildDateGroups(logs), [logs]);

  const drawerSummary = drawerLog ? logToSummary(drawerLog, metaCache) : null;
  const drawerLogs = drawerLog ? logs.filter((l) => l.taskKey === drawerLog.taskKey) : [];

  if (dateGroups.length === 0) {
    return (
      <div className="text-center text-[#5e6c84] text-xs py-12">
        この期間のログはありません
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        {dateGroups.map((group) => (
          <div key={group.date} className="bg-white border border-[#dfe1e6] rounded-md overflow-hidden">
            {/* 日付ヘッダー */}
            <div className="bg-[#f4f5f7] px-4 py-2 flex items-center justify-between border-b border-[#dfe1e6]">
              <span className="text-[11px] font-semibold text-[#5e6c84]">{formatDate(group.date)}</span>
              <span className="text-[11px] font-semibold text-[#172b4d]">{formatDurationShort(group.totalMs)}</span>
            </div>

            {/* ログ行 */}
            <ul>
              {group.rows.map((row, idx) => {
                if (row.type === "gap") {
                  return (
                    <li
                      key={`gap-${idx}`}
                      onClick={() =>
                        onOpenAddModal({
                          date: group.date,
                          startTime: formatTimeHHMM(row.startMs),
                          endTime: formatTimeHHMM(row.endMs),
                        })
                      }
                      className="flex items-center gap-2 px-4 py-2 bg-[#fffae6] border-l-2 border-[#ffab00] cursor-pointer hover:bg-[#fff0b3] transition-colors"
                    >
                      <span className="text-[11px] text-[#974f0c]">
                        ギャップ: {formatTimeHHMM(row.startMs)}–{formatTimeHHMM(row.endMs)}
                        （{formatDurationShort(row.durationMs)}）
                      </span>
                      <span className="text-[10px] text-[#ffab00] font-semibold ml-auto">＋ 追加</span>
                    </li>
                  );
                }

                const { log } = row;
                return (
                  <li
                    key={log.id}
                    className="flex items-center gap-3 px-4 py-2.5 border-b border-[#f4f5f7] last:border-none hover:bg-[#f8f9fa] transition-colors"
                  >
                    {/* 時刻 */}
                    <span className="text-[11px] tabular-nums text-[#5e6c84] w-24 shrink-0">
                      {formatTimeHHMM(log.startedAt)}–{formatTimeHHMM(log.stoppedAt!)}
                    </span>

                    {/* タスクキー */}
                    <span className="text-[11px] font-bold text-[#0052cc] w-20 shrink-0">{log.taskKey}</span>

                    {/* タイトル */}
                    <span className="text-[11px] text-[#172b4d] flex-1 truncate">
                      {metaCache[log.taskKey]?.taskTitle ?? log.taskTitle}
                    </span>

                    {/* アクティビティバッジ */}
                    <span
                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded text-white shrink-0"
                      style={{ backgroundColor: ACTIVITY_COLORS[log.activityType] }}
                    >
                      {ACTIVITY_LABELS[log.activityType]}
                    </span>

                    {/* 時間 */}
                    <span className="text-[11px] tabular-nums text-[#172b4d] w-12 text-right shrink-0">
                      {formatDurationShort(log.durationMs)}
                    </span>

                    {/* 操作 */}
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => setDrawerLog(log)}
                        className="cursor-pointer border border-[#dfe1e6] rounded px-2 py-1 text-[10px] bg-white text-[#172b4d] hover:bg-[#f4f5f7] transition-colors"
                      >
                        編集
                      </button>
                      <button
                        onClick={() => onDeleteWithUndo(log.id)}
                        className="cursor-pointer border-none rounded px-2 py-1 text-[10px] bg-[#ffebe6] text-[#de350b] hover:bg-[#ffbdad] transition-colors"
                      >
                        削除
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {drawerLog && drawerSummary && (
        <LogEditDrawer
          summary={drawerSummary}
          logs={drawerLogs}
          allLogs={allLogs}
          metaCache={metaCache}
          onDelete={async (logId) => {
            onDeleteWithUndo(logId);
            setDrawerLog(null);
          }}
          onUpdate={async (log) => {
            await onUpdate(log);
            setDrawerLog(null);
          }}
          onAddLog={onAddLog}
          onClose={() => setDrawerLog(null)}
          onShowToast={onShowToast}
        />
      )}
    </>
  );
}
