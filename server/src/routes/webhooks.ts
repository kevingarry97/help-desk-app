import express, { Router } from "express";
import { inboundEmailSchema } from "core/schemas/inbound-email";

import { prisma } from "../db";
import { toTicketData } from "../lib/inbound-email";
import { validate } from "../lib/validate";
import { requireInboundSecret } from "../middleware/require-inbound-secret";

export const webhooksRouter = Router();

// Mounted above the app-wide express.json() in index.ts: its 100kb default would answer
// 413 to an ordinary HTML email before this router saw it. The secret is checked first so
// only an authenticated caller gets a 2mb body read.
webhooksRouter.post(
  "/inbound-email",
  requireInboundSecret,
  express.json({ limit: "2mb" }),
  async (req, res) => {
    const result = validate(inboundEmailSchema, req.body, res);
    if (!result.ok) return;

    const data = toTicketData(result.data);

    // Webhooks are delivered at least once. A redelivery answers 2xx with the ticket it
    // already made, so the sender stops retrying; two copies racing past this check meet
    // the unique index, and errorHandler answers the loser 409.
    if (data.messageId) {
      const existing = await prisma.ticket.findUnique({
        where: { messageId: data.messageId },
        select: { id: true },
      });

      if (existing) {
        res.json({ id: existing.id, duplicate: true });
        return;
      }
    }

    const ticket = await prisma.ticket.create({ data, select: { id: true } });
    res.status(201).json({ id: ticket.id });
  },
);
