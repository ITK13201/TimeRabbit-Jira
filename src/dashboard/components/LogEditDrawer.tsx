import { useState } from "react";
import { createPortal } from "react-dom";
import type { ActivityType, JiraTaskMeta, TaskSummary, TimeLog } from "@/shared/types";
import { ACTIVITY_LABELS } from "@/shared/types";
import { formatDateTime, formatDurationShort, parseDurationText } from "@/shared/utils/time";
import { buildJiraUrl } from "@/shared/utils/jira";
import { AddLogModal } from "./AddLogModal";

interface LogEditDrawerProps {
  summary: TaskSummary;
  logs: TimeLog[];
  metaCache: Record<string, JiraTaskMeta>;
  allLogs?: TimeLog[];
  jiraBaseUrls?: Record<string, string>;
  onDelete: (logId: string) => Promise<void>;
  onUpdate: (log: TimeLog) => Promise<void>;
  onAddLog?: (log: TimeLog) => Promise<void>;
  onClose: () => void;
  onShowToast?: (message: string, isError?: boolean) => void;
}

function toDatetimeLocal(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function fromDatetimeLocal(value: string): number {
  return new Date(value).getTime();
}

type DurationMode = "endTime" | "duration";

interface EditState {
  startedAt: string;
  stoppedAt: string;
  activityType: ActivityType;
  durationMode: DurationMode;
  durationText: string;
}

export function LogEditDrawer({ summary, logs, metaCache, allLogs, jiraBaseUrls, onDelete, onUpdate, onAddLog, onClose, onShowToast }: LogEditDrawerProps) {
  const taskLogs = logs
    .filter((l) => l.taskKey === summary.taskKey && l.stoppedAt !== null)
    .sort((a, b) => b.startedAt - a.startedAt);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const meta = metaCache[summary.taskKey];

  const handleEditStart = (log: TimeLog): void => {
    setEditingId(log.id);
    setEditError(null);
    setEditState({
      startedAt: toDatetimeLocal(log.startedAt),
      stoppedAt: toDatetimeLocal(log.stoppedAt!),
      activityType: log.activityType,
      durationMode: "endTime",
      durationText: formatDurationShort(log.durationMs),
    });
  };

  const handleEditStateChange = (patch: Partial<EditState>): void => {
    setEditError(null);
    setEditState((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };

      // 終了時刻を変えたら所要時間を追従
      if ("stoppedAt" in patch && next.durationMode === "endTime") {
        const startMs = fromDatetimeLocal(next.startedAt);
        const stopMs = fromDatetimeLocal(next.stoppedAt);
        if (!isNaN(startMs) && !isNaN(stopMs) && stopMs > startMs) {
          next.durationText = formatDurationShort(stopMs - startMs);
        }
      }

      // 所要時間テキストを変えたら終了時刻を追従
      if ("durationText" in patch && next.durationMode === "duration") {
        const durationMs = parseDurationText(next.durationText);
        if (durationMs !== null) {
          const startMs = fromDatetimeLocal(next.startedAt);
          if (!isNaN(startMs)) {
            next.stoppedAt = toDatetimeLocal(startMs + durationMs);
          }
        }
      }

      return next;
    });
  };

  const handleEditSave = async (log: TimeLog): Promise<void> => {
    if (!editState) return;
    const startedAt = fromDatetimeLocal(editState.startedAt);
    const stoppedAt = fromDatetimeLocal(editState.stoppedAt);

    if (startedAt >= stoppedAt) {
      setEditError("開始時刻は終了時刻より前にしてください");
      return;
    }
    if (stoppedAt > Date.now()) {
      setEditError("未来の時刻は指定できません");
      return;
    }

    await onUpdate({
      ...log,
      startedAt,
      stoppedAt,
      durationMs: stoppedAt - startedAt,
      activityType: editState.activityType,
    });
    setEditingId(null);
    setEditState(null);
    setEditError(null);
    onShowToast?.("ログを更新しました");
  };

  const handleDeleteConfirm = async (logId: string): Promise<void> => {
    await onDelete(logId);
    setDeletingId(null);
    onShowToast?.("削除しました");
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop — クリックで閉じる */}
      <div className="flex-1 bg-black/30" onClick={onClose} />
      {/* Drawer */}
      <div
        className="w-120 bg-white shadow-xl flex flex-col h-full overflow-hidden"
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
                          onChange={(e) => handleEditStateChange({ startedAt: e.target.value })}
                          className="flex-1 border border-[#dfe1e6] rounded px-2 py-1 text-xs bg-white"
                        />
                      </div>
                      {/* 終了時刻 / 所要時間 切り替え */}
                      <div className="flex items-center gap-2">
                        <label className="text-[10px] text-[#5e6c84] w-12 shrink-0">
                          {editState.durationMode === "endTime" ? "終了" : "時間"}
                        </label>
                        <div className="flex-1 flex gap-1">
                          {editState.durationMode === "endTime" ? (
                            <input
                              type="datetime-local"
                              value={editState.stoppedAt}
                              onChange={(e) => handleEditStateChange({ stoppedAt: e.target.value })}
                              className="flex-1 border border-[#dfe1e6] rounded px-2 py-1 text-xs bg-white"
                            />
                          ) : (
                            <input
                              type="text"
                              value={editState.durationText}
                              onChange={(e) => handleEditStateChange({ durationText: e.target.value })}
                              placeholder="例: 1h30m"
                              className="flex-1 border border-[#dfe1e6] rounded px-2 py-1 text-xs bg-white"
                            />
                          )}
                          <button
                            type="button"
                            onClick={() => handleEditStateChange({
                              durationMode: editState.durationMode === "endTime" ? "duration" : "endTime",
                            })}
                            className="cursor-pointer border border-[#dfe1e6] rounded px-2 py-1 text-[10px] bg-[#f4f5f7] text-[#5e6c84] hover:bg-[#ebecf0] whitespace-nowrap"
                          >
                            {editState.durationMode === "endTime" ? "時間入力" : "時刻入力"}
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-[10px] text-[#5e6c84] w-12 shrink-0">種別</label>
                        <select
                          value={editState.activityType}
                          onChange={(e) => handleEditStateChange({ activityType: e.target.value as ActivityType })}
                          className="flex-1 border border-[#dfe1e6] rounded px-2 py-1 text-xs bg-white"
                        >
                          {(Object.entries(ACTIVITY_LABELS) as [ActivityType, string][]).map(([type, label]) => (
                            <option key={type} value={type}>{label}</option>
                          ))}
                        </select>
                      </div>
                      {editError && (
                        <p className="text-[11px] text-[#de350b]">{editError}</p>
                      )}
                      <div className="flex gap-2 justify-end mt-1">
                        <button
                          onClick={() => { setEditingId(null); setEditState(null); setEditError(null); }}
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
            <div className="flex items-center gap-3">
              {onAddLog && (
                <button
                  onClick={() => setShowAddModal(true)}
                  className="cursor-pointer border-none bg-transparent text-xs text-[#0052cc] hover:underline font-semibold"
                >
                  ＋ ログを追加
                </button>
              )}
              {jiraBaseUrls && buildJiraUrl(summary.taskKey, jiraBaseUrls) && (
                <a
                  href={buildJiraUrl(summary.taskKey, jiraBaseUrls)!}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-[#0052cc] hover:underline"
                >
                  Jiraで開く ↗
                </a>
              )}
            </div>
          </div>
        </div>

        {showAddModal && onAddLog && createPortal(
          <AddLogModal
            metaCache={metaCache}
            existingLogs={allLogs ?? logs}
            onSave={async (log) => {
              await onAddLog(log);
              onShowToast?.("ログを追加しました");
              setShowAddModal(false);
            }}
            onClose={() => setShowAddModal(false)}
            lockedTaskKey={summary.taskKey}
            lockedTaskTitle={metaCache[summary.taskKey]?.taskTitle ?? summary.taskTitle}
          />,
          document.body,
        )}
      </div>
    </div>
  );
}
