import type { TicketListQuery } from "core/schemas/tickets";

import type { Prisma } from "../../generated/prisma/client";

/** The last characters of a ticket id, as the list shows them after a "#". */
const REFERENCE = /^#?([a-z0-9]{3,})$/i;

/**
 * The WHERE clause for GET /api/tickets. Status and category match exactly; an absent one is
 * undefined, which Prisma leaves out. `q` matches subject or requester email anywhere, case
 * insensitively, and — when it looks like a reference such as "#K3F9QZ" — the end of the id.
 */
export function ticketListWhere({ status, category, q }: TicketListQuery): Prisma.TicketWhereInput {
  const search = q?.trim();
  if (!search) return { status, category };

  const reference = search.match(REFERENCE)?.[1];

  return {
    status,
    category,
    OR: [
      { subject: { contains: search, mode: "insensitive" } },
      { requesterEmail: { contains: search, mode: "insensitive" } },
      ...(reference ? [{ id: { endsWith: reference.toLowerCase() } }] : []),
    ],
  };
}
