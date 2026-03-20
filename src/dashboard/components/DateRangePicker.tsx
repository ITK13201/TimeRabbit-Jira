import { useState } from "react";
import type { DateRangePreset } from "../hooks/useDashboard";
import { getPresetRange } from "../hooks/useDashboard";

interface DateRangePickerProps {
  preset: DateRangePreset;
  dateRange: { from: number; to: number };
  onPresetChange: (preset: DateRangePreset, customRange?: { from: number; to: number }) => void;
}

const PRESETS: { value: DateRangePreset; label: string }[] = [
  { value: "today", label: "今日" },
  { value: "thisWeek", label: "今週" },
  { value: "lastWeek", label: "先週" },
  { value: "thisMonth", label: "今月" },
  { value: "custom", label: "カスタム" },
];

function toDateInput(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fromDateInput(value: string, endOfDay = false): number {
  const d = new Date(value);
  if (endOfDay) d.setHours(23, 59, 59, 999);
  else d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function DateRangePicker({ preset, dateRange, onPresetChange }: DateRangePickerProps): JSX.Element {
  const [customFrom, setCustomFrom] = useState(() => toDateInput(dateRange.from));
  const [customTo, setCustomTo] = useState(() => toDateInput(dateRange.to));

  const handlePreset = (value: DateRangePreset): void => {
    if (value === "custom") {
      onPresetChange("custom", { from: fromDateInput(customFrom), to: fromDateInput(customTo, true) });
    } else {
      onPresetChange(value);
    }
  };

  const handleCustomApply = (): void => {
    onPresetChange("custom", { from: fromDateInput(customFrom), to: fromDateInput(customTo, true) });
  };

  const displayRange = (p: DateRangePreset): string => {
    const r = p === "custom" ? { from: fromDateInput(customFrom), to: fromDateInput(customTo, true) } : getPresetRange(p);
    return `${toDateInput(r.from)} 〜 ${toDateInput(r.to)}`;
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex gap-1">
        {PRESETS.map((p) => (
          <button
            key={p.value}
            onClick={() => handlePreset(p.value)}
            className={`cursor-pointer px-3 py-1 rounded text-xs font-semibold border transition-colors ${
              preset === p.value
                ? "bg-[#0052cc] text-white border-[#0052cc]"
                : "bg-white text-[#172b4d] border-[#dfe1e6] hover:bg-[#f4f5f7]"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      {preset === "custom" ? (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
            className="border border-[#dfe1e6] rounded px-2 py-1 text-xs bg-white"
          />
          <span className="text-[#5e6c84] text-xs">〜</span>
          <input
            type="date"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            className="border border-[#dfe1e6] rounded px-2 py-1 text-xs bg-white"
          />
          <button
            onClick={handleCustomApply}
            className="cursor-pointer px-3 py-1 rounded text-xs font-semibold bg-[#0052cc] text-white border-none hover:bg-[#0065ff] transition-colors"
          >
            適用
          </button>
        </div>
      ) : (
        <span className="text-xs text-[#5e6c84]">{displayRange(preset)}</span>
      )}
    </div>
  );
}
