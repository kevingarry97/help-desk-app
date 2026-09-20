import { Outlet, useSearchParams } from "react-router";
import { Inbox, SearchX } from "lucide-react";

import ErrorAlert from "@/components/ErrorAlert";
import TicketsTable from "@/components/tickets/TicketsTable";
import { useTicketGroups } from "@/hooks/use-tickets";
import {
  filtersFromSearchParams,
  hasFilters,
  withParams,
  withoutFilters,
  type TicketQueryPatch,
} from "@/lib/ticket-filters";
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

export default function TicketsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = filtersFromSearchParams(searchParams);

  const { data: groups, isPending, isError, error, isPlaceholderData } = useTicketGroups(query);
  const isEmpty = groups?.every((group) => group.total === 0);

  const updateQuery = (patch: TicketQueryPatch) =>
    setSearchParams((current) => withParams(current, patch), { replace: true });

  const clearFilters = () => setSearchParams(withoutFilters, { replace: true });

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight text-foreground">Tickets</h1>
      <p className="mt-1 text-sm text-surface-muted-foreground">
        Every ticket in the queue by status. Sort by any column.
      </p>

      <TicketsTable
        groups={groups}
        query={query}
        onQueryChange={updateQuery}
        isUpdating={isPlaceholderData}
      >
        {isError && <ErrorAlert error={error} fallback="Failed to load tickets." />}

        {isPending && <TableSkeleton />}

        {isEmpty &&
          (hasFilters(query) ? <NoMatches onClear={clearFilters} /> : <EmptyState />)}
      </TicketsTable>

      <Outlet />
    </>
  );
}
