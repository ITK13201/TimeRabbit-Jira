import { useState } from "react";
import type { ExtensionSettings } from "@/shared/types";

interface SettingsPanelProps {
  settings: ExtensionSettings;
  onSave: (settings: ExtensionSettings) => Promise<void>;
}

interface UrlRow {
  projectKey: string;
  baseUrl: string;
}

function toRows(jiraBaseUrls: Record<string, string>): UrlRow[] {
  return Object.entries(jiraBaseUrls).map(([projectKey, baseUrl]) => ({ projectKey, baseUrl }));
}

function toRecord(rows: UrlRow[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const row of rows) {
    const key = row.projectKey.trim().toUpperCase();
    const url = row.baseUrl.trim().replace(/\/$/, "");
    if (key && url) result[key] = url;
  }
  return result;
}

export function SettingsPanel({ settings, onSave }: SettingsPanelProps) {
  const [rows, setRows] = useState<UrlRow[]>(() => toRows(settings.jiraBaseUrls));
  const [showFloatingTimer, setShowFloatingTimer] = useState(settings.showFloatingTimer);
  const [floatingTimerCollapseToCorner, setFloatingTimerCollapseToCorner] = useState(settings.floatingTimerCollapseToCorner);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave({ ...settings, jiraBaseUrls: toRecord(rows), showFloatingTimer, floatingTimerCollapseToCorner });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const updateRow = (index: number, patch: Partial<UrlRow>) => {
    setSaved(false);
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  };

  const removeRow = (index: number) => {
    setSaved(false);
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  const addRow = () => {
    setSaved(false);
    setRows((prev) => [...prev, { projectKey: "", baseUrl: "" }]);
  };

  return (
    <div className="bg-white border border-[#dfe1e6] rounded-md px-5 py-4 flex flex-col gap-4">
      <div>
        <div className="text-[11px] font-semibold text-[#5e6c84] uppercase tracking-wide mb-2">
          Jira ベース URL
        </div>
        <p className="text-[11px] text-[#5e6c84] mb-3">
          プロジェクトキー（タスクキーのハイフン前）ごとに Jira インスタンスの URL を登録します。
          「Jiraで開く」リンクの生成に使用します。
        </p>

        <div className="flex flex-col gap-2">
          {rows.length > 0 && (
            <div className="grid grid-cols-[160px_1fr_32px] gap-2 text-[10px] font-semibold text-[#5e6c84] uppercase tracking-wide px-1">
              <span>プロジェクトキー</span>
              <span>ベース URL</span>
              <span />
            </div>
          )}

          {rows.map((row, i) => (
            <div key={i} className="grid grid-cols-[160px_1fr_32px] gap-2 items-center">
              <input
                type="text"
                value={row.projectKey}
                onChange={(e) => updateRow(i, { projectKey: e.target.value })}
                placeholder="例: PROJ"
                className="border border-[#dfe1e6] rounded px-2 py-1.5 text-xs focus:outline-none focus:border-[#0052cc] font-mono uppercase"
              />
              <input
                type="url"
                value={row.baseUrl}
                onChange={(e) => updateRow(i, { baseUrl: e.target.value })}
                placeholder="https://yourorg.atlassian.net"
                className="border border-[#dfe1e6] rounded px-2 py-1.5 text-xs focus:outline-none focus:border-[#0052cc]"
              />
              <button
                onClick={() => removeRow(i)}
                className="cursor-pointer border-none bg-transparent text-[#5e6c84] hover:text-[#de350b] text-sm leading-none"
                title="削除"
              >
                ✕
              </button>
            </div>
          ))}

          <button
            onClick={addRow}
            className="cursor-pointer border border-dashed border-[#dfe1e6] rounded px-3 py-1.5 text-xs text-[#5e6c84] hover:border-[#0052cc] hover:text-[#0052cc] transition-colors w-fit"
          >
            ＋ 追加
          </button>
        </div>
      </div>

      <div>
        <div className="text-[11px] font-semibold text-[#5e6c84] uppercase tracking-wide mb-2">
          フローティングウィジェット
        </div>
        <label className="flex items-center gap-2 cursor-pointer w-fit">
          <input
            type="checkbox"
            checked={showFloatingTimer}
            onChange={(e) => { setShowFloatingTimer(e.target.checked); setSaved(false); }}
            className="w-3.5 h-3.5 accent-[#0052cc]"
          />
          <span className="text-xs text-[#172b4d]">Jira ページに右下のタイマーカードを表示する</span>
        </label>
        {showFloatingTimer && (
          <label className="mt-1 ml-5 flex items-center gap-2 cursor-pointer w-fit">
            <input
              type="checkbox"
              checked={floatingTimerCollapseToCorner}
              onChange={(e) => { setFloatingTimerCollapseToCorner(e.target.checked); setSaved(false); }}
              className="w-3.5 h-3.5 accent-[#0052cc]"
            />
            <span className="text-xs text-[#172b4d]">最小化時に画面右下へ移動する</span>
          </label>
        )}
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => { void handleSave(); }}
          disabled={saving}
          className="cursor-pointer border-none rounded px-4 py-1.5 text-xs font-semibold bg-[#0052cc] text-white hover:bg-[#0065ff] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? "保存中..." : saved ? "保存しました ✓" : "保存"}
        </button>
      </div>
    </div>
  );
}
