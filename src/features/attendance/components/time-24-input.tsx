"use client";

import { cn } from "@/lib/utils";

const HOURS = Array.from({ length: 24 }, (_, i) =>
  String(i).padStart(2, "0"),
);
const MINUTES = Array.from({ length: 60 }, (_, i) =>
  String(i).padStart(2, "0"),
);

const selectClassName =
  "border-input bg-background h-9 rounded-md border px-2 text-sm tabular-nums";

type Time24InputProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  "aria-label"?: string;
  className?: string;
};

function parseTime(value: string): { hour: string; minute: string } {
  const match = /^(\d{2}):(\d{2})/.exec(value);
  if (!match) return { hour: "08", minute: "00" };
  return { hour: match[1], minute: match[2] };
}

/** Always displays and edits time as 24-hour HH:mm (no AM/PM). */
export function Time24Input({
  id,
  value,
  onChange,
  required,
  disabled,
  "aria-label": ariaLabel,
  className,
}: Time24InputProps) {
  const { hour, minute } = parseTime(value);

  function emit(nextHour: string, nextMinute: string) {
    onChange(`${nextHour}:${nextMinute}`);
  }

  return (
    <div
      className={cn("flex items-center gap-1", className)}
      role="group"
      aria-label={ariaLabel}
      dir="ltr"
    >
      <select
        id={id}
        className={cn(selectClassName, "min-w-[4.5rem] flex-1")}
        value={hour}
        onChange={(e) => emit(e.target.value, minute)}
        required={required}
        disabled={disabled}
      >
        {HOURS.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
      <span className="text-muted-foreground tabular-nums" aria-hidden>
        :
      </span>
      <select
        className={cn(selectClassName, "min-w-[4.5rem] flex-1")}
        value={minute}
        onChange={(e) => emit(hour, e.target.value)}
        required={required}
        disabled={disabled}
      >
        {MINUTES.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
    </div>
  );
}
