/**
 * The shape GET /api/tickets speaks in — mirrors ticketListItemSchema in
 * core/schemas/tickets.ts. Selected explicitly so the list never ships ticket bodies, and a
 * column added later is not exposed by accident.
 */
export const TICKET_LIST_SELECT = {
  id: true,
  subject: true,
  requesterEmail: true,
  status: true,
  category: true,
  createdAt: true,
} as const;

/**
 * The shape GET /api/tickets/:id speaks in — mirrors ticketDetailSchema. The list shape plus
 * what only one ticket at a time needs: the body, and when it last changed. `messageId`
 * stays out here too.
 */
export const TICKET_DETAIL_SELECT = {
  ...TICKET_LIST_SELECT,
  body: true,
  updatedAt: true,
} as const;
