import { Loader2 } from "lucide-react";

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center py-10 ${className}`}>
      <Loader2 className="h-6 w-6 animate-spin text-soliflex-orange-500" />
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-soliflex-gray-200 py-14 text-center">
      <p className="text-sm font-medium text-soliflex-gray-600">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-soliflex-gray-400">{description}</p>}
    </div>
  );
}
