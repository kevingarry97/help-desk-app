import { Router } from "express";

import { prisma } from "../db";
import { requireAuth } from "../middleware/require-auth";

export const healthRouter = Router();

// Liveness only: no database work and nothing about the deployment. An unauthenticated
// endpoint that runs a query per request hands anyone a way to drain the connection pool.
healthRouter.get("/", (_req, res) => {
  res.json({ status: "ok" });
});

// Uptime and database reachability are operational detail — they date restarts and
// confirm outages — so they need a session.
healthRouter.get("/details", requireAuth, async (_req, res) => {
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
