import { useState } from "react";
import { nanoid } from "nanoid";
import type { ActivityType, JiraTaskMeta, TimeLog } from "@/shared/types";
import { ACTIVITY_LABELS } from "@/shared/types";
import { parseDurationText, toDateString } from "@/shared/utils/time";

interface AddLogModalProps {
  metaCache: Record<string, JiraTaskMeta>;
  existingLogs: TimeLog[];
  onSave: (log: TimeLog) => Promise<void>;
  onClose: () => void;
  initialDate?: string;        // "YYYY-MM-DD"
  initialStartTime?: string;   // "HH:MM"
  initialEndTime?: string;     // "HH:MM"
  lockedTaskKey?: string;      // 指定するとタスクキーを固定（タスク詳細から開いた場合）
  lockedTaskTitle?: string;    // lockedTaskKey に対応するタイトル
}

type EndMode = "endTime" | "duration";

interface FormState {
  taskKey: string;
  taskTitle: string;
  taskTitleAutoFilled: boolean;
  activityType: ActivityType;
  date: string;
  startTime: string;
  endMode: EndMode;
  endTime: string;
  durationText: string;
}

interface ValidationErrors {
  taskKey?: string;
  time?: string;
  durationText?: string;
}

function todayString(): string {
  return toDateString(Date.now());
}

export function AddLogModal({
  metaCache,
  existingLogs,
  onSave,
  onClose,
  initialDate,
  initialStartTime,
  initialEndTime,
  lockedTaskKey,
  lockedTaskTitle,
}: AddLogModalProps) {
  const [form, setForm] = useState<FormState>({
    taskKey: lockedTaskKey ?? "",
    taskTitle: lockedTaskTitle ?? "",
    taskTitleAutoFilled: !!lockedTaskTitle,
    activityType: "implementation",
    date: initialDate ?? todayString(),
    startTime: initialStartTime ?? "",
    endMode: "endTime",
    endTime: initialEndTime ?? "",
    durationText: "",
  });
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [overlapWarning, setOverlapWarning] = useState(false);
  const [saving, setSaving] = useState(false);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, taskKey: undefined, time: undefined, durationText: undefined }));
  }

  function handleTaskKeyBlur() {
    const key = form.taskKey.trim().toUpperCase();
    if (!key) return;
    setField("taskKey", key);
    const cached = metaCache[key];
    if (cached) {
      setForm((prev) => ({ ...prev, taskKey: key, taskTitle: cached.taskTitle, taskTitleAutoFilled: true }));
    }
  }

  function computeTimestamps(): { startedAt: number; stoppedAt: number } | null {
    const startMs = new Date(`${form.date}T${form.startTime}`).getTime();
    if (isNaN(startMs)) return null;

    if (form.endMode === "endTime") {
      const endMs = new Date(`${form.date}T${form.endTime}`).getTime();
      if (isNaN(endMs)) return null;
      return { startedAt: startMs, stoppedAt: endMs };
    } else {
      const durationMs = parseDurationText(form.durationText);
      if (durationMs === null) return null;
      return { startedAt: startMs, stoppedAt: startMs + durationMs };
    }
  }

  function checkOverlap(startedAt: number, stoppedAt: number): boolean {
    const dateStr = form.date;
    return existingLogs.some((l) => {
      if (l.stoppedAt === null) return false;
      if (toDateString(l.startedAt) !== dateStr) return false;
      return l.startedAt < stoppedAt && l.stoppedAt > startedAt;
    });
  }

  function validate(): ValidationErrors {
    const errs: ValidationErrors = {};

    if (!form.taskKey.trim()) {
      errs.taskKey = "タスクキーを入力してください";
    }

    const times = computeTimestamps();

    if (form.endMode === "duration" && parseDurationText(form.durationText) === null) {
      errs.durationText = "時間の形式が正しくありません（例: 1h30m）";
    }

    if (!errs.durationText) {
      if (times === null) {
        errs.time = "開始時刻を入力してください";
      } else {
        const { startedAt, stoppedAt } = times;
        if (startedAt >= stoppedAt) {
          errs.time = "開始時刻は終了時刻より前にしてください";
        } else if (toDateString(stoppedAt) !== form.date) {
          errs.time = "日をまたぐ入力はできません";
        } else if (stoppedAt > Date.now()) {
          errs.time = "未来の時刻は指定できません";
        }
      }
    }

    return errs;
  }

  async function handleSave() {
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    const times = computeTimestamps()!;
    const { startedAt, stoppedAt } = times;

    const hasOverlap = checkOverlap(startedAt, stoppedAt);
    setOverlapWarning(hasOverlap);

    const taskKey = form.taskKey.trim().toUpperCase();
    const projectKey = taskKey.split("-")[0];
    const log: TimeLog = {
      id: nanoid(),
      taskKey,
      taskTitle: form.taskTitle.trim() || taskKey,
      projectKey,
      activityType: form.activityType,
      startedAt,
      stoppedAt,
      durationMs: stoppedAt - startedAt,
      syncedAt: null,
    };

    setSaving(true);
    try {
      await onSave(log);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-lg shadow-xl w-[480px] max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#dfe1e6]">
          <span className="text-sm font-bold text-[#172b4d]">ログを手動追加</span>
          <button
            onClick={onClose}
            className="cursor-pointer border-none bg-transparent text-[#5e6c84] hover:text-[#172b4d] text-lg leading-none"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 flex flex-col gap-4 overflow-y-auto">
          {/* Task Key */}
          <div>
            <label className="block text-[11px] font-semibold text-[#5e6c84] uppercase tracking-wide mb-1">
              タスクキー <span className="text-[#de350b]">*</span>
            </label>
            <input
              type="text"
              value={form.taskKey}
              onChange={(e) => setField("taskKey", e.target.value)}
              onBlur={handleTaskKeyBlur}
              placeholder="例: PROJ-123"
              readOnly={!!lockedTaskKey}
              className={`w-full border border-[#dfe1e6] rounded px-3 py-1.5 text-xs focus:outline-none focus:border-[#0052cc] ${lockedTaskKey ? "bg-[#f4f5f7] text-[#5e6c84] cursor-default" : ""}`}
            />
            {errors.taskKey && (
              <p className="text-[11px] text-[#de350b] mt-1">{errors.taskKey}</p>
            )}
          </div>

          {/* Task Title */}
          <div>
            <label className="block text-[11px] font-semibold text-[#5e6c84] uppercase tracking-wide mb-1">
              タスクタイトル
            </label>
            <input
              type="text"
              value={form.taskTitle}
              onChange={(e) => setForm((prev) => ({ ...prev, taskTitle: e.target.value, taskTitleAutoFilled: false }))}
              placeholder={form.taskTitleAutoFilled ? "" : "タイトルを入力（省略可）"}
              className={`w-full border border-[#dfe1e6] rounded px-3 py-1.5 text-xs focus:outline-none focus:border-[#0052cc] ${
                form.taskTitleAutoFilled ? "text-[#5e6c84]" : ""
              }`}
            />
          </div>

          {/* Activity Type */}
          <div>
            <label className="block text-[11px] font-semibold text-[#5e6c84] uppercase tracking-wide mb-1">
              アクティビティ <span className="text-[#de350b]">*</span>
            </label>
            <select
              value={form.activityType}
              onChange={(e) => setField("activityType", e.target.value as ActivityType)}
              className="w-full border border-[#dfe1e6] rounded px-3 py-1.5 text-xs bg-white focus:outline-none focus:border-[#0052cc]"
            >
              {(Object.entries(ACTIVITY_LABELS) as [ActivityType, string][]).map(([type, label]) => (
                <option key={type} value={type}>{label}</option>
              ))}
            </select>
          </div>

          {/* Date */}
          <div>
            <label className="block text-[11px] font-semibold text-[#5e6c84] uppercase tracking-wide mb-1">
              日付 <span className="text-[#de350b]">*</span>
            </label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setField("date", e.target.value)}
              className="w-full border border-[#dfe1e6] rounded px-3 py-1.5 text-xs focus:outline-none focus:border-[#0052cc]"
            />
          </div>

          {/* Start Time */}
          <div>
            <label className="block text-[11px] font-semibold text-[#5e6c84] uppercase tracking-wide mb-1">
              開始時刻 <span className="text-[#de350b]">*</span>
            </label>
            <input
              type="time"
              value={form.startTime}
              onChange={(e) => setField("startTime", e.target.value)}
              className="w-full border border-[#dfe1e6] rounded px-3 py-1.5 text-xs focus:outline-none focus:border-[#0052cc]"
            />
          </div>

          {/* End Time / Duration toggle */}
          <div>
            <div className="flex items-center gap-3 mb-2">
              <label className="block text-[11px] font-semibold text-[#5e6c84] uppercase tracking-wide">
                終了時刻 / 所要時間 <span className="text-[#de350b]">*</span>
              </label>
              <div className="flex rounded border border-[#dfe1e6] overflow-hidden text-[11px]">
                <button
                  type="button"
                  onClick={() => setField("endMode", "endTime")}
                  className={`px-2 py-1 cursor-pointer border-none ${
                    form.endMode === "endTime"
                      ? "bg-[#0052cc] text-white"
                      : "bg-white text-[#5e6c84] hover:bg-[#f4f5f7]"
                  } transition-colors`}
                >
                  終了時刻
                </button>
                <button
                  type="button"
                  onClick={() => setField("endMode", "duration")}
                  className={`px-2 py-1 cursor-pointer border-none border-l border-[#dfe1e6] ${
                    form.endMode === "duration"
                      ? "bg-[#0052cc] text-white"
                      : "bg-white text-[#5e6c84] hover:bg-[#f4f5f7]"
                  } transition-colors`}
                >
                  所要時間
                </button>
              </div>
            </div>

            {form.endMode === "endTime" ? (
              <input
                type="time"
                value={form.endTime}
                onChange={(e) => setField("endTime", e.target.value)}
                className="w-full border border-[#dfe1e6] rounded px-3 py-1.5 text-xs focus:outline-none focus:border-[#0052cc]"
              />
            ) : (
              <input
                type="text"
                value={form.durationText}
                onChange={(e) => setField("durationText", e.target.value)}
                placeholder="例: 1h30m / 90m / 1:30"
                className="w-full border border-[#dfe1e6] rounded px-3 py-1.5 text-xs focus:outline-none focus:border-[#0052cc]"
              />
            )}

            {errors.time && (
              <p className="text-[11px] text-[#de350b] mt-1">{errors.time}</p>
            )}
            {errors.durationText && (
              <p className="text-[11px] text-[#de350b] mt-1">{errors.durationText}</p>
            )}
          </div>

          {/* Overlap warning */}
          {overlapWarning && (
            <div className="text-[11px] text-[#974f0c] bg-[#fffae6] border border-[#ffab00] rounded px-3 py-2">
              同じ日に時間が重複するログがあります。このまま保存できます。
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[#dfe1e6]">
          <button
            onClick={onClose}
            className="cursor-pointer border border-[#dfe1e6] rounded px-4 py-1.5 text-xs font-semibold bg-white text-[#172b4d] hover:bg-[#f4f5f7] transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={() => { void handleSave(); }}
            disabled={saving}
            className="cursor-pointer border-none rounded px-4 py-1.5 text-xs font-semibold bg-[#0052cc] text-white hover:bg-[#0065ff] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}
