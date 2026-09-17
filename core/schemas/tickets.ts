import { z } from "zod/v4";

import { SortDirection, TicketCategory, TicketSortField, TicketStatus } from "../constants/ticket";

/**
 * One row of GET /api/tickets. Deliberately without `body` — an emailed body runs to
 * 50,000 characters and the list shows none of it — and without `messageId`, which is
 * de-duplication plumbing rather than something an agent reads.
 */
export const ticketListItemSchema = z.object({
  id: z.string(),
  subject: z.string(),
  requesterEmail: z.email(),
  status: z.enum(TicketStatus),
  category: z.enum(TicketCategory),
  createdAt: z.iso.datetime(),
});

export type TicketListItem = z.infer<typeof ticketListItemSchema>;

/** GET /api/tickets/:id — one ticket in full. Still no `messageId`. */
export const ticketDetailSchema = ticketListItemSchema.extend({
  body: z.string(),
  updatedAt: z.iso.datetime(),
});

export type TicketDetail = z.infer<typeof ticketDetailSchema>;

/**
 * GET /api/tickets query parameters. Each filter is optional, and leaving it out means "any".
 * A value that isn't a known status or category is a 400, not silently ignored, because a
 * list that looks unfiltered when the caller asked for a filter would mislead them.
 */
export const ticketListQuerySchema = z.object({
  status: z.enum(TicketStatus).optional(),
  category: z.enum(TicketCategory).optional(),
  /** Free-text search over subject, requester email and ticket reference. Blank means none. */
  q: z.string().trim().max(200).optional(),
  sort: z.enum(TicketSortField).optional(),
  /** Without it, the sort field's natural first direction: newest first for dates, A–Z otherwise. */
  dir: z.enum(SortDirection).optional(),
});

export type TicketListQuery = z.infer<typeof ticketListQuerySchema>;

export const createTicketSchema = z.object({
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(10_000),
  requesterEmail: z.email().max(320),
  category: z.enum(TicketCategory).default(TicketCategory.GeneralQuestion),
});

export const updateTicketSchema = z.object({
  status: z.enum(TicketStatus),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;
