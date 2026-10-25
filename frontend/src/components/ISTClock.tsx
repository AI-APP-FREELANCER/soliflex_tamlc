import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

/** Live IST clock, for reference only (e.g. on the ticket-creation modal). */
export function ISTClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const formatted = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(now);

  return (
    <div className="flex items-center gap-1.5 rounded-lg bg-soliflex-gray-50 px-3 py-1.5 text-xs font-medium text-soliflex-gray-600">
      <Clock className="h-3.5 w-3.5 text-soliflex-gray-400" />
      {formatted} IST
    </div>
  );
}
