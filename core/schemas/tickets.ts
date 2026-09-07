import { z } from "zod/v4";

import { TicketCategory, TicketStatus } from "../constants/ticket";

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
