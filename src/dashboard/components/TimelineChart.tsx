import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { DailyTotal } from "@/shared/types";
import { ACTIVITY_LABELS, ACTIVITY_COLORS } from "@/shared/types";
import { formatDurationShort } from "@/shared/utils/time";

interface TimelineChartProps {
  dailyTotals: DailyTotal[];
}

interface TooltipPayloadItem {
  name: string;
  value: number;
  fill: string;
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-white border border-[#dfe1e6] rounded-md px-3 py-2 shadow-sm text-xs">
      <div className="font-semibold text-[#172b4d] mb-1">{label}</div>
      {payload.map((item) => (
        <div key={item.name} className="flex justify-between gap-4" style={{ color: item.fill }}>
          <span>{item.name}</span>
          <span className="tabular-nums font-semibold">{formatDurationShort(item.value)}</span>
        </div>
      ))}
    </div>
  );
}

function formatYAxis(ms: number): string {
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  if (hours > 0) return `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  return "0";
}

function formatXAxisDate(date: string): string {
  const [, mm, dd] = date.split("-");
  return `${mm}/${dd}`;
}

export function TimelineChart({ dailyTotals }: TimelineChartProps) {
  if (dailyTotals.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-[#5e6c84] text-xs">
        データなし
      </div>
    );
  }

  const data = dailyTotals.map((d) => ({
    date: d.date,
    design: d.byActivity.design,
    implementation: d.byActivity.implementation,
    review: d.byActivity.review,
    other: d.byActivity.other,
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f4f5f7" />
        <XAxis
          dataKey="date"
          tickFormatter={formatXAxisDate}
          tick={{ fontSize: 10, fill: "#5e6c84" }}
        />
        <YAxis
          tickFormatter={formatYAxis}
          tick={{ fontSize: 10, fill: "#5e6c84" }}
          width={36}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          formatter={(value: string) => (
            <span className="text-xs text-[#5e6c84]">
              {ACTIVITY_LABELS[value as keyof typeof ACTIVITY_LABELS] ?? value}
            </span>
          )}
        />
        {(["design", "implementation", "review", "review_response", "other"] as const).map((type) => (
          <Bar key={type} dataKey={type} stackId="a" fill={ACTIVITY_COLORS[type]} name={ACTIVITY_LABELS[type]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
