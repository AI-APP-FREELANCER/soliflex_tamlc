import { useState } from "react";
import { Calendar } from "lucide-react";
import clsx from "clsx";

export interface DateRangeValue {
  range?: string;
  from?: string;
  to?: string;
}

const PRESETS: { value: string; label: string }[] = [
  { value: "", label: "All time" },
  { value: "today", label: "Today" },
  { value: "this_week", label: "This week" },
  { value: "mtd", label: "Month to date" },
  { value: "last_7_days", label: "Last 7 days" },
  { value: "last_30_days", label: "Last 30 days" },
  { value: "custom", label: "Custom range" },
];

/** Reusable date-range quick filter (Today / This week / MTD / custom) used across ticket, audit, and dashboard lists. All ranges are resolved server-side against IST calendar days. */
export function DateRangeFilter({ value, onChange }: { value: DateRangeValue; onChange: (v: DateRangeValue) => void }) {
  const [open, setOpen] = useState(false);
  const activePreset = PRESETS.find((p) => p.value === (value.range ?? ""));

  function selectPreset(preset: string) {
    if (preset === "custom") {
      onChange({ range: "custom", from: value.from, to: value.to });
    } else {
      onChange({ range: preset || undefined, from: undefined, to: undefined });
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-lg border border-soliflex-gray-200 px-3 py-1.5 text-sm text-soliflex-gray-700 hover:bg-soliflex-gray-50"
      >
        <Calendar className="h-3.5 w-3.5 text-soliflex-gray-400" />
        {activePreset?.label ?? "All time"}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-56 rounded-lg border border-soliflex-gray-100 bg-white p-1 shadow-popover">
            {PRESETS.map((p) => (
              <button
                key={p.value}
                onClick={() => selectPreset(p.value)}
                className={clsx(
                  "block w-full rounded-md px-3 py-1.5 text-left text-sm hover:bg-soliflex-gray-50",
                  (value.range ?? "") === p.value ? "font-semibold text-soliflex-orange-600" : "text-soliflex-gray-700"
                )}
              >
                {p.label}
              </button>
            ))}
            {value.range === "custom" && (
              <div className="space-y-2 border-t border-soliflex-gray-100 p-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-soliflex-gray-500">From</label>
                  <input
                    type="date"
                    value={value.from ?? ""}
                    onChange={(e) => onChange({ range: "custom", from: e.target.value || undefined, to: value.to })}
                    className="w-full rounded-md border border-soliflex-gray-200 px-2 py-1 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-soliflex-gray-500">To</label>
                  <input
                    type="date"
                    value={value.to ?? ""}
                    onChange={(e) => onChange({ range: "custom", from: value.from, to: e.target.value || undefined })}
                    className="w-full rounded-md border border-soliflex-gray-200 px-2 py-1 text-sm"
                  />
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="w-full rounded-md bg-soliflex-orange-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-soliflex-orange-600"
                >
                  Apply
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
