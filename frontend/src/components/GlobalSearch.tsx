import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, Loader2 } from "lucide-react";
import { fetchTickets } from "../features/tickets/api";
import { fetchMaintenanceAssets, fetchITAssets } from "../features/assets/api";

const MIN_CHARS = 2;
const MAX_PER_GROUP = 5;

export function GlobalSearch({ className, autoFocus, onNavigate }: { className?: string; autoFocus?: boolean; onNavigate?: () => void }) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const active = debounced.length >= MIN_CHARS;

  const { data: tickets = [], isFetching: ticketsLoading } = useQuery({
    queryKey: ["global-search-tickets", debounced],
    queryFn: () => fetchTickets({ search: debounced }),
    enabled: active,
  });
  const { data: maintenanceAssets = [], isFetching: maintLoading } = useQuery({
    queryKey: ["global-search-maintenance-assets", debounced],
    queryFn: () => fetchMaintenanceAssets(debounced),
    enabled: active,
  });
  const { data: itAssets = [], isFetching: itLoading } = useQuery({
    queryKey: ["global-search-it-assets", debounced],
    queryFn: () => fetchITAssets(debounced),
    enabled: active,
  });

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function go(path: string) {
    setOpen(false);
    setQuery("");
    onNavigate?.();
    navigate(path);
  }

  const loading = ticketsLoading || maintLoading || itLoading;
  const hasResults = tickets.length > 0 || maintenanceAssets.length > 0 || itAssets.length > 0;

  return (
    <div ref={rootRef} className={`relative ${className ?? ""}`}>
      <div className="flex items-center gap-2 rounded-lg bg-soliflex-gray-100 px-3 py-1.5 text-sm text-soliflex-gray-500">
        <Search className="h-4 w-4 shrink-0" />
        <input
          value={query}
          autoFocus={autoFocus}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search tickets, assets..."
          className="w-full bg-transparent text-soliflex-ink placeholder:text-soliflex-gray-500 focus:outline-none"
        />
        {loading && active && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-soliflex-gray-400" />}
      </div>

      {open && active && (
        <div className="absolute left-0 right-0 z-50 mt-1 max-h-96 overflow-y-auto rounded-lg border border-soliflex-gray-100 bg-white shadow-popover">
          {!loading && !hasResults && <p className="px-3 py-3 text-sm text-soliflex-gray-400">No matches for "{debounced}"</p>}

          {tickets.length > 0 && (
            <div className="py-1">
              <p className="px-3 py-1 text-xs font-semibold uppercase text-soliflex-gray-400">Tickets</p>
              {tickets.slice(0, MAX_PER_GROUP).map((t) => (
                <button
                  key={t.id}
                  onClick={() => go(`/tickets/${t.id}`)}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-soliflex-gray-100"
                >
                  <span className="font-semibold text-soliflex-ink">{t.ticketNumber}</span>{" "}
                  <span className="text-soliflex-gray-500">{t.displayTitle}</span>
                </button>
              ))}
            </div>
          )}

          {maintenanceAssets.length > 0 && (
            <div className="border-t border-soliflex-gray-100 py-1">
              <p className="px-3 py-1 text-xs font-semibold uppercase text-soliflex-gray-400">Maintenance assets</p>
              {maintenanceAssets.slice(0, MAX_PER_GROUP).map((a) => (
                <button
                  key={a.id}
                  onClick={() => go(`/assets/maintenance/${a.id}`)}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-soliflex-gray-100"
                >
                  <span className="font-semibold text-soliflex-ink">{a.name}</span>{" "}
                  <span className="text-soliflex-gray-500">({a.itemCode})</span>
                </button>
              ))}
            </div>
          )}

          {itAssets.length > 0 && (
            <div className="border-t border-soliflex-gray-100 py-1">
              <p className="px-3 py-1 text-xs font-semibold uppercase text-soliflex-gray-400">IT assets</p>
              {itAssets.slice(0, MAX_PER_GROUP).map((a) => (
                <button
                  key={a.id}
                  onClick={() => go(`/assets/it/${a.id}`)}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-soliflex-gray-100"
                >
                  <span className="font-semibold text-soliflex-ink">{a.name}</span>{" "}
                  <span className="text-soliflex-gray-500">({a.itemCode})</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
