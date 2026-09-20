import { useId, useMemo, useState, type ReactNode } from "react";
import { useLocation } from "react-router";
import {
  functionalUpdate,
  useTable,
  type Column,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "cn";
import { TICKET_GROUP_PAGE_PARAM, type TicketStatus } from "core/constants/ticket";
import type { TicketGroup as TicketGroupData, TicketListItem, TicketListQuery } from "core/schemas/tickets";

import {
  HIDDEN_TICKET_COLUMNS,
  ticketColumns,
  ticketTableFeatures,
  type TicketTableFeatures,
} from "@/components/tickets/ticket-columns";
import TicketFilters from "@/components/tickets/TicketFilters";
import TicketSearch from "@/components/tickets/TicketSearch";
import { STATUS_HEADING, STATUS_STYLE } from "@/components/tickets/ticket-style";
import { FIRST_PAGES, type TicketQueryPatch } from "@/lib/ticket-filters";
import { TICKET_STATUS_LABEL } from "@/lib/ticket-labels";
import {
  columnFiltersFromQuery,
  queryFromColumnFilters,
  queryFromSorting,
  sortingFromQuery,
} from "@/lib/ticket-table-state";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const NO_TICKETS: TicketListItem[] = [];

const headClass =
  "h-10 px-4 text-[0.6875rem] font-semibold tracking-wider text-table-header-foreground uppercase sm:px-5";
const cellClass = "px-4 py-3 sm:px-5";

function ariaSort(column: Column<TicketTableFeatures, TicketListItem, unknown>) {
  if (!column.getCanSort()) return undefined;
  const direction = column.getIsSorted();
  return direction === "asc" ? "ascending" : direction === "desc" ? "descending" : "none";
}

function SortIcon({ direction }: { direction: false | "asc" | "desc" }) {
  if (direction === "asc") return <ArrowUp aria-hidden="true" className="size-3.5" />;
  if (direction === "desc") return <ArrowDown aria-hidden="true" className="size-3.5" />;
  return (
    <ArrowUpDown
      aria-hidden="true"
      className="size-3.5 opacity-0 transition-opacity group-hover/sort:opacity-70 group-focus-visible/sort:opacity-70"
    />
  );
}

type GroupProps = {
  group: TicketGroupData;
  sorting: SortingState;
  onSortingChange: (sorting: SortingState) => void;
  onPageChange: (patch: TicketQueryPatch) => void;
  open: boolean;
  onToggle: () => void;
  listSearch: string;
};

function TicketGroup({
  group,
  sorting,
  onSortingChange,
  onPageChange,
  open,
  onToggle,
  listSearch,
}: GroupProps) {
  const bodyId = useId();
  const { status, total, page, pageSize } = group;
  const label = TICKET_STATUS_LABEL[status];
  const expanded = open && total > 0;

  const pagination = useMemo(() => ({ pageIndex: page - 1, pageSize }), [page, pageSize]);

  const table = useTable({
    features: ticketTableFeatures,
    columns: ticketColumns,
    data: group.tickets,
    getRowId: (ticket) => ticket.id,
    rowCount: total,
    manualSorting: true,
    manualFiltering: true,
    manualPagination: true,
    enableMultiSort: false,
    enableSortingRemoval: false,
    state: { sorting, pagination, columnVisibility: HIDDEN_TICKET_COLUMNS },
    onSortingChange: (updater) => onSortingChange(functionalUpdate(updater, sorting)),
    onPaginationChange: (updater) => {
      const { pageIndex } = functionalUpdate(updater, pagination);
      onPageChange({ [TICKET_GROUP_PAGE_PARAM[status]]: pageIndex > 0 ? String(pageIndex + 1) : undefined });
    },
    meta: { listSearch },
  });

  const pageCount = table.getPageCount();
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <section aria-label={`${label} tickets`} data-testid="ticket-group" data-status={status}>
      <h2 className="mb-2.5">
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={bodyId}
          aria-label={`${label}, ${total} ${total === 1 ? "ticket" : "tickets"}`}
          disabled={total === 0}
          onClick={onToggle}
          className="-ml-1.5 inline-flex items-center gap-2 rounded-md py-1 pr-2 pl-1.5 text-sm font-semibold transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:hover:bg-transparent"
        >
          <ChevronDown
            aria-hidden="true"
            className={cn(
              "size-4 text-surface-muted-foreground transition-transform duration-200",
              !expanded && "-rotate-90",
              total === 0 && "opacity-40",
            )}
          />
          <span aria-hidden="true" className={cn("size-2 rounded-full", STATUS_STYLE[status].mark)} />
          <span className={STATUS_HEADING[status]}>{label}</span>
          <span className="min-w-6 rounded-full bg-card px-1.5 text-center text-xs font-medium text-surface-muted-foreground tabular-nums ring-1 ring-foreground/10">
            {total}
          </span>
        </button>
      </h2>

      <div
        id={bodyId}
        hidden={!expanded}
        className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10"
      >
        {/* Fixed layout and fixed side columns, so every section's columns line up. */}
        <Table className="table-fixed">
          <TableHeader className="hidden bg-table-header sm:table-header-group">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="border-border hover:bg-table-header">
                {headerGroup.headers.map((header) => {
                  const { column } = header;
                  const direction = column.getIsSorted();

                  return (
                    <TableHead
                      key={header.id}
                      aria-sort={ariaSort(column)}
                      className={cn(headClass, column.columnDef.meta?.className)}
                    >
                      {column.getCanSort() ? (
                        <button
                          type="button"
                          onClick={column.getToggleSortingHandler()}
                          className={cn(
                            "group/sort -mx-1.5 inline-flex items-center gap-1 rounded px-1.5 py-1 font-semibold tracking-wider uppercase transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            direction && "text-foreground",
                          )}
                        >
                          <table.FlexRender header={header} />
                          <SortIcon direction={direction} />
                        </button>
                      ) : (
                        <table.FlexRender header={header} />
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-testid="ticket-row"
                data-ticket-id={row.original.id}
                className="group/row relative border-border even:bg-table-stripe hover:bg-table-row-hover"
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    className={cn(
                      cellClass,
                      cell.column.columnDef.meta?.className,
                      cell.column.columnDef.meta?.cellClassName,
                    )}
                  >
                    <table.FlexRender cell={cell} />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {pageCount > 1 && (
          <nav
            aria-label={`${label} tickets pages`}
            className="flex items-center justify-between gap-3 border-t border-border px-4 py-2 sm:px-5"
          >
            <p className="text-xs text-table-muted-foreground tabular-nums">
              {from}–{to} of {total}
            </p>
            <div className="flex items-center gap-1">
              <span className="mr-1.5 text-xs text-table-muted-foreground tabular-nums">
                Page {page} of {pageCount}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Previous page of ${label.toLowerCase()} tickets`}
                disabled={!table.getCanPreviousPage()}
                onClick={() => table.previousPage()}
              >
                <ChevronLeft />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Next page of ${label.toLowerCase()} tickets`}
                disabled={!table.getCanNextPage()}
                onClick={() => table.nextPage()}
              >
                <ChevronRight />
              </Button>
            </div>
          </nav>
        )}
      </div>
    </section>
  );
}

type Props = {
  groups: TicketGroupData[] | undefined;
  query: TicketListQuery;
  onQueryChange: (patch: TicketQueryPatch) => void;
  isUpdating: boolean;
  children?: ReactNode;
};

export default function TicketsTable({ groups, query, onQueryChange, isUpdating, children }: Props) {
  const { search } = useLocation();
  const [collapsed, setCollapsed] = useState<ReadonlySet<TicketStatus>>(new Set());

  const { status, category, q, sort, dir } = query;
  const sorting = useMemo(() => sortingFromQuery({ sort, dir }), [sort, dir]);
  const columnFilters = useMemo(() => columnFiltersFromQuery({ status, category }), [status, category]);
  const globalFilter = q ?? "";

  const setSorting = (next: SortingState) => onQueryChange({ ...queryFromSorting(next), ...FIRST_PAGES });

  // Holds no rows: it owns the filter and search state the chips and box drive. Sections page on their own tables.
  const toolbar = useTable({
    features: ticketTableFeatures,
    columns: ticketColumns,
    data: NO_TICKETS,
    manualFiltering: true,
    state: { columnFilters, globalFilter },
    onColumnFiltersChange: (updater) =>
      onQueryChange({ ...queryFromColumnFilters(functionalUpdate(updater, columnFilters)), ...FIRST_PAGES }),
    onGlobalFilterChange: (updater) => {
      const next = functionalUpdate(updater, globalFilter);
      onQueryChange({ q: typeof next === "string" ? next.trim() || undefined : undefined, ...FIRST_PAGES });
    },
  });

  const toggle = (group: TicketStatus) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });

  return (
    <>
      <div className="mt-6 space-y-4">
        <TicketSearch value={q} onChange={(next) => toolbar.setGlobalFilter(next ?? "")} />
        <TicketFilters
          status={status}
          category={category}
          onStatusChange={(next) => toolbar.getColumn("status")?.setFilterValue(next)}
          onCategoryChange={(next) => toolbar.getColumn("category")?.setFilterValue(next)}
        />
      </div>

      <div className="mt-7 space-y-4">
        {children}

        {groups?.some((group) => group.total > 0) && (
          <div
            aria-busy={isUpdating}
            className={cn("space-y-7 transition-opacity", isUpdating && "opacity-60")}
          >
            {groups.map((group) => (
              <TicketGroup
                key={group.status}
                group={group}
                sorting={sorting}
                onSortingChange={setSorting}
                onPageChange={onQueryChange}
                open={!collapsed.has(group.status)}
                onToggle={() => toggle(group.status)}
                listSearch={search}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
