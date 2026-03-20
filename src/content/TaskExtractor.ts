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

// ストーリーポイントフィールドとして認識する名前（Jiraインスタンスにより異なる）
const STORY_POINTS_FIELD_NAMES = [
  "Story Points",
  "Story point estimate",
  "Story points",
  "ストーリーポイント",
  "ストーリー ポイント",
];

export class TaskExtractor {
  private _cache: Record<string, JiraTaskMeta> = {};
  private _inFlight = new Map<string, Promise<JiraTaskMeta>>();
  // null=未検出, false=検出試行済みで見つからず, string=検出済みフィールドID
  private _detectedStoryPointsFieldId: string | null | false = null;
  private _detectionPromise: Promise<string | false> | null = null;

  /**
   * セッション初回呼び出し時に /rest/api/3/field でストーリーポイントのフィールドIDを自動検出する。
   * 設定値と異なるIDが見つかった場合は settings を更新し、古いキャッシュを全クリアして再フェッチを強制する。
   */
  private async _ensureFieldIdDetected(baseUrl: string, settings: ExtensionSettings): Promise<void> {
    if (this._detectedStoryPointsFieldId !== null) return;

    if (this._detectionPromise === null) {
      this._detectionPromise = (async (): Promise<string | false> => {
        try {
          const response = await fetch(`${baseUrl}/rest/api/3/field`, {
            credentials: "include",
            headers: { "Accept": "application/json" },
          });
          if (!response.ok) return false;

          const allFields = (await response.json()) as Array<{ id: string; name: string }>;
          const found = allFields.find((f) => STORY_POINTS_FIELD_NAMES.includes(f.name));
          if (!found) return false;

          if (found.id !== settings.storyPointsFieldId) {
            // settingsを更新
            const stored = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
            const existing = stored[STORAGE_KEYS.SETTINGS] as Partial<ExtensionSettings> | undefined;
            await chrome.storage.local.set({
              [STORAGE_KEYS.SETTINGS]: { ...DEFAULT_SETTINGS, ...existing, storyPointsFieldId: found.id },
            });
            // 古いフィールドIDで保存されたキャッシュをクリア（再フェッチを強制）
            await chrome.storage.local.set({ [STORAGE_KEYS.TASK_META_CACHE]: {} });
            this._cache = {};
          }

          return found.id;
        } catch {
          return false;
        }
      })();
    }

    const result = await this._detectionPromise;
    this._detectedStoryPointsFieldId = result;
    this._detectionPromise = null;
  }

  async resolveTaskMeta(taskKey: string, baseUrl: string): Promise<JiraTaskMeta> {
    const settings = await this._loadSettings();

    // キャッシュより先にフィールドID検出（初回のみ実行、キャッシュクリアが必要な場合は行う）
    await this._ensureFieldIdDetected(baseUrl, settings);

    // 検出後のsettingsを再ロード（IDが変わった可能性あり）
    const currentSettings = await this._loadSettings();

    // メモリキャッシュチェック
    const cached = this._cache[taskKey];
    if (cached !== undefined) {
      const isExpired = Date.now() - cached.fetchedAt > currentSettings.metaCacheTtlMs;
      if (!isExpired) {
        return cached;
      }
    }

    // storageキャッシュチェック
    const storedCache = await this._loadStorageCache();
    const storedMeta = storedCache[taskKey];
    if (storedMeta !== undefined) {
      const isExpired = Date.now() - storedMeta.fetchedAt > currentSettings.metaCacheTtlMs;
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

    const fetchPromise = this.fetchTaskMeta(taskKey, baseUrl, currentSettings).then(async (meta) => {
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

    // storyPoints（数値または文字列数値に対応）
    const storyPointsRaw = fields[settings.storyPointsFieldId];
    let storyPoints: number | null = null;
    if (typeof storyPointsRaw === "number") {
      storyPoints = storyPointsRaw;
    } else if (typeof storyPointsRaw === "string" && storyPointsRaw !== "") {
      const parsed = parseFloat(storyPointsRaw);
      if (!isNaN(parsed)) storyPoints = parsed;
    }

    // sprint
    const sprintRaw = fields[settings.sprintFieldId];
    let sprint: JiraSprint | null = null;
    if (Array.isArray(sprintRaw) && sprintRaw.length > 0) {
      const lastSprint = sprintRaw[sprintRaw.length - 1] as SprintField;
      sprint = { id: lastSprint.id, name: lastSprint.name, state: lastSprint.state };
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
