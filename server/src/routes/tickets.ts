import { Router } from "express";
import {
  assignTicketSchema,
  createReplySchema,
  createTicketSchema,
  ticketListQuerySchema,
  updateTicketSchema,
} from "core/schemas/tickets";
import { Role } from "core/constants/role";
import { TicketStatus } from "core/constants/ticket";

import { prisma } from "../db";
import { isForeignKeyViolation, isRecordNotFound } from "../lib/prisma-errors";
import { groupPage, groupStatuses } from "../lib/ticket-groups";
import { ticketListOrderBy } from "../lib/ticket-order";
import { TICKET_DETAIL_SELECT, TICKET_LIST_SELECT } from "../lib/ticket-select";
import { ticketListWhere } from "../lib/ticket-where";
import { validate } from "../lib/validate";
import { requireAuth } from "../middleware/require-auth";
import { requireRole } from "../middleware/require-role";

export const ticketsRouter = Router();

const ASSIGNEE_GONE = "That user no longer exists.";

ticketsRouter.use(requireAuth);

ticketsRouter.get("/", async (req, res) => {
  const result = validate(ticketListQuerySchema, req.query, res, "query");
  if (!result.ok) return;

  const tickets = await prisma.ticket.findMany({
    where: ticketListWhere(result.data, req.user!.id),
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
      const where = ticketListWhere({ ...query, status }, req.user!.id);
      const total = await prisma.ticket.count({ where });
      const { page, skip, take } = groupPage(query, status, total);
      const tickets = await prisma.ticket.findMany({ where, select: TICKET_LIST_SELECT, orderBy, skip, take });

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

  const ticket = await prisma.ticket.create({ data: result.data, select: TICKET_DETAIL_SELECT });
  res.status(201).json(ticket);
});

ticketsRouter.patch<{ id: string }>("/:id", requireRole(Role.Admin), async (req, res) => {
  const result = validate(updateTicketSchema, req.body, res);
  if (!result.ok) return;

  try {
    const ticket = await prisma.ticket.update({
      where: { id: req.params.id },
      data: result.data,
      select: TICKET_DETAIL_SELECT,
    });
    res.json(ticket);
  } catch (error) {
    if (!isRecordNotFound(error)) throw error;

    res.status(404).json({ error: `No ticket with id ${req.params.id}` });
  }
});

ticketsRouter.patch<{ id: string }>("/:id/assignee", requireRole(Role.Admin), async (req, res) => {
  const result = validate(assignTicketSchema, req.body, res);
  if (!result.ok) return;

  const { assigneeId } = result.data;

  if (assigneeId) {
    const assignee = await prisma.user.findUnique({ where: { id: assigneeId }, select: { id: true } });

    if (!assignee) {
      res.status(409).json({ error: ASSIGNEE_GONE });
      return;
    }
  }

  try {
    const ticket = await prisma.ticket.update({
      where: { id: req.params.id },
      data: { assigneeId },
      select: TICKET_DETAIL_SELECT,
    });
    res.json(ticket);
  } catch (error) {
    // Checked before the foreign key: when both are gone, the missing ticket is the better answer.
    if (isRecordNotFound(error)) {
      res.status(404).json({ error: `No ticket with id ${req.params.id}` });
      return;
    }

    // The pre-check's race: the user was deleted while this request ran.
    if (isForeignKeyViolation(error)) {
      res.status(409).json({ error: ASSIGNEE_GONE });
      return;
    }

    throw error;
  }
});

/**
 * POST /api/tickets/:id/replies — answer a ticket, or leave an internal note.
 *
 * No `requireRole`: answering a requester is the agent's job, which is why this route is
 * open to everyone `requireAuth` lets through, unlike the triage and assignee PATCHes above.
 * `resolve` is the one status change an agent can make, and only as a consequence of their
 * own reply.
 */
ticketsRouter.post<{ id: string }>("/:id/replies", async (req, res) => {
  const result = validate(createReplySchema, req.body, res);
  if (!result.ok) return;

  const { body, isInternal, resolve } = result.data;
  const { id } = req.params;

  const exists = await prisma.ticket.findUnique({ where: { id }, select: { id: true } });

  if (!exists) {
    res.status(404).json({ error: `No ticket with id ${id}` });
    return;
  }

  try {
    // One transaction: resolving must not leave a ticket resolved with no reply explaining why.
    const ticket = await prisma.$transaction(async (tx) => {
      await tx.ticketReply.create({
        data: {
          ticketId: id,
          body,
          isInternal,
          // From the session, never the body — a caller cannot sign a reply as someone else.
          authorId: req.user!.id,
          authorName: req.user!.name,
        },
      });

      return tx.ticket.update({
        where: { id },
        data: resolve ? { status: TicketStatus.Resolved } : {},
        select: TICKET_DETAIL_SELECT,
      });
    });

    res.status(201).json(ticket);
  } catch (error) {
    // The pre-check's race: the ticket was deleted while this request ran.
    if (isRecordNotFound(error) || isForeignKeyViolation(error)) {
      res.status(404).json({ error: `No ticket with id ${id}` });
      return;
    }

    throw error;
  }
});
