import express from "express";
import { prisma } from "./db";
import { TicketCategory, TicketStatus } from "../generated/prisma/enums";

const app = express();
const port = Number(process.env.PORT ?? 4000);

app.use(express.json());

/** Health check that proves the database is actually reachable, not just that the process is up. */
app.get("/api/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", uptime: process.uptime(), database: "connected" });
  } catch (error) {
    console.error("Health check failed:", error);
    res
      .status(503)
      .json({ status: "degraded", uptime: process.uptime(), database: "unreachable" });
  }
});

app.get("/api/tickets", async (_req, res) => {
  const tickets = await prisma.ticket.findMany({ orderBy: { createdAt: "desc" } });
  res.json(tickets);
});

app.post("/api/tickets", async (req, res) => {
  const { subject, body, requesterEmail, category } = req.body ?? {};

  if (!subject || !body || !requesterEmail) {
    res
      .status(400)
      .json({ error: "subject, body and requesterEmail are required" });
    return;
  }

  const ticket = await prisma.ticket.create({
    data: {
      subject,
      body,
      requesterEmail,
      category: category ?? TicketCategory.GENERAL_QUESTION,
    },
  });

  res.status(201).json(ticket);
});

app.patch("/api/tickets/:id", async (req, res) => {
  const { status } = req.body ?? {};

  if (!status || !(status in TicketStatus)) {
    res
      .status(400)
      .json({ error: `status must be one of ${Object.keys(TicketStatus).join(", ")}` });
    return;
  }

  try {
    const ticket = await prisma.ticket.update({
      where: { id: req.params.id },
      data: { status },
    });
    res.json(ticket);
  } catch {
    res.status(404).json({ error: `No ticket with id ${req.params.id}` });
  }
});

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
