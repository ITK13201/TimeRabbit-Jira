import { useState } from "react";
import type { JiraTaskMeta, TimeLog } from "@/shared/types";
import { formatDateTime, formatDurationShort } from "@/shared/utils/time";
import { buildJiraUrl } from "@/shared/utils/jira";

interface MetaCacheViewProps {
  metaCache: Record<string, JiraTaskMeta>;
  logs?: TimeLog[];
  jiraBaseUrls?: Record<string, string>;
}

const ISSUE_TYPE_SYMBOL: Record<string, string> = {
  "ストーリー": "📗",
  "Story":      "📗",
  "タスク":     "☑",
  "Task":       "☑",
  "バグ":       "🐛",
  "Bug":        "🐛",
  "問題管理":   "⚠",
  "改善":       "⬆",
  "Epic":       "⚡",
  "エピック":   "⚡",
  "Sub-task":   "↳",
  "サブタスク": "↳",
};

function issueTypeSymbol(type: string): { symbol: string; title: string } {
  return { symbol: ISSUE_TYPE_SYMBOL[type] ?? type.slice(0, 1).toUpperCase(), title: type };
}

type SortKey = "taskKey" | "taskTitle" | "epic" | "issueType" | "storyPoints" | "sprint" | "actualMs" | "fetchedAt";
type SortDir = "asc" | "desc";

function sortEntries(entries: JiraTaskMeta[], key: SortKey, dir: SortDir, actualMs: Record<string, number>): JiraTaskMeta[] {
  const sorted = [...entries].sort((a, b) => {
    let av: string | number | null;
    let bv: string | number | null;
    switch (key) {
      case "taskKey":     av = a.taskKey;                bv = b.taskKey;                break;
      case "taskTitle":   av = a.taskTitle;              bv = b.taskTitle;              break;
      case "epic":        av = a.parentTitle ?? "";      bv = b.parentTitle ?? "";      break;
      case "issueType":   av = a.issueType ?? "";        bv = b.issueType ?? "";        break;
      case "storyPoints": av = a.storyPoints ?? -1;      bv = b.storyPoints ?? -1;      break;
      case "sprint":      av = a.sprint?.name ?? "";     bv = b.sprint?.name ?? "";     break;
      case "actualMs":    av = actualMs[a.taskKey] ?? 0; bv = actualMs[b.taskKey] ?? 0; break;
      case "fetchedAt":   av = a.fetchedAt;              bv = b.fetchedAt;              break;
    }
    if (av === bv) return 0;
    if (av === null || av === "") return 1;
    if (bv === null || bv === "") return -1;
    const cmp = av < bv ? -1 : 1;
    return dir === "asc" ? cmp : -cmp;
  });
  return sorted;
}

export function MetaCacheView({ metaCache, logs, jiraBaseUrls }: MetaCacheViewProps) {
  const [sortKey, setSortKey] = useState<SortKey>("fetchedAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [onlyWorked, setOnlyWorked] = useState(true);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const indicator = (key: SortKey) =>
    sortKey === key ? (sortDir === "asc" ? " ▲" : " ▼") : "";

  const actualMs: Record<string, number> = {};
  for (const log of logs ?? []) {
    actualMs[log.taskKey] = (actualMs[log.taskKey] ?? 0) + log.durationMs;
  }

  const allEntries = Object.values(metaCache);
  const filteredEntries = onlyWorked ? allEntries.filter((m) => (actualMs[m.taskKey] ?? 0) > 0) : allEntries;
  const entries = sortEntries(filteredEntries, sortKey, sortDir, actualMs);

  if (entries.length === 0) {
    return (
      <div className="bg-white border border-[#dfe1e6] rounded-md px-4 py-6 text-center text-xs text-[#5e6c84]">
        キャッシュされたタスクはありません
      </div>
    );
  }

  return (
    <div className="bg-white border border-[#dfe1e6] rounded-md overflow-hidden">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-[#f4f5f7] border-b border-[#dfe1e6]">
            {(
              [
                { key: "taskKey",     label: "タスクキー", align: "left",  cls: "w-40" },
                { key: "taskTitle",   label: "タイトル",   align: "left",  cls: "" },
                { key: "epic",        label: "Epic",       align: "left",  cls: "w-36" },
                { key: "storyPoints", label: "SP",         align: "right", cls: "w-12" },
                { key: "actualMs",    label: "実工数",     align: "right", cls: "w-20" },
              ] as { key: SortKey; label: string; align: string; cls: string }[]
            ).map(({ key, label, align, cls }) => (
              <th
                key={key}
                onClick={() => handleSort(key)}
                className={`px-3 py-2 font-semibold text-[#5e6c84] cursor-pointer select-none hover:text-[#172b4d] text-${align} ${cls}`}
              >
                {label}{indicator(key)}
              </th>
            ))}
            <th
              onClick={() => handleSort("sprint")}
              className="px-3 py-2 font-semibold text-[#5e6c84] cursor-pointer select-none hover:text-[#172b4d] text-left w-36"
            >
              スプリント{indicator("sprint")}
            </th>
            <th
              onClick={() => handleSort("fetchedAt")}
              className="px-3 py-2 font-semibold text-[#5e6c84] cursor-pointer select-none hover:text-[#172b4d] text-right w-32"
            >
              取得日時{indicator("fetchedAt")}
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map((meta) => (
            <tr key={meta.taskKey} className="border-b border-[#f4f5f7] last:border-0 hover:bg-[#f8f9fa]">
              <td className="px-3 py-2.5">
                <div className="flex items-center gap-1.5">
                  {meta.issueType && (
                    <span title={meta.issueType} className="text-sm shrink-0">
                      {issueTypeSymbol(meta.issueType).symbol}
                    </span>
                  )}
                  {jiraBaseUrls && buildJiraUrl(meta.taskKey, jiraBaseUrls) ? (
                    <a
                      href={buildJiraUrl(meta.taskKey, jiraBaseUrls)!}
                      target="_blank"
                      rel="noreferrer"
                      className="font-bold text-[#0052cc] hover:underline"
                    >
                      {meta.taskKey}
                    </a>
                  ) : (
                    <span className="font-bold text-[#0052cc]">{meta.taskKey}</span>
                  )}
                </div>
              </td>
              <td className="px-3 py-2.5 text-[#172b4d] max-w-[320px]">
                <div className="truncate">{meta.taskTitle}</div>
              </td>
              <td className="px-3 py-2.5 text-[#5e6c84] max-w-[144px]">
                <div className="truncate">{meta.parentTitle ?? "—"}</div>
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-[#5e6c84]">
                {meta.storyPoints !== null ? meta.storyPoints : "—"}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-[#5e6c84]">
                {actualMs[meta.taskKey] ? formatDurationShort(actualMs[meta.taskKey]) : "—"}
              </td>
              <td className="px-3 py-2.5 text-[#5e6c84] max-w-[144px]">
                {meta.sprint ? (
                  <div>
                    <div className="truncate">{meta.sprint.name}</div>
                    <div className="text-[10px]">
                      {meta.sprint.state === "active" ? "🟢 進行中" : meta.sprint.state === "future" ? "⏳ 予定" : "✓ 完了"}
                    </div>
                  </div>
                ) : "—"}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-[#5e6c84] w-32">
                {formatDateTime(meta.fetchedAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="px-3 py-2 bg-[#f4f5f7] border-t border-[#dfe1e6] flex items-center justify-between">
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={onlyWorked}
            onChange={(e) => setOnlyWorked(e.target.checked)}
            className="w-3 h-3 accent-[#0052cc]"
          />
          <span className="text-[10px] text-[#5e6c84]">実績あるタスクのみ表示</span>
        </label>
        <span className="text-[10px] text-[#5e6c84]">{entries.length} / {allEntries.length} 件</span>
      </div>
    </div>
  );
}
