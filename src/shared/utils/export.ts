import type { ExportData, JiraTaskMeta, TimeLog } from "../types";

function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportAsJson(logs: TimeLog[], metaCache: Record<string, JiraTaskMeta>): void {
  const relevantMeta = Object.fromEntries(
    logs.flatMap((l) => (metaCache[l.taskKey] ? [[l.taskKey, metaCache[l.taskKey]]] : []))
  );
  const data: ExportData = {
    exportedAt: Date.now(),
    version: chrome.runtime.getManifest().version,
    logs,
    metaCache: relevantMeta,
  };
  downloadFile(JSON.stringify(data, null, 2), "timerabbit-export.json", "application/json");
}

export function exportAsCsv(logs: TimeLog[], metaCache: Record<string, JiraTaskMeta>): void {
  const header = [
    "id", "taskKey", "taskTitle", "projectKey", "activityType",
    "startedAt", "stoppedAt", "durationMs",
    "issueType", "storyPoints", "sprintName", "labels", "fixVersions",
    "parentKey", "parentTitle",
  ].join(",");

  const rows = logs.map((l) => {
    const m = metaCache[l.taskKey];
    return [
      l.id,
      l.taskKey,
      `"${l.taskTitle.replace(/"/g, '""')}"`,
      l.projectKey,
      l.activityType,
      l.startedAt,
      l.stoppedAt ?? "",
      l.durationMs,
      m?.issueType ?? "",
      m?.storyPoints ?? "",
      m?.sprint ? `"${m.sprint.name}"` : "",
      m?.labels.length ? `"${m.labels.join(";")}"` : "",
      m?.fixVersions.length ? `"${m.fixVersions.join(";")}"` : "",
      m?.parentKey ?? "",
      m?.parentTitle ? `"${m.parentTitle.replace(/"/g, '""')}"` : "",
    ].join(",");
  });

  downloadFile([header, ...rows].join("\n"), "timerabbit-export.csv", "text/csv");
}
