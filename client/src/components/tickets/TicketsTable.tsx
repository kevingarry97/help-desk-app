import { useId, useState } from "react";
import type { Column, ReactTable, Row } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown } from "lucide-react";
import { cn } from "cn";
import type { TicketStatus } from "core/constants/ticket";
import type { TicketListItem } from "core/schemas/tickets";

import type { TicketTableFeatures } from "@/components/tickets/ticket-columns";
import { STATUS_HEADING, STATUS_STYLE } from "@/components/tickets/ticket-style";
import { TICKET_STATUS_LABEL } from "@/lib/ticket-labels";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type TicketTable = ReactTable<TicketTableFeatures, TicketListItem>;

const STATUS_ORDER = Object.keys(TICKET_STATUS_LABEL) as TicketStatus[];

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
  table: TicketTable;
  status: TicketStatus;
  rows: Row<TicketTableFeatures, TicketListItem>[];
  open: boolean;
  onToggle: () => void;
};

function TicketGroup({ table, status, rows, open, onToggle }: GroupProps) {
  const bodyId = useId();
  const label = TICKET_STATUS_LABEL[status];
  const count = rows.length;
  const expanded = open && count > 0;

  return (
    <section aria-label={`${label} tickets`} data-testid="ticket-group" data-status={status}>
      <h2 className="mb-2.5">
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={bodyId}
          aria-label={`${label}, ${count} ${count === 1 ? "ticket" : "tickets"}`}
          disabled={count === 0}
          onClick={onToggle}
          className="-ml-1.5 inline-flex items-center gap-2 rounded-md py-1 pr-2 pl-1.5 text-sm font-semibold transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:hover:bg-transparent"
        >
          <ChevronDown
            aria-hidden="true"
            className={cn(
              "size-4 text-surface-muted-foreground transition-transform duration-200",
              !expanded && "-rotate-90",
              count === 0 && "opacity-40",
            )}
          />
          <span aria-hidden="true" className={cn("size-2 rounded-full", STATUS_STYLE[status].mark)} />
          <span className={STATUS_HEADING[status]}>{label}</span>
          <span className="min-w-6 rounded-full bg-card px-1.5 text-center text-xs font-medium text-surface-muted-foreground tabular-nums ring-1 ring-foreground/10">
            {count}
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
            {rows.map((row) => (
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
      </div>
    </section>
  );
}

export default function TicketsTable({ table }: { table: TicketTable }) {
  const [collapsed, setCollapsed] = useState<ReadonlySet<TicketStatus>>(new Set());

  const statusFilter = table.getColumn("status")?.getFilterValue() as TicketStatus | undefined;
  const rows = table.getRowModel().rows;

  const toggle = (group: TicketStatus) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });

  return (
    <div className="space-y-7">
      {(statusFilter ? [statusFilter] : STATUS_ORDER).map((group) => (
        <TicketGroup
          key={group}
          table={table}
          status={group}
          rows={rows.filter((row) => row.original.status === group)}
          open={!collapsed.has(group)}
          onToggle={() => toggle(group)}
        />
      ))}
    </div>
  );
}
