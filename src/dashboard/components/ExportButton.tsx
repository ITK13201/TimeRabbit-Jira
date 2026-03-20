import type { JiraTaskMeta, TimeLog } from "@/shared/types";
import { exportAsJson, exportAsCsv } from "@/shared/utils/export";

interface ExportButtonProps {
  logs: TimeLog[];
  metaCache: Record<string, JiraTaskMeta>;
}

export function ExportButton({ logs, metaCache }: ExportButtonProps) {
  return (
    <div className="flex gap-2">
      <button
        onClick={() => exportAsJson(logs, metaCache)}
        className="cursor-pointer border border-[#dfe1e6] rounded px-3 py-1.5 text-xs font-semibold bg-white text-[#172b4d] hover:bg-[#f4f5f7] transition-colors"
      >
        JSONエクスポート
      </button>
      <button
        onClick={() => exportAsCsv(logs, metaCache)}
        className="cursor-pointer border border-[#dfe1e6] rounded px-3 py-1.5 text-xs font-semibold bg-white text-[#172b4d] hover:bg-[#f4f5f7] transition-colors"
      >
        CSVエクスポート
      </button>
    </div>
  );
}
