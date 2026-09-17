import type { TicketCategory, TicketStatus } from "core/constants/ticket";

export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  OPEN: "Open",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

export const TICKET_CATEGORY_LABEL: Record<TicketCategory, string> = {
  GENERAL_QUESTION: "General question",
  TECHNICAL_QUESTION: "Technical question",
  REFUND_REQUEST: "Refund request",
};
