import type { ActivityType } from "@/shared/types";
import { ACTIVITY_LABELS } from "@/shared/types";
import { formatDurationShort } from "@/shared/utils/time";

interface ActivityBreakdownProps {
  byActivity: Record<ActivityType, number>;
}

export function ActivityBreakdown({ byActivity }: ActivityBreakdownProps): JSX.Element {
  const entries = (Object.entries(byActivity) as [ActivityType, number][]).filter(([, ms]) => ms > 0);

  if (entries.length === 0) {
    return <span style={{ color: "#5e6c84", fontSize: "11px" }}>記録なし</span>;
  }

  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {entries.map(([type, ms]) => (
        <li
          key={type}
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "11px",
            color: "#5e6c84",
            padding: "1px 0",
          }}
        >
          <span>{ACTIVITY_LABELS[type]}</span>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>{formatDurationShort(ms)}</span>
        </li>
      ))}
    </ul>
  );
}
