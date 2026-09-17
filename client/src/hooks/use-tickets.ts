import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { TicketDetail, TicketListItem, TicketListQuery } from "core/schemas/tickets";

import { api } from "@/lib/api";

export const ticketsQueryKey = ["tickets"] as const;

/**
 * Tickets matching `filters`, newest first. The server owns both the filtering and the
 * order; the list renders what comes back as given.
 *
 * Each filter combination is its own cache entry under the ["tickets"] prefix, so
 * invalidating `ticketsQueryKey` refreshes all of them — and every open ticket too. `keepPreviousData` holds the last
 * list on screen while a new filter loads, rather than dropping back to the skeleton on
 * every click.
 */
export function useTickets(filters: TicketListQuery = {}) {
  return useQuery({
    queryKey: [...ticketsQueryKey, "list", filters],
    queryFn: async ({ signal }) => {
      // Axios leaves undefined params out of the URL, so "any" sends no parameter at all.
      const { data } = await api.get<TicketListItem[]>("/tickets", { params: filters, signal });
      return data;
    },
    placeholderData: keepPreviousData,
  });
}

/** One ticket in full, body included. A missing ticket is a 404, which is not retried. */
export function useTicket(id: string) {
  return useQuery({
    queryKey: [...ticketsQueryKey, "detail", id],
    queryFn: async ({ signal }) => {
      const { data } = await api.get<TicketDetail>(`/tickets/${encodeURIComponent(id)}`, { signal });
      return data;
    },
  });
}
