import type { ColumnFiltersState, SortingState } from "@tanstack/react-table";
import {
  DEFAULT_TICKET_SORT_FIELD,
  SortDirection,
  TICKET_SORT_FIRST_DIRECTION,
} from "core/constants/ticket";
import { ticketListQuerySchema, type TicketListQuery } from "core/schemas/tickets";

type SortQuery = Pick<TicketListQuery, "sort" | "dir">;
type FilterQuery = Pick<TicketListQuery, "status" | "category">;

const { sort: sortSchema, status: statusSchema, category: categorySchema } = ticketListQuerySchema.shape;

export function sortingFromQuery({ sort, dir }: TicketListQuery): SortingState {
  const id = sort ?? DEFAULT_TICKET_SORT_FIELD;
  return [{ id, desc: (dir ?? TICKET_SORT_FIRST_DIRECTION[id]) === SortDirection.Desc }];
}

/** Both keys always present: undefined removes them from the URL, and the default sort is written as none. */
export function queryFromSorting(sorting: SortingState): SortQuery {
  const [first] = sorting;
  const sort = sortSchema.safeParse(first?.id).data;
  if (!first || !sort) return { sort: undefined, dir: undefined };

  const dir = first.desc ? SortDirection.Desc : SortDirection.Asc;
  const isDefault = sort === DEFAULT_TICKET_SORT_FIELD && dir === TICKET_SORT_FIRST_DIRECTION[sort];

  return isDefault ? { sort: undefined, dir: undefined } : { sort, dir };
}

export function columnFiltersFromQuery({ status, category }: TicketListQuery): ColumnFiltersState {
  return [
    ...(status ? [{ id: "status", value: status }] : []),
    ...(category ? [{ id: "category", value: category }] : []),
  ];
}

export function queryFromColumnFilters(filters: ColumnFiltersState): FilterQuery {
  const valueOf = (id: string) => filters.find((filter) => filter.id === id)?.value;

  return {
    status: statusSchema.safeParse(valueOf("status")).data,
    category: categorySchema.safeParse(valueOf("category")).data,
  };
}
