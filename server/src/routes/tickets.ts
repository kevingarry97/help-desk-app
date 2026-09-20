import { Router } from "express";
import { createTicketSchema, ticketListQuerySchema, updateTicketSchema } from "core/schemas/tickets";

import { prisma } from "../db";
import { isRecordNotFound } from "../lib/prisma-errors";
import { groupPage, groupStatuses } from "../lib/ticket-groups";
import { ticketListOrderBy } from "../lib/ticket-order";
import { TICKET_DETAIL_SELECT, TICKET_LIST_SELECT } from "../lib/ticket-select";
import { ticketListWhere } from "../lib/ticket-where";
import { validate } from "../lib/validate";
import { requireAuth } from "../middleware/require-auth";

export const ticketsRouter = Router();

ticketsRouter.use(requireAuth);

ticketsRouter.get("/", async (req, res) => {
  const result = validate(ticketListQuerySchema, req.query, res, "query");
  if (!result.ok) return;

  const tickets = await prisma.ticket.findMany({
    where: ticketListWhere(result.data),
    select: TICKET_LIST_SELECT,
    orderBy: ticketListOrderBy(result.data),
  });

  res.json(tickets);
});

ticketsRouter.get("/by-status", async (req, res) => {
  const result = validate(ticketListQuerySchema, req.query, res, "query");
  if (!result.ok) return;

  const query = result.data;
  const orderBy = ticketListOrderBy(query);

  const groups = await Promise.all(
    groupStatuses(query).map(async (status) => {
      const where = ticketListWhere({ ...query, status });
      const total = await prisma.ticket.count({ where });
      const { page, skip, take } = groupPage(query, status, total);
      const tickets = await prisma.ticket.findMany({ where, select: TICKET_LIST_SELECT, orderBy, skip: 0, take });

      return { status, total, page, pageSize: take, tickets };
    }),
  );

  res.json({ groups });
});

ticketsRouter.get("/:id", async (req, res) => {
  const ticket = await prisma.ticket.findUnique({
    where: { id: req.params.id },
    select: TICKET_DETAIL_SELECT,
  });

  if (!ticket) {
    res.status(404).json({ error: `No ticket with id ${req.params.id}` });
    return;
  }

  res.json(ticket);
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
    if (!isRecordNotFound(error)) throw error;

    res.status(404).json({ error: `No ticket with id ${req.params.id}` });
  }
});
