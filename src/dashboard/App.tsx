import { useDashboard } from "./hooks/useDashboard";
import { DateRangePicker } from "./components/DateRangePicker";
import { TimelineChart } from "./components/TimelineChart";
import { ActivityPieChart } from "./components/ActivityPieChart";
import { TaskRankingTable } from "./components/TaskRankingTable";
import { ExportButton } from "./components/ExportButton";
import { formatDurationShort } from "@/shared/utils/time";
import { ACTIVITY_LABELS, ACTIVITY_COLORS } from "@/shared/types";
import type { ActivityType } from "@/shared/types";

export default function App(): JSX.Element {
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
    deleteLog,
    updateLog,
    loading,
  } = useDashboard();

  const totalMs = (Object.values(activityTotals) as number[]).reduce((a, b) => a + b, 0);

  return (
    <div className="min-h-screen bg-[#f4f5f7]">
      {/* Header */}
      <div className="bg-[#0052cc] text-white px-6 py-4 flex items-center justify-between">
        <span className="text-[16px] font-bold tracking-[0.01em]">TimeRabbit for Jira — ダッシュボード</span>
        <ExportButton logs={filteredLogs} metaCache={metaCache} />
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
          <div className="grid grid-cols-5 gap-3">
            <div className="bg-white border border-[#dfe1e6] rounded-md px-4 py-3">
              <div className="text-[10px] font-semibold text-[#5e6c84] uppercase tracking-wide mb-1">合計</div>
              <div className="text-[18px] font-bold tabular-nums text-[#172b4d]">{formatDurationShort(totalMs)}</div>
            </div>
            {(["design", "implementation", "review", "other"] as const).map((type) => (
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

          {/* Charts */}
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

          {/* Task ranking */}
          <div>
            <div className="text-[11px] font-semibold text-[#5e6c84] uppercase tracking-wide mb-2 px-0.5">
              タスク別ランキング
            </div>
            <TaskRankingTable
              summaries={summaries}
              logs={logs}
              metaCache={metaCache}
              onDeleteLog={deleteLog}
              onUpdateLog={updateLog}
            />
          </div>
        </div>
      )}
    </div>
  );
}
