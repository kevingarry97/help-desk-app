import {
  DEFAULT_TICKET_SORT_FIELD,
  TICKET_SORT_FIRST_DIRECTION,
  TicketSortField,
} from "core/constants/ticket";
import type { TicketListQuery } from "core/schemas/tickets";

import type { Prisma } from "../../generated/prisma/client";

/**
 * ORDER BY for GET /api/tickets. Ties fall back to newest first, then `id`, so equal subjects
 * or categories keep a stable order between refetches. Category sorts by the enum's
 * declaration order (General, Technical, Refund) — the order the filters list them in.
 */
export function ticketListOrderBy({ sort, dir }: TicketListQuery): Prisma.TicketOrderByWithRelationInput[] {
  const field = sort ?? DEFAULT_TICKET_SORT_FIELD;
  const direction = dir ?? TICKET_SORT_FIRST_DIRECTION[field];

  if (field === TicketSortField.Received) {
    return [{ createdAt: direction }, { id: direction }];
  }

  return [{ [field]: direction }, { createdAt: "desc" }, { id: "desc" }];
}
