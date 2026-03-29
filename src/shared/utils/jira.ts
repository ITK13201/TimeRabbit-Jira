/**
 * タスクキーからプロジェクトキー（ハイフン前の部分）を返す
 * 例: "PROJ-123" → "PROJ"
 */
export function extractProjectKey(taskKey: string): string {
  return taskKey.split("-")[0];
}

/**
 * 設定されたJiraベースURLマッピングからタスクのURLを生成する
 * プロジェクトキーが未登録の場合は null を返す
 */
export function buildJiraUrl(taskKey: string, jiraBaseUrls: Record<string, string>): string | null {
  const projectKey = extractProjectKey(taskKey);
  const base = jiraBaseUrls[projectKey];
  if (!base) return null;
  return `${base.replace(/\/$/, "")}/browse/${taskKey}`;
}
