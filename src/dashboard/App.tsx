import { useState } from "react";
import { useDashboard } from "./hooks/useDashboard";
import { DateRangePicker } from "./components/DateRangePicker";
import { TimelineChart } from "./components/TimelineChart";
import { ActivityPieChart } from "./components/ActivityPieChart";
import { TaskRankingTable } from "./components/TaskRankingTable";
import { ExportButton } from "./components/ExportButton";
import { AddLogModal } from "./components/AddLogModal";
import { ToastContainer } from "./components/ToastContainer";
import { ChronologicalLogView } from "./components/ChronologicalLogView";
import { MetaCacheView } from "./components/MetaCacheView";
import { SettingsPanel } from "./components/SettingsPanel";
import { formatDurationShort } from "@/shared/utils/time";
import { useToast } from "@/shared/utils/useToast";
import { ACTIVITY_LABELS, ACTIVITY_COLORS } from "@/shared/types";
import type { ActivityType, TimeLog } from "@/shared/types";

type TabKey = "task" | "timeline" | "cache" | "settings";

export default function App() {
  const {
    logs,
    filteredLogs,
    metaCache,
    filter,
    setFilter,
    preset,
    setPreset,
    summaries,
    dailyTotals,
    activityTotals,
    addLog,
    deleteLog,
    undoDelete,
    updateLog,
    settings,
    saveSettings,
    loading,
  } = useDashboard();

  const { toasts, showToast, dismissToast } = useToast();
  const [activeTab, setActiveTab] = useState<TabKey>("task");
  const [showAddModal, setShowAddModal] = useState(false);
  const [addModalPreset, setAddModalPreset] = useState<{
    date?: string;
    startTime?: string;
    endTime?: string;
  }>({});

  const handleAddLog = async (log: TimeLog): Promise<void> => {
    await addLog(log);
    showToast("ログを追加しました");
  };

  function openAddModal(preset?: { date?: string; startTime?: string; endTime?: string }) {
    setAddModalPreset(preset ?? {});
    setShowAddModal(true);
  }

  const handleDeleteWithUndo = (logId: string): void => {
    void deleteLog(logId, { withUndo: true });
    const toastId = showToast("削除しました", {
      durationMs: 5000,
      action: {
        label: "元に戻す",
        onClick: () => {
          undoDelete(logId);
          dismissToast(toastId);
        },
      },
    });
  };

  const totalMs = (Object.values(activityTotals) as number[]).reduce((a, b) => a + b, 0);

  return (
    <div className="min-h-screen bg-[#f4f5f7]">
      {/* Header */}
      <div className="bg-[#0052cc] text-white px-6 py-4 flex items-center justify-between">
        <span className="text-[16px] font-bold tracking-[0.01em]">TimeRabbit for Jira — ダッシュボード</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => openAddModal()}
            className="cursor-pointer border border-white/40 rounded px-3 py-1.5 text-xs font-semibold bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            ＋ ログを追加
          </button>
          <ExportButton logs={filteredLogs} metaCache={metaCache} />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 text-[#5e6c84] text-xs">
          読み込み中...
        </div>
      ) : (
        <div className="max-w-5xl mx-auto p-5 flex flex-col gap-4">
          {/* Filter bar */}
          <div className="bg-white border border-[#dfe1e6] rounded-md px-4 py-3">
            <div className="flex flex-wrap items-center gap-4">
              <DateRangePicker
                preset={preset}
                dateRange={filter.dateRange}
                onPresetChange={setPreset}
              />
              <div className="flex items-center gap-2 ml-auto">
                <span className="text-[11px] text-[#5e6c84]">プロジェクト:</span>
                <select
                  value={filter.projectKeys[0] ?? ""}
                  onChange={(e) => setFilter({ ...filter, projectKeys: e.target.value ? [e.target.value] : [] })}
                  className="border border-[#dfe1e6] rounded px-2 py-1 text-xs bg-white"
                >
                  <option value="">すべて</option>
                  {[...new Set(logs.map((l) => l.projectKey))].sort().map((pk) => (
                    <option key={pk} value={pk}>{pk}</option>
                  ))}
                </select>
                <span className="text-[11px] text-[#5e6c84]">アクティビティ:</span>
                <select
                  value={filter.activityTypes[0] ?? ""}
                  onChange={(e) => setFilter({ ...filter, activityTypes: e.target.value ? [e.target.value as ActivityType] : [] })}
                  className="border border-[#dfe1e6] rounded px-2 py-1 text-xs bg-white"
                >
                  <option value="">すべて</option>
                  {(Object.entries(ACTIVITY_LABELS) as [ActivityType, string][]).map(([type, label]) => (
                    <option key={type} value={type}>{label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-6 gap-3">
            <div className="bg-white border border-[#dfe1e6] rounded-md px-4 py-3">
              <div className="text-[10px] font-semibold text-[#5e6c84] uppercase tracking-wide mb-1">合計</div>
              <div className="text-[18px] font-bold tabular-nums text-[#172b4d]">{formatDurationShort(totalMs)}</div>
            </div>
            {(["design", "implementation", "review", "review_response", "other"] as const).map((type) => (
              <div key={type} className="bg-white border border-[#dfe1e6] rounded-md px-4 py-3">
                <div
                  className="text-[10px] font-semibold uppercase tracking-wide mb-1"
                  style={{ color: ACTIVITY_COLORS[type] }}
                >
                  {ACTIVITY_LABELS[type]}
                </div>
                <div className="text-[18px] font-bold tabular-nums text-[#172b4d]">
                  {formatDurationShort(activityTotals[type])}
                </div>
              </div>
            ))}
          </div>

          {/* Charts（タスク軸のみ表示） */}
          {activeTab === "task" && (
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white border border-[#dfe1e6] rounded-md px-4 py-3">
                <div className="text-[11px] font-semibold text-[#5e6c84] uppercase tracking-wide mb-3">
                  日別タイムライン
                </div>
                <TimelineChart dailyTotals={dailyTotals} />
              </div>
              <div className="bg-white border border-[#dfe1e6] rounded-md px-4 py-3">
                <div className="text-[11px] font-semibold text-[#5e6c84] uppercase tracking-wide mb-3">
                  アクティビティ内訳
                </div>
                <ActivityPieChart activityTotals={activityTotals} />
              </div>
            </div>
          )}

          {/* タブ */}
          <div>
            <div className="flex gap-1 border-b border-[#dfe1e6] bg-white px-4 rounded-t-md">
              {([
                { key: "task", label: "タスク軸" },
                { key: "timeline", label: "時間軸" },
                { key: "cache", label: "タスクキャッシュ" },
                { key: "settings", label: "設定" },
              ] as { key: TabKey; label: string }[]).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`cursor-pointer border-none bg-transparent px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
                    activeTab === tab.key
                      ? "border-[#0052cc] text-[#0052cc]"
                      : "border-transparent text-[#5e6c84] hover:text-[#172b4d]"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === "task" && (
              <TaskRankingTable
                summaries={summaries}
                logs={logs}
                metaCache={metaCache}
                jiraBaseUrls={settings.jiraBaseUrls}
                onDeleteLog={deleteLog}
                onUpdateLog={updateLog}
                onAddLog={addLog}
              />
            )}

            {activeTab === "timeline" && (
              <div className="mt-3">
                <ChronologicalLogView
                  logs={filteredLogs}
                  allLogs={logs}
                  metaCache={metaCache}
                  onDeleteWithUndo={handleDeleteWithUndo}
                  onUpdate={updateLog}
                  onAddLog={addLog}
                  onOpenAddModal={openAddModal}
                  onShowToast={(msg) => showToast(msg)}
                />
              </div>
            )}

            {activeTab === "cache" && (
              <div className="mt-3">
                <MetaCacheView metaCache={metaCache} logs={logs} jiraBaseUrls={settings.jiraBaseUrls} />
              </div>
            )}

            {activeTab === "settings" && (
              <div className="mt-3">
                <SettingsPanel settings={settings} onSave={saveSettings} />
              </div>
            )}
          </div>
        </div>
      )}

      {showAddModal && (
        <AddLogModal
          metaCache={metaCache}
          existingLogs={logs}
          onSave={handleAddLog}
          onClose={() => setShowAddModal(false)}
          initialDate={addModalPreset.date}
          initialStartTime={addModalPreset.startTime}
          initialEndTime={addModalPreset.endTime}
        />
      )}

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
