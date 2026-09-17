import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";

type Props = {
  /** The search currently applied (from the URL). */
  value: string | undefined;
  onChange: (value: string | undefined) => void;
};

const DEBOUNCE_MS = 300;

/**
 * Typing is kept locally and applied once the agent pauses, so each keystroke doesn't become
 * a request and a history-replacing URL write. A change from outside — Clear filters, Back —
 * replaces the draft.
 */
export default function TicketSearch({ value, onChange }: Props) {
  const applied = value ?? "";
  const [draft, setDraft] = useState(applied);
  const [lastApplied, setLastApplied] = useState(applied);

  if (applied !== lastApplied) {
    setLastApplied(applied);
    setDraft(applied);
  }

  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    const next = draft.trim();
    if (next === applied) return;

    const timer = setTimeout(() => onChangeRef.current(next || undefined), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [draft, applied]);

  const clear = () => {
    setDraft("");
    onChange(undefined);
  };

  return (
    <div className="relative w-full sm:max-w-sm">
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-surface-muted-foreground"
      />
      <Input
        type="search"
        aria-label="Search tickets"
        placeholder="Search subject, email or #reference"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape" && draft) {
            event.preventDefault();
            clear();
          }
        }}
        className="h-9 rounded-lg bg-card pr-9 pl-9 focus-visible:border-brand-500 focus-visible:ring-3 focus-visible:ring-brand-500/15 [&::-webkit-search-cancel-button]:hidden"
      />
      {draft && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={clear}
          className="absolute top-1/2 right-1.5 grid size-6 -translate-y-1/2 place-items-center rounded-md text-surface-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}
