import { TICKET_GROUP_PAGE_PARAM } from "core/constants/ticket";
import { ticketListQuerySchema, type TicketListQuery } from "core/schemas/tickets";

export type TicketFilterKey = keyof TicketListQuery;

export type TicketQueryPatch = Partial<Record<TicketFilterKey, string | undefined>>;

export const FIRST_PAGES: TicketQueryPatch = Object.fromEntries(
  Object.values(TICKET_GROUP_PAGE_PARAM).map((param) => [param, undefined]),
);

export function filtersFromSearchParams(params: URLSearchParams): TicketListQuery {
  const { status, category, q, sort, dir, openPage, resolvedPage, closedPage } =
    ticketListQuerySchema.shape;

  return {
    status: status.safeParse(params.get("status") ?? undefined).data,
    category: category.safeParse(params.get("category") ?? undefined).data,
    q: q.safeParse(params.get("q") ?? undefined).data || undefined,
    sort: sort.safeParse(params.get("sort") ?? undefined).data,
    dir: dir.safeParse(params.get("dir") ?? undefined).data,
    openPage: openPage.safeParse(params.get("openPage") ?? undefined).data,
    resolvedPage: resolvedPage.safeParse(params.get("resolvedPage") ?? undefined).data,
    closedPage: closedPage.safeParse(params.get("closedPage") ?? undefined).data,
  };
}

export function withFilter(
  params: URLSearchParams,
  key: TicketFilterKey,
  value: string | undefined,
): URLSearchParams {
  const next = new URLSearchParams(params);

  if (value) next.set(key, value);
  else next.delete(key);

  return next;
}

export function withParams(params: URLSearchParams, patch: TicketQueryPatch): URLSearchParams {
  return (Object.entries(patch) as [TicketFilterKey, string | undefined][]).reduce(
    (next, [key, value]) => withFilter(next, key, value),
    params,
  );
}

export function hasFilters(filters: TicketListQuery): boolean {
  return filters.status !== undefined || filters.category !== undefined || !!filters.q;
}

export function withoutFilters(params: URLSearchParams): URLSearchParams {
  return withParams(params, { status: undefined, category: undefined, q: undefined, ...FIRST_PAGES });
}
