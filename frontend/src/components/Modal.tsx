import { ReactNode } from "react";
import { X } from "lucide-react";

export function Modal({
  title,
  onClose,
  children,
  width = "max-w-lg",
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  width?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-16">
      <div className={`w-full ${width} rounded-xl bg-white shadow-popover`}>
        <div className="flex items-center justify-between border-b border-soliflex-gray-100 px-5 py-4">
          <h3 className="text-base font-semibold text-soliflex-ink">{title}</h3>
          <button onClick={onClose} className="rounded-md p-1 text-soliflex-gray-400 hover:bg-soliflex-gray-100 hover:text-soliflex-ink">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
