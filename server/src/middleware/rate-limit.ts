import { rateLimit } from "express-rate-limit";

const shared = {
  windowMs: 60_000,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skip: (req: { method: string }) => req.method === "OPTIONS",
} as const;

export const apiLimiter = rateLimit({
  ...shared,
  limit: 300,
  message: { error: "Too many requests" },
});

export const authLimiter = rateLimit({
  ...shared,
  limit: 120,
  message: { error: "Too many authentication requests" },
});
