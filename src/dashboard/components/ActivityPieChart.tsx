import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { ActivityType } from "@/shared/types";
import { ACTIVITY_LABELS, ACTIVITY_COLORS } from "@/shared/types";
import { formatDurationShort } from "@/shared/utils/time";

interface ActivityPieChartProps {
  activityTotals: Record<ActivityType, number>;
}

interface TooltipPayloadItem {
  name: string;
  value: number;
}

function CustomTooltip({ active, payload }: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
}): JSX.Element | null {
  if (!active || !payload?.length) return null;
  const item = payload[0];

  return (
    <div className="bg-white border border-[#dfe1e6] rounded-md px-3 py-2 shadow-sm text-xs">
      <div className="font-semibold text-[#172b4d]">{item.name}</div>
      <div className="tabular-nums">{formatDurationShort(item.value)}</div>
    </div>
  );
}

export function ActivityPieChart({ activityTotals }: ActivityPieChartProps): JSX.Element {
  const data = (Object.entries(activityTotals) as [ActivityType, number][])
    .filter(([, ms]) => ms > 0)
    .map(([type, ms]) => ({
      name: ACTIVITY_LABELS[type],
      value: ms,
      color: ACTIVITY_COLORS[type],
    }));

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-[#5e6c84] text-xs">
        データなし
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="45%"
          innerRadius={50}
          outerRadius={80}
          paddingAngle={2}
          dataKey="value"
        >
          {data.map((entry, index) => (
            <Cell key={index} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend
          formatter={(value: string) => (
            <span className="text-xs text-[#5e6c84]">{value}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
