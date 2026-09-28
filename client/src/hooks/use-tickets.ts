import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateReplyInput,
  TicketDetail,
  TicketGroups,
  TicketListQuery,
  UpdateTicketInput,
} from "core/schemas/tickets";

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

export function useAssignTicket(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (assigneeId: string | null) => {
      const { data } = await api.patch<TicketDetail>(
        `/tickets/${encodeURIComponent(id)}/assignee`,
        { assigneeId },
      );
      return data;
    },

    onSuccess: (ticket) => {
      queryClient.setQueryData([...ticketsQueryKey, "detail", ticket.id], ticket);
      void queryClient.invalidateQueries({ queryKey: ticketsQueryKey });
    },
  });
}

/** Status and category, the triage fields. Admin-only on the server, like assignment. */
export function useUpdateTicket(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateTicketInput) => {
      const { data } = await api.patch<TicketDetail>(`/tickets/${encodeURIComponent(id)}`, input);
      return data;
    },

    onSuccess: (ticket) => {
      queryClient.setQueryData([...ticketsQueryKey, "detail", ticket.id], ticket);
      void queryClient.invalidateQueries({ queryKey: ticketsQueryKey });
    },
  });
}

/**
 * Posts a reply — or an internal note — onto a ticket's thread, and answers the whole ticket
 * back. The invalidate matters more here than on the other mutations: "Reply & resolve"
 * changes the status, so the list sections behind the sheet have to regroup the row.
 */
export function useAddReply(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateReplyInput) => {
      const { data } = await api.post<TicketDetail>(
        `/tickets/${encodeURIComponent(id)}/replies`,
        input,
      );
      return data;
    },

    onSuccess: (ticket) => {
      queryClient.setQueryData([...ticketsQueryKey, "detail", ticket.id], ticket);
      void queryClient.invalidateQueries({ queryKey: ticketsQueryKey });
    },
  });
}
