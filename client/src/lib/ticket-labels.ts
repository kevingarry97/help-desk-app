import type { TicketAssigneeFilter, TicketCategory, TicketStatus } from "core/constants/ticket";

export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  OPEN: "Open",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

export const TICKET_CATEGORY_LABEL: Record<TicketCategory, string> = {
  GENERAL_QUESTION: "General Question",
  TECHNICAL_QUESTION: "Technical Question",
  REFUND_REQUEST: "Refund Request",
};

export const TICKET_ASSIGNEE_FILTER_LABEL: Record<TicketAssigneeFilter, string> = {
  me: "Assigned to me",
  none: "Unassigned",
};
