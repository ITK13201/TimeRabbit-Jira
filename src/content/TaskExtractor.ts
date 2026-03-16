import type { ExtensionSettings, JiraTaskMeta, JiraSprint } from "@/shared/types";
import { DEFAULT_SETTINGS } from "@/shared/types";
import { STORAGE_KEYS } from "@/shared/utils/storage";

interface JiraIssueFields {
  summary: string;
  issuetype: { name: string };
  labels: string[];
  fixVersions: Array<{ name: string }>;
  parent?: { key: string; fields?: { summary: string } };
  [key: string]: unknown;
}

interface JiraIssueResponse {
  key: string;
  fields: JiraIssueFields;
}

interface SprintField {
  id: number;
  name: string;
  state: "active" | "closed" | "future";
}

export class TaskExtractor {
  private _cache: Record<string, JiraTaskMeta> = {};
  private _inFlight = new Map<string, Promise<JiraTaskMeta>>();

  async resolveTaskMeta(taskKey: string, baseUrl: string): Promise<JiraTaskMeta> {
    const settings = await this._loadSettings();

    // キャッシュチェック
    const cached = this._cache[taskKey];
    if (cached !== undefined) {
      const isExpired = Date.now() - cached.fetchedAt > settings.metaCacheTtlMs;
      if (!isExpired) {
        return cached;
      }
    }

    // storage からキャッシュチェック
    const storedCache = await this._loadStorageCache();
    const storedMeta = storedCache[taskKey];
    if (storedMeta !== undefined) {
      const isExpired = Date.now() - storedMeta.fetchedAt > settings.metaCacheTtlMs;
      if (!isExpired) {
        this._cache[taskKey] = storedMeta;
        return storedMeta;
      }
    }

    // in-flight重複排除
    const inFlight = this._inFlight.get(taskKey);
    if (inFlight !== undefined) {
      return inFlight;
    }

    const fetchPromise = this.fetchTaskMeta(taskKey, baseUrl, settings).then(async (meta) => {
      this._cache[taskKey] = meta;
      await this._saveToStorageCache(taskKey, meta);
      this._inFlight.delete(taskKey);
      return meta;
    }).catch((err: unknown) => {
      this._inFlight.delete(taskKey);
      throw err;
    });

    this._inFlight.set(taskKey, fetchPromise);
    return fetchPromise;
  }

  async fetchTaskMeta(taskKey: string, baseUrl: string, settings: ExtensionSettings): Promise<JiraTaskMeta> {
    const fields = [
      "summary",
      "issuetype",
      "labels",
      settings.storyPointsFieldId,
      settings.sprintFieldId,
      "fixVersions",
      "parent",
    ].join(",");

    const url = `${baseUrl}/rest/api/3/issue/${taskKey}?fields=${fields}`;
    const response = await fetch(url, {
      credentials: "include",
      headers: { "Accept": "application/json" },
    });

    if (!response.ok) {
      throw new Error(`Jira API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as JiraIssueResponse;
    return this.mapToJiraTaskMeta(taskKey, data.fields, settings);
  }

  mapToJiraTaskMeta(taskKey: string, fields: JiraIssueFields, settings: ExtensionSettings): JiraTaskMeta {
    const projectKey = taskKey.split("-")[0];

    // storyPoints
    const storyPointsRaw = fields[settings.storyPointsFieldId];
    const storyPoints = typeof storyPointsRaw === "number" ? storyPointsRaw : null;

    // sprint
    const sprintRaw = fields[settings.sprintFieldId];
    let sprint: JiraSprint | null = null;
    if (Array.isArray(sprintRaw) && sprintRaw.length > 0) {
      const lastSprint = sprintRaw[sprintRaw.length - 1] as SprintField;
      sprint = {
        id: lastSprint.id,
        name: lastSprint.name,
        state: lastSprint.state,
      };
    } else if (sprintRaw !== null && typeof sprintRaw === "object" && !Array.isArray(sprintRaw)) {
      const s = sprintRaw as SprintField;
      sprint = { id: s.id, name: s.name, state: s.state };
    }

    return {
      taskKey,
      taskTitle: fields.summary,
      projectKey,
      issueType: fields.issuetype.name,
      labels: fields.labels ?? [],
      storyPoints,
      sprint,
      fixVersions: (fields.fixVersions ?? []).map((fv) => fv.name),
      parentKey: fields.parent?.key ?? null,
      parentTitle: fields.parent?.fields?.summary ?? null,
      fetchedAt: Date.now(),
    };
  }

  private async _loadSettings(): Promise<ExtensionSettings> {
    const result = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
    const stored = result[STORAGE_KEYS.SETTINGS] as Partial<ExtensionSettings> | undefined;
    return { ...DEFAULT_SETTINGS, ...stored };
  }

  private async _loadStorageCache(): Promise<Record<string, JiraTaskMeta>> {
    const result = await chrome.storage.local.get(STORAGE_KEYS.TASK_META_CACHE);
    return (result[STORAGE_KEYS.TASK_META_CACHE] as Record<string, JiraTaskMeta> | undefined) ?? {};
  }

  private async _saveToStorageCache(taskKey: string, meta: JiraTaskMeta): Promise<void> {
    const cache = await this._loadStorageCache();
    cache[taskKey] = meta;
    await chrome.storage.local.set({ [STORAGE_KEYS.TASK_META_CACHE]: cache });
  }
}
