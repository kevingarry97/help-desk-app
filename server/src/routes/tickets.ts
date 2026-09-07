import { Router } from "express";
import { createTicketSchema, updateTicketSchema } from "core/schemas/tickets";

import { prisma } from "../db";
import { isRecordNotFound } from "../lib/prisma-errors";
import { validate } from "../lib/validate";
import { requireAuth } from "../middleware/require-auth";

export const ticketsRouter = Router();

// Every ticket route needs a session; agents manage tickets, so no role check beyond it.
ticketsRouter.use(requireAuth);

ticketsRouter.get("/", async (_req, res) => {
  const tickets = await prisma.ticket.findMany({ orderBy: { createdAt: "desc" } });
  res.json(tickets);
});

ticketsRouter.post("/", async (req, res) => {
  const result = validate(createTicketSchema, req.body, res);
  if (!result.ok) return;

  const ticket = await prisma.ticket.create({ data: result.data });
  res.status(201).json(ticket);
});

ticketsRouter.patch("/:id", async (req, res) => {
  const result = validate(updateTicketSchema, req.body, res);
  if (!result.ok) return;

  try {
    const ticket = await prisma.ticket.update({
      where: { id: req.params.id },
      data: result.data,
    });
    res.json(ticket);
  } catch (error) {
    // Only "no such row" is a 404. Everything else — a dropped connection, an exhausted
    // pool — goes to errorHandler, which logs it and answers 500, rather than being
    // laundered into a clean 404 that no one investigates.
    if (!isRecordNotFound(error)) throw error;

    res.status(404).json({ error: `No ticket with id ${req.params.id}` });
  }
});
