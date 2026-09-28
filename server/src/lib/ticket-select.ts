export const TICKET_LIST_SELECT = {
  id: true,
  subject: true,
  requesterEmail: true,
  status: true,
  category: true,
  createdAt: true,
} as const;


/** One entry of a ticket's thread, as the detail route embeds it. */
export const TICKET_REPLY_SELECT = {
  id: true,
  body: true,
  isInternal: true,
  createdAt: true,
  authorName: true,
  author: { select: { id: true, name: true, email: true, image: true } },
} as const;

/**
 * The shape GET /api/tickets/:id speaks in — mirrors ticketDetailSchema in
 * core/schemas/tickets.ts. The thread rides along rather than living behind its own
 * endpoint, so one round trip fills the sheet and every mutation that answers this shape
 * leaves the cached thread correct. Unpaged: split it out if threads ever run long.
 */
export const TICKET_DETAIL_SELECT = {
  ...TICKET_LIST_SELECT,
  body: true,
  updatedAt: true,
  assignee: { select: { id: true, name: true, email: true, image: true } },
  replies: { select: TICKET_REPLY_SELECT, orderBy: { createdAt: "asc" } },
} as const;
