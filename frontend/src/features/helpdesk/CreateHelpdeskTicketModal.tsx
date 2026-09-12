import { useState } from "react";
import { Modal } from "../../components/Modal";
import { useHelpdeskMutations } from "./hooks";
import { HELPDESK_CATEGORY_LABELS } from "./badges";
import type { CreateHelpdeskTicketInput } from "./api";
import type { HelpdeskCategory } from "../../lib/types";

const CATEGORIES = Object.keys(HELPDESK_CATEGORY_LABELS) as HelpdeskCategory[];

export function CreateHelpdeskTicketModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState<CreateHelpdeskTicketInput>({ category: "LAPTOP_DESKTOP", title: "", description: "" });
  const { create } = useHelpdeskMutations();

  function set<K extends keyof CreateHelpdeskTicketInput>(key: K, value: CreateHelpdeskTicketInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  return (
    <Modal title="Raise an IT support request" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-soliflex-gray-700">Category</label>
          <select
            value={form.category}
            onChange={(e) => set("category", e.target.value as HelpdeskCategory)}
            className="w-full rounded-lg border border-soliflex-gray-200 px-3 py-2 text-sm"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {HELPDESK_CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-soliflex-gray-700">Title</label>
          <input
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="e.g. Laptop won't turn on"
            className="w-full rounded-lg border border-soliflex-gray-200 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-soliflex-gray-700">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            rows={4}
            placeholder="What's happening, when did it start, anything you've already tried..."
            className="w-full rounded-lg border border-soliflex-gray-200 px-3 py-2 text-sm"
          />
        </div>
        <button
          onClick={() => create.mutate(form, { onSuccess: onClose })}
          disabled={!form.title || !form.description || create.isPending}
          className="w-full rounded-lg bg-soliflex-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-soliflex-orange-600 disabled:opacity-50"
        >
          Submit request
        </button>
      </div>
    </Modal>
  );
}
