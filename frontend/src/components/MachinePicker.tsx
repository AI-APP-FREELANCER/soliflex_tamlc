import { useEffect, useRef, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Loader2, Search } from "lucide-react";
import { fetchMachinePicker } from "../features/assets/api";
import type { MachineSummary } from "../lib/types";

/**
 * Searchable, paginated "Machine Name" picker for the new-ticket form -
 * loads a page of maintenance assets at a time, fetching more as the
 * dropdown is scrolled rather than pulling the whole asset list at once.
 */
export function MachinePicker({ value, onChange }: { value: MachineSummary | null; onChange: (machine: MachineSummary | null) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  const { data, isLoading, isFetchingNextPage, fetchNextPage, hasNextPage } = useInfiniteQuery({
    queryKey: ["machine-picker", debouncedSearch],
    queryFn: ({ pageParam }) => fetchMachinePicker({ search: debouncedSearch, cursor: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: open,
  });
  const machines = data?.pages.flatMap((p) => p.items) ?? [];

  function onListScroll() {
    const el = listRef.current;
    if (!el || isFetchingNextPage || !hasNextPage) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 60) fetchNextPage();
  }

  return (
    <div ref={containerRef} className="relative">
      <label className="mb-1 block text-sm font-medium text-soliflex-gray-700">Machine Name</label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-soliflex-gray-400" />
        <input
          value={open ? search : value ? `${value.name} (${value.itemCode})` : ""}
          onFocus={() => {
            setOpen(true);
            setSearch("");
          }}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search machine by name or item code"
          className="w-full rounded-lg border border-soliflex-gray-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-soliflex-orange-500"
        />
      </div>

      {open && (
        <div ref={listRef} onScroll={onListScroll} className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-soliflex-gray-100 bg-white shadow-lg">
          {isLoading && (
            <div className="flex items-center justify-center gap-2 py-4 text-xs text-soliflex-gray-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading machines…
            </div>
          )}
          {!isLoading && machines.length === 0 && <p className="px-3 py-3 text-xs text-soliflex-gray-400">No machines found</p>}
          {machines.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                onChange(m);
                setOpen(false);
                setSearch("");
              }}
              className="block w-full px-3 py-2 text-left text-sm hover:bg-soliflex-gray-50"
            >
              <span className="font-medium text-soliflex-ink">{m.name}</span>
              <span className="ml-1.5 text-xs text-soliflex-gray-400">{m.itemCode}</span>
              <div className="text-xs text-soliflex-gray-400">
                {m.category}
                {m.plantLocation ? ` · ${m.plantLocation}` : ""}
              </div>
            </button>
          ))}
          {isFetchingNextPage && (
            <div className="flex items-center justify-center gap-2 py-2 text-xs text-soliflex-gray-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading more…
            </div>
          )}
        </div>
      )}

      {value && !open && (
        <div className="mt-2 rounded-lg bg-soliflex-gray-50 px-3 py-2 text-xs text-soliflex-gray-600">
          <div className="mb-1 font-semibold text-soliflex-gray-500">Machine details</div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
            <span>Category: {value.category}</span>
            {value.model && <span>Model: {value.model}</span>}
            {value.manufacturer && <span>Manufacturer: {value.manufacturer}</span>}
            {value.powerCapacity && <span>Power capacity: {value.powerCapacity}</span>}
            {value.plantLocation && <span>Location: {value.plantLocation}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
