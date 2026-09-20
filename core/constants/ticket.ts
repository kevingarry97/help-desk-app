export const TicketStatus = {
  Open: "OPEN",
  Resolved: "RESOLVED",
  Closed: "CLOSED",
} as const;

export type TicketStatus = (typeof TicketStatus)[keyof typeof TicketStatus];

export const TICKET_STATUS_ORDER: readonly TicketStatus[] = [
  TicketStatus.Open,
  TicketStatus.Resolved,
  TicketStatus.Closed,
];

export const TICKET_GROUP_PAGE_SIZE = 10;

export const TICKET_GROUP_PAGE_PARAM = {
  OPEN: "openPage",
  RESOLVED: "resolvedPage",
  CLOSED: "closedPage",
} as const satisfies Record<TicketStatus, string>;

export type TicketGroupPageParam = (typeof TICKET_GROUP_PAGE_PARAM)[TicketStatus];

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

export const TICKET_SORT_FIRST_DIRECTION: Record<TicketSortField, SortDirection> = {
  createdAt: SortDirection.Desc,
  subject: SortDirection.Asc,
  category: SortDirection.Asc,
};

export const DEFAULT_TICKET_SORT_FIELD = TicketSortField.Received;
