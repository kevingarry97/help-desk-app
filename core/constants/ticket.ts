// Mirrors the TicketStatus and TicketCategory enums in server/prisma/schema.prisma: these
// values are what Postgres stores, so the two must stay identical. Declared here as
// `as const` objects rather than imported from the generated Prisma client because the
// client shares these schemas and cannot reach server-generated code.
// server/src/lib/enum-parity.ts fails the server typecheck if they ever drift.

export const TicketStatus = {
  Open: "OPEN",
  Resolved: "RESOLVED",
  Closed: "CLOSED",
} as const;

export type TicketStatus = (typeof TicketStatus)[keyof typeof TicketStatus];

export const TicketCategory = {
  GeneralQuestion: "GENERAL_QUESTION",
  TechnicalQuestion: "TECHNICAL_QUESTION",
  RefundRequest: "REFUND_REQUEST",
} as const;

export type TicketCategory = (typeof TicketCategory)[keyof typeof TicketCategory];

/** The columns GET /api/tickets can sort by. Values are the Ticket fields they order on. */
export const TicketSortField = {
  Received: "createdAt",
  Subject: "subject",
  Category: "category",
} as const;

export type TicketSortField = (typeof TicketSortField)[keyof typeof TicketSortField];

export const SortDirection = { Asc: "asc", Desc: "desc" } as const;

export type SortDirection = (typeof SortDirection)[keyof typeof SortDirection];

/** The direction a column sorts in when first chosen: newest first for dates, A–Z otherwise. */
export const TICKET_SORT_FIRST_DIRECTION: Record<TicketSortField, SortDirection> = {
  createdAt: SortDirection.Desc,
  subject: SortDirection.Asc,
  category: SortDirection.Asc,
};

export const DEFAULT_TICKET_SORT_FIELD = TicketSortField.Received;
