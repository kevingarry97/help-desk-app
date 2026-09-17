import { createHash, timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";

import { readSecret } from "../lib/env";

const secret = readSecret("INBOUND_EMAIL_SECRET");

const sha256 = (value: string) => createHash("sha256").update(value).digest();

export function secretMatches(header: string | undefined, expected: string): boolean {
  const match = header?.match(/^Bearer (.+)$/);
  if (!match) return false;

  return timingSafeEqual(sha256(match[1]), sha256(expected));
}

export const requireInboundSecret: RequestHandler = (req, res, next) => {
  if (!secret) {
    res.status(503).json({ error: "Inbound email is not configured" });
    return;
  }

  if (!secretMatches(req.headers.authorization, secret)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  next();
};
