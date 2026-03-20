import type { ActivityType } from "@/shared/types";
import { ACTIVITY_LABELS } from "@/shared/types";
import { formatDurationShort } from "@/shared/utils/time";

interface ActivityBreakdownProps {
  byActivity: Record<ActivityType, number>;
}

export function ActivityBreakdown({ byActivity }: ActivityBreakdownProps) {
  const entries = (Object.entries(byActivity) as [ActivityType, number][]).filter(([, ms]) => ms > 0);

  if (entries.length === 0) {
    return <span className="text-[#5e6c84] text-[11px]">記録なし</span>;
  }

  return (
    <ul className="list-none m-0 p-0">
      {entries.map(([type, ms]) => (
        <li key={type} className="flex justify-between text-[11px] text-[#5e6c84] py-px">
          <span>{ACTIVITY_LABELS[type]}</span>
          <span className="tabular-nums">{formatDurationShort(ms)}</span>
        </li>
      ))}
    </ul>
  );
}
