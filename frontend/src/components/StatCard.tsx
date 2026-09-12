export function StatCard({ label, value, tone = "default" }: { label: string; value: string | number; tone?: "default" | "warn" | "danger" }) {
  const toneClass = tone === "danger" ? "text-red-600" : tone === "warn" ? "text-amber-600" : "text-soliflex-ink";
  return (
    <div className="rounded-xl border border-soliflex-gray-100 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-soliflex-gray-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${toneClass}`}>{value}</p>
    </div>
  );
}
