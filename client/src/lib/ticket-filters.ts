import { ticketListQuerySchema, type TicketListQuery } from "core/schemas/tickets";

export type TicketFilterKey = keyof TicketListQuery;

export function filtersFromSearchParams(params: URLSearchParams): TicketListQuery {
  const { status, category, q, sort, dir } = ticketListQuerySchema.shape;

  return {
    status: status.safeParse(params.get("status") ?? undefined).data,
    category: category.safeParse(params.get("category") ?? undefined).data,
    q: q.safeParse(params.get("q") ?? undefined).data || undefined,
    sort: sort.safeParse(params.get("sort") ?? undefined).data,
    dir: dir.safeParse(params.get("dir") ?? undefined).data,
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

export function withParams(
  params: URLSearchParams,
  patch: Partial<Record<TicketFilterKey, string | undefined>>,
): URLSearchParams {
  return (Object.entries(patch) as [TicketFilterKey, string | undefined][]).reduce(
    (next, [key, value]) => withFilter(next, key, value),
    params,
  );
}

export function hasFilters(filters: TicketListQuery): boolean {
  return filters.status !== undefined || filters.category !== undefined || !!filters.q;
}

export function withoutFilters(params: URLSearchParams): URLSearchParams {
  return withFilter(withFilter(withFilter(params, "status", undefined), "category", undefined), "q", undefined);
}
