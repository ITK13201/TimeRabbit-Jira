import { useState } from "react";
import type { ActivityType, JiraTaskMeta, TaskSummary, TimeLog } from "@/shared/types";
import { ACTIVITY_LABELS } from "@/shared/types";
import { formatDateTime, formatDurationShort } from "@/shared/utils/time";

interface LogEditDrawerProps {
  summary: TaskSummary;
  logs: TimeLog[];
  metaCache: Record<string, JiraTaskMeta>;
  onDelete: (logId: string) => Promise<void>;
  onUpdate: (log: TimeLog) => Promise<void>;
  onClose: () => void;
}

function toDatetimeLocal(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function fromDatetimeLocal(value: string): number {
  return new Date(value).getTime();
}

interface EditState {
  startedAt: string;
  stoppedAt: string;
  activityType: ActivityType;
}

export function LogEditDrawer({ summary, logs, metaCache, onDelete, onUpdate, onClose }: LogEditDrawerProps) {
  const taskLogs = logs
    .filter((l) => l.taskKey === summary.taskKey && l.stoppedAt !== null)
    .sort((a, b) => b.startedAt - a.startedAt);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const meta = metaCache[summary.taskKey];
  const handleEditStart = (log: TimeLog): void => {
    setEditingId(log.id);
    setEditState({
      startedAt: toDatetimeLocal(log.startedAt),
      stoppedAt: toDatetimeLocal(log.stoppedAt!),
      activityType: log.activityType,
    });
  };

  const handleEditSave = async (log: TimeLog): Promise<void> => {
    if (!editState) return;
    const startedAt = fromDatetimeLocal(editState.startedAt);
    const stoppedAt = fromDatetimeLocal(editState.stoppedAt);
    if (startedAt >= stoppedAt) return;
    await onUpdate({
      ...log,
      startedAt,
      stoppedAt,
      durationMs: stoppedAt - startedAt,
      activityType: editState.activityType,
    });
    setEditingId(null);
    setEditState(null);
  };

  const handleDeleteConfirm = async (logId: string): Promise<void> => {
    await onDelete(logId);
    setDeletingId(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      {/* Backdrop */}
      <div className="flex-1 bg-black/30" />
      {/* Drawer */}
      <div
        className="w-120 bg-white shadow-xl flex flex-col h-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#dfe1e6]">
          <div>
            <div className="font-bold text-[#0052cc] text-[15px]">{summary.taskKey}</div>
            <div className="text-xs text-[#5e6c84] mt-0.5 truncate max-w-95">
              {meta?.taskTitle ?? summary.taskTitle}
            </div>
          </div>
          <button
            onClick={onClose}
            className="cursor-pointer text-[#5e6c84] hover:text-[#172b4d] text-xl font-bold border-none bg-transparent p-1"
          >
            ×
          </button>
        </div>

        {/* Log list */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {taskLogs.length === 0 ? (
            <div className="text-center text-[#5e6c84] text-xs py-8">ログなし</div>
          ) : (
            <ul className="flex flex-col gap-2">
              {taskLogs.map((log) => (
                <li key={log.id} className="border border-[#dfe1e6] rounded-md p-3">
                  {editingId === log.id && editState !== null ? (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <label className="text-[10px] text-[#5e6c84] w-12 shrink-0">開始</label>
                        <input
                          type="datetime-local"
                          value={editState.startedAt}
                          onChange={(e) => setEditState({ ...editState, startedAt: e.target.value })}
                          className="flex-1 border border-[#dfe1e6] rounded px-2 py-1 text-xs bg-white"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-[10px] text-[#5e6c84] w-12 shrink-0">終了</label>
                        <input
                          type="datetime-local"
                          value={editState.stoppedAt}
                          onChange={(e) => setEditState({ ...editState, stoppedAt: e.target.value })}
                          className="flex-1 border border-[#dfe1e6] rounded px-2 py-1 text-xs bg-white"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-[10px] text-[#5e6c84] w-12 shrink-0">種別</label>
                        <select
                          value={editState.activityType}
                          onChange={(e) => setEditState({ ...editState, activityType: e.target.value as ActivityType })}
                          className="flex-1 border border-[#dfe1e6] rounded px-2 py-1 text-xs bg-white"
                        >
                          {(Object.entries(ACTIVITY_LABELS) as [ActivityType, string][]).map(([type, label]) => (
                            <option key={type} value={type}>{label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex gap-2 justify-end mt-1">
                        <button
                          onClick={() => { setEditingId(null); setEditState(null); }}
                          className="cursor-pointer border border-[#dfe1e6] rounded px-2 py-1 text-xs bg-white text-[#172b4d] hover:bg-[#f4f5f7]"
                        >
                          キャンセル
                        </button>
                        <button
                          onClick={() => { void handleEditSave(log); }}
                          className="cursor-pointer border-none rounded px-2 py-1 text-xs bg-[#0052cc] text-white hover:bg-[#0065ff]"
                        >
                          保存
                        </button>
                      </div>
                    </div>
                  ) : deletingId === log.id ? (
                    <div className="flex flex-col gap-2">
                      <p className="text-xs text-[#172b4d]">このログを削除しますか？</p>
                      <p className="text-[11px] text-[#5e6c84]">
                        {formatDateTime(log.startedAt)} 〜 {formatDateTime(log.stoppedAt!)} ({ACTIVITY_LABELS[log.activityType]})
                      </p>
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => setDeletingId(null)}
                          className="cursor-pointer border border-[#dfe1e6] rounded px-2 py-1 text-xs bg-white text-[#172b4d] hover:bg-[#f4f5f7]"
                        >
                          キャンセル
                        </button>
                        <button
                          onClick={() => { void handleDeleteConfirm(log.id); }}
                          className="cursor-pointer border-none rounded px-2 py-1 text-xs bg-[#de350b] text-white hover:bg-[#ff5630]"
                        >
                          削除
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[11px] text-[#5e6c84]">
                          {formatDateTime(log.startedAt)} 〜 {formatDateTime(log.stoppedAt!)}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] font-semibold text-[#172b4d]">
                            {ACTIVITY_LABELS[log.activityType]}
                          </span>
                          <span className="text-[11px] tabular-nums text-[#172b4d]">
                            {formatDurationShort(log.durationMs)}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => handleEditStart(log)}
                          className="cursor-pointer border border-[#dfe1e6] rounded px-2 py-1 text-[10px] bg-white text-[#172b4d] hover:bg-[#f4f5f7]"
                        >
                          編集
                        </button>
                        <button
                          onClick={() => setDeletingId(log.id)}
                          className="cursor-pointer border-none rounded px-2 py-1 text-[10px] bg-[#ffebe6] text-[#de350b] hover:bg-[#ffbdad]"
                        >
                          削除
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#dfe1e6] bg-[#f4f5f7]">
          <div className="flex justify-between items-center">
            <span className="text-xs text-[#5e6c84]">
              合計: <span className="font-semibold text-[#172b4d]">{formatDurationShort(summary.totalDurationMs)}</span>
            </span>
            <a
              href={`https://atlassian.net/browse/${summary.taskKey}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-[#0052cc] hover:underline"
            >
              Jiraで開く ↗
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
