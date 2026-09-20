import {
  TICKET_GROUP_PAGE_PARAM,
  TICKET_GROUP_PAGE_SIZE,
  TICKET_STATUS_ORDER,
  type TicketStatus,
} from "core/constants/ticket";
import type { TicketListQuery } from "core/schemas/tickets";

/** The statuses a grouped response holds: the filtered one alone, or all of them in order. */
export function groupStatuses({ status }: TicketListQuery): readonly TicketStatus[] {
  return status ? [status] : TICKET_STATUS_ORDER;
}

/** The page to serve for a section: the one asked for, pulled back to the last real page. */
export function groupPage(query: TicketListQuery, status: TicketStatus, total: number) {
  const pageCount = Math.max(1, Math.ceil(total / TICKET_GROUP_PAGE_SIZE));
  const page = Math.min(query[TICKET_GROUP_PAGE_PARAM[status]] ?? 1, pageCount);

  return { page, skip: (page - 1) * TICKET_GROUP_PAGE_SIZE, take: TICKET_GROUP_PAGE_SIZE };
}
