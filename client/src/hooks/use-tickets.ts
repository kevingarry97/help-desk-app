import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { TicketDetail, TicketGroups, TicketListQuery } from "core/schemas/tickets";

import { api } from "@/lib/api";

export const ticketsQueryKey = ["tickets"] as const;

/**
 * One page of tickets per status section, each with its total. The server filters, sorts and
 * pages; each section's page comes from `query`. Every combination is its own cache entry under
 * ["tickets"], and `keepPreviousData` keeps the last page on screen while the next one loads.
 */
export function useTicketGroups(query: TicketListQuery = {}) {
  return useQuery({
    queryKey: [...ticketsQueryKey, "groups", query],
    queryFn: async ({ signal }) => {
      const { data } = await api.get<TicketGroups>("/tickets/by-status", { params: query, signal });
      return data.groups;
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
