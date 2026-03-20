import type { ActivityType } from "@/shared/types";
import { ACTIVITY_LABELS } from "@/shared/types";

interface ActivitySelectorProps {
  value: ActivityType;
  onChange: (value: ActivityType) => void;
  disabled?: boolean;
}

export function ActivitySelector({ value, onChange, disabled = false }: ActivitySelectorProps): JSX.Element {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as ActivityType)}
      disabled={disabled}
      className="w-full px-1.5 py-1 border border-[#dfe1e6] rounded text-xs bg-[#fafbfc] cursor-pointer font-[inherit] disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {(Object.entries(ACTIVITY_LABELS) as [ActivityType, string][]).map(([type, label]) => (
        <option key={type} value={type}>
          {label}
        </option>
      ))}
    </select>
  );
}
