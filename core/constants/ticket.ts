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
