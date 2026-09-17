import { Link } from "react-router";
import {
  columnFilteringFeature,
  columnVisibilityFeature,
  createColumnHelper,
  globalFilteringFeature,
  rowSortingFeature,
  tableFeatures,
  type ColumnVisibilityState,
} from "@tanstack/react-table";
import { SortDirection, TICKET_SORT_FIRST_DIRECTION } from "core/constants/ticket";
import type { TicketListItem } from "core/schemas/tickets";

import TicketCategoryTag from "@/components/tickets/TicketCategoryTag";
import { formatDateTime } from "@/lib/format-date";
import { ticketReference } from "@/lib/ticket-reference";

type TicketTableMeta = { listSearch: string };
type TicketColumnMeta = { className?: string; cellClassName?: string };

export const ticketTableFeatures = tableFeatures({
  rowSortingFeature,
  columnFilteringFeature,
  globalFilteringFeature,
  columnVisibilityFeature,
  tableMeta: {} as TicketTableMeta,
  columnMeta: {} as TicketColumnMeta,
});

export type TicketTableFeatures = typeof ticketTableFeatures;

// `status` is never drawn — sections show it — but its column holds the status filter.
export const HIDDEN_TICKET_COLUMNS: ColumnVisibilityState = { status: false };

const column = createColumnHelper<TicketTableFeatures, TicketListItem>();

export const ticketColumns = column.columns([
  column.accessor("id", {
    id: "reference",
    header: "Ref",
    enableSorting: false,
    meta: {
      className: "hidden w-28 sm:table-cell",
      cellClassName: "text-xs font-medium tracking-wide text-table-muted-foreground tabular-nums",
    },
    cell: ({ getValue }) => ticketReference(getValue()),
  }),
  column.accessor("subject", {
    header: "Ticket",
    sortDescFirst: TICKET_SORT_FIRST_DIRECTION.subject === SortDirection.Desc,
    meta: { cellClassName: "max-w-0" },
    cell: ({ row, table }) => (
      <>
        <Link
          to={`/tickets/${encodeURIComponent(row.original.id)}`}
          state={{ listSearch: table.options.meta?.listSearch ?? "" }}
          title={row.original.subject}
          className="block truncate font-semibold text-foreground transition-colors group-hover/row:text-brand-700 after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:rounded-md focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-inset"
        >
          {row.original.subject}
        </Link>
        <p className="mt-0.5 truncate text-xs text-table-muted-foreground">
          {row.original.requesterEmail}
        </p>
      </>
    ),
  }),
  column.accessor("category", {
    header: "Category",
    sortDescFirst: TICKET_SORT_FIRST_DIRECTION.category === SortDirection.Desc,
    meta: { className: "hidden w-48 lg:table-cell" },
    cell: ({ getValue }) => <TicketCategoryTag category={getValue()} />,
  }),
  column.accessor("createdAt", {
    header: "Received",
    sortDescFirst: TICKET_SORT_FIRST_DIRECTION.createdAt === SortDirection.Desc,
    meta: {
      className: "hidden w-52 md:table-cell",
      cellClassName: "text-table-muted-foreground tabular-nums",
    },
    cell: ({ getValue }) => <time dateTime={getValue()}>{formatDateTime(getValue())}</time>,
  }),
  column.accessor("status", {
    header: "Status",
    enableSorting: false,
  }),
]);
