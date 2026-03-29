/** ミリ秒を "1h 23m 45s" 形式にフォーマット */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

/** ミリ秒を "00:23:45" 形式にフォーマット */
export function formatDurationClock(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((v) => String(v).padStart(2, "0")).join(":");
}

/** ミリ秒を "2h 30m" 形式（秒なし）にフォーマット */
export function formatDurationShort(ms: number): string {
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  return "0m";
}

/** Unix timestamp (ms) を "03/16 10:00" 形式にフォーマット */
export function formatDateTime(ts: number): string {
  const d = new Date(ts);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${mm}/${dd} ${hh}:${min}`;
}

/** 日付文字列 "2026-03-16" を生成 */
export function toDateString(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Unix timestamp (ms) を "HH:MM" 形式にフォーマット */
export function formatTimeHHMM(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * 時間テキストをミリ秒に変換。解析できない場合は null を返す。
 * 対応フォーマット: "1h30m" / "1h 30m" / "90m" / "2h" / "1:30" / "1:30:00" / "30"（分として解釈）
 */
export function parseDurationText(input: string): number | null {
  const s = input.trim().toLowerCase();
  if (!s) return null;

  // "1h30m" or "1h 30m"
  const hm = s.match(/^(\d+)h\s*(\d+)m$/);
  if (hm) {
    const ms = (parseInt(hm[1]) * 60 + parseInt(hm[2])) * 60000;
    return ms > 0 ? ms : null;
  }

  // "2h"
  const h = s.match(/^(\d+)h$/);
  if (h) {
    const ms = parseInt(h[1]) * 3600000;
    return ms > 0 ? ms : null;
  }

  // "90m"
  const m = s.match(/^(\d+)m$/);
  if (m) {
    const ms = parseInt(m[1]) * 60000;
    return ms > 0 ? ms : null;
  }

  // "1:30:00"
  const hms = s.match(/^(\d+):(\d{2}):(\d{2})$/);
  if (hms) {
    const ms = (parseInt(hms[1]) * 3600 + parseInt(hms[2]) * 60 + parseInt(hms[3])) * 1000;
    return ms > 0 ? ms : null;
  }

  // "1:30"
  const hmColon = s.match(/^(\d+):(\d{2})$/);
  if (hmColon) {
    const ms = (parseInt(hmColon[1]) * 60 + parseInt(hmColon[2])) * 60000;
    return ms > 0 ? ms : null;
  }

  // "30" — 分として解釈
  const bare = s.match(/^(\d+)$/);
  if (bare) {
    const ms = parseInt(bare[1]) * 60000;
    return ms > 0 ? ms : null;
  }

  return null;
}
