export function StatCard({
  label,
  value,
  tone = "default",
  onClick,
}: {
  label: string;
  value: string | number;
  tone?: "default" | "warn" | "danger";
  onClick?: () => void;
}) {
  const toneClass = tone === "danger" ? "text-red-600" : tone === "warn" ? "text-amber-600" : "text-soliflex-ink";
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      className={`rounded-xl border border-soliflex-gray-100 bg-white p-4 text-left ${onClick ? "cursor-pointer transition hover:border-soliflex-orange-200 hover:shadow-sm" : ""}`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-soliflex-gray-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${toneClass}`}>{value}</p>
    </Comp>
  );
}
