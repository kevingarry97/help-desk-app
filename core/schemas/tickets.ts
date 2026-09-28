import { z } from "zod/v4";

import {
  SortDirection,
  TicketAssigneeFilter,
  TicketCategory,
  TicketSortField,
  TicketStatus,
} from "../constants/ticket";

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

/** Who a ticket is assigned to, as the detail route embeds them — not the user directory's row. */
export const ticketAssigneeSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.email(),
  image: z.string().nullable(),
});

export type TicketAssignee = z.infer<typeof ticketAssigneeSchema>;

/** A reply's author is the same four public fields the assignee is. */
export const ticketReplyAuthorSchema = ticketAssigneeSchema;

/**
 * One entry in a ticket's thread. `authorName` is snapshotted at write time, so a reply
 * still says who wrote it after that account is deleted and `author` falls to null.
 */
export const ticketReplySchema = z.object({
  id: z.string(),
  body: z.string(),
  isInternal: z.boolean(),
  createdAt: z.iso.datetime(),
  authorName: z.string(),
  author: ticketReplyAuthorSchema.nullable(),
});

export type TicketReply = z.infer<typeof ticketReplySchema>;

/** GET /api/tickets/:id — one ticket in full. Still no `messageId`. */
export const ticketDetailSchema = ticketListItemSchema.extend({
  body: z.string(),
  updatedAt: z.iso.datetime(),
  assignee: ticketAssigneeSchema.nullable(),
  replies: z.array(ticketReplySchema),
});

export type TicketDetail = z.infer<typeof ticketDetailSchema>;

/**
 * GET /api/tickets query parameters. Each filter is optional, and leaving it out means "any".
 * A value that isn't a known status or category is a 400, not silently ignored, because a
 * list that looks unfiltered when the caller asked for a filter would mislead them.
 */
const pageNumber = z.coerce.number().int().min(1).max(100_000).optional();

export const ticketListQuerySchema = z.object({
  status: z.enum(TicketStatus).optional(),
  category: z.enum(TicketCategory).optional(),
  /** Free-text search over subject, requester email and ticket reference. Blank means none. */
  q: z.string().trim().max(200).optional(),
  sort: z.enum(TicketSortField).optional(),
  /** Without it, the sort field's natural first direction: newest first for dates, A–Z otherwise. */
  dir: z.enum(SortDirection).optional(),
  /** Whose tickets: the caller's own, or the ones nobody owns. */
  assignee: z.enum(TicketAssigneeFilter).optional(),
  /** GET /api/tickets/by-status only: each status section's page, from 1. */
  openPage: pageNumber,
  resolvedPage: pageNumber,
  closedPage: pageNumber,
});

export type TicketListQuery = z.infer<typeof ticketListQuerySchema>;

/** One status section of GET /api/tickets/by-status: a page of its tickets, and how many match in all. */
export const ticketGroupSchema = z.object({
  status: z.enum(TicketStatus),
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  tickets: z.array(ticketListItemSchema),
});

export const ticketGroupsSchema = z.object({ groups: z.array(ticketGroupSchema) });

export type TicketGroup = z.infer<typeof ticketGroupSchema>;
export type TicketGroups = z.infer<typeof ticketGroupsSchema>;

export const createTicketSchema = z.object({
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(10_000),
  requesterEmail: z.email().max(320),
  category: z.enum(TicketCategory).default(TicketCategory.GeneralQuestion),
});

const ticketTriageFields = {
  status: z.enum(TicketStatus),
  category: z.enum(TicketCategory),
};

/** The edit form, which always submits both fields. */
export const ticketTriageSchema = z.object(ticketTriageFields);

/**
 * PATCH /api/tickets/:id. Partial on purpose: moving a ticket's status must not oblige the
 * caller to resend its category, which would make an unrelated field a required round trip.
 */
export const updateTicketSchema = z
  .object(ticketTriageFields)
  .partial()
  .refine((body) => body.status !== undefined || body.category !== undefined, {
    message: "Change at least one of status or category",
  });

/** PATCH /api/tickets/:id/assignee — `null` unassigns. */
export const assignTicketSchema = z.object({
  assigneeId: z.string().min(1).nullable(),
});

const replyFields = {
  body: z
    .string()
    .trim()
    .min(1, "Write a reply first")
    .max(10_000, "Reply must be 10,000 characters or fewer"),
  /** Internal notes stay with the ticket; a public reply is what a mail provider would send. */
  isInternal: z.boolean(),
};

/** The composer, which never submits `resolve` — that is chosen by which button was pressed. */
export const replyFormSchema = z.object(replyFields);

/** POST /api/tickets/:id/replies. `resolve` moves the ticket to Resolved in the same write. */
export const createReplySchema = z.object({
  ...replyFields,
  resolve: z.boolean().default(false),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;
export type TicketTriageValues = z.infer<typeof ticketTriageSchema>;
export type AssignTicketInput = z.infer<typeof assignTicketSchema>;
export type ReplyFormValues = z.infer<typeof replyFormSchema>;
export type CreateReplyInput = z.output<typeof createReplySchema>;
export type CreateReplyValues = z.input<typeof createReplySchema>;
