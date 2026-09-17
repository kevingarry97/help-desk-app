import { useMemo } from "react";
import { useLocation, useSearchParams } from "react-router";
import { functionalUpdate, useTable } from "@tanstack/react-table";
import { Inbox, SearchX } from "lucide-react";
import type { TicketListItem, TicketListQuery } from "core/schemas/tickets";
import { cn } from "cn";

import ErrorAlert from "@/components/ErrorAlert";
import {
  HIDDEN_TICKET_COLUMNS,
  ticketColumns,
  ticketTableFeatures,
} from "@/components/tickets/ticket-columns";
import TicketFilters from "@/components/tickets/TicketFilters";
import TicketSearch from "@/components/tickets/TicketSearch";
import TicketsTable from "@/components/tickets/TicketsTable";
import { useTickets } from "@/hooks/use-tickets";
import { filtersFromSearchParams, hasFilters, withParams, withoutFilters } from "@/lib/ticket-filters";
import {
  columnFiltersFromQuery,
  queryFromColumnFilters,
  queryFromSorting,
  sortingFromQuery,
} from "@/lib/ticket-table-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

function TableSkeleton() {
  return (
    <div className="space-y-7">
      {[4, 2].map((rows, group) => (
        <div key={group}>
          <Skeleton className="mb-3 h-5 w-28" />
          <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
            <div className="h-10 border-b border-border bg-table-header" />
            {Array.from({ length: rows }, (_, row) => (
              <div
                key={row}
                className="flex h-[4.25rem] items-center gap-5 border-b border-border px-4 last:border-b-0 sm:px-5"
              >
                <Skeleton className="hidden h-3 w-14 sm:block" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-3/5 max-w-80" />
                  <Skeleton className="h-3 w-40" />
                </div>
                <Skeleton className="hidden h-6 w-32 rounded-md lg:block" />
                <Skeleton className="hidden h-3.5 w-36 md:block" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl bg-card px-6 py-16 text-center ring-1 ring-foreground/10">
      <Inbox className="mx-auto size-8 text-muted-foreground/50" />
      <p className="mt-3 text-sm font-medium text-foreground">No tickets yet</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Tickets appear here as support emails arrive.
      </p>
    </div>
  );
}

function NoMatches({ onClear }: { onClear: () => void }) {
  return (
    <div className="rounded-xl bg-card px-6 py-16 text-center ring-1 ring-foreground/10">
      <SearchX className="mx-auto size-8 text-muted-foreground/50" />
      <p className="mt-3 text-sm font-medium text-foreground">No tickets match these filters</p>
      <p className="mt-1 text-sm text-muted-foreground">Try another search, status or category.</p>
      <Button variant="outline" size="sm" className="mt-4" onClick={onClear}>
        Clear filters
      </Button>
    </div>
  );
}

const NO_TICKETS: TicketListItem[] = [];

export default function TicketsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { search } = useLocation();
  const filters = filtersFromSearchParams(searchParams);
  const { status, category, q, sort, dir } = filters;

  const { data: tickets, isPending, isError, error, isPlaceholderData } = useTickets(filters);

  const update = (patch: Partial<Record<keyof TicketListQuery, string | undefined>>) =>
    setSearchParams((current) => withParams(current, patch), { replace: true });

  const sorting = useMemo(() => sortingFromQuery({ sort, dir }), [sort, dir]);
  const columnFilters = useMemo(() => columnFiltersFromQuery({ status, category }), [status, category]);
  const globalFilter = q ?? "";

  // The URL is the state; TanStack reads it and reports changes, which go straight back to it.
  // Sorting and filtering are manual — the server does both.
  const table = useTable({
    features: ticketTableFeatures,
    columns: ticketColumns,
    data: tickets ?? NO_TICKETS,
    getRowId: (ticket) => ticket.id,
    manualSorting: true,
    manualFiltering: true,
    enableMultiSort: false,
    enableSortingRemoval: false,
    state: { sorting, columnFilters, globalFilter, columnVisibility: HIDDEN_TICKET_COLUMNS },
    onSortingChange: (updater) => update(queryFromSorting(functionalUpdate(updater, sorting))),
    onColumnFiltersChange: (updater) =>
      update(queryFromColumnFilters(functionalUpdate(updater, columnFilters))),
    onGlobalFilterChange: (updater) => {
      const next = functionalUpdate(updater, globalFilter);
      update({ q: typeof next === "string" ? next.trim() || undefined : undefined });
    },
    meta: { listSearch: search },
  });

  const clearFilters = () => setSearchParams(withoutFilters, { replace: true });

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight text-foreground">Tickets</h1>
      <p className="mt-1 text-sm text-surface-muted-foreground">
        Every ticket in the queue by status. Sort by any column.
      </p>

      <div className="mt-6 space-y-4">
        <TicketSearch value={q} onChange={(next) => table.setGlobalFilter(next ?? "")} />
        <TicketFilters
          status={status}
          category={category}
          onStatusChange={(next) => table.getColumn("status")?.setFilterValue(next)}
          onCategoryChange={(next) => table.getColumn("category")?.setFilterValue(next)}
        />
      </div>

      <div className="mt-7 space-y-4">
        {isError && <ErrorAlert error={error} fallback="Failed to load tickets." />}

        {isPending && <TableSkeleton />}

        {tickets && (
          <div
            aria-busy={isPlaceholderData}
            className={cn("transition-opacity", isPlaceholderData && "opacity-60")}
          >
            {tickets.length > 0 ? (
              <TicketsTable table={table} />
            ) : hasFilters(filters) ? (
              <NoMatches onClear={clearFilters} />
            ) : (
              <EmptyState />
            )}
          </div>
        )}
      </div>
    </>
  );
}
