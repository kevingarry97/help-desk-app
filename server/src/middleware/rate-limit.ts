import { rateLimit } from "express-rate-limit";

const shared = {
  windowMs: 60_000,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skip: (req: { method: string }) => req.method === "OPTIONS",
} as const;

function limitFrom(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export const apiLimiter = rateLimit({
  ...shared,
  limit: limitFrom(process.env.RATE_LIMIT_API_MAX, 300),
  message: { error: "Too many requests" },
});

export const authLimiter = rateLimit({
  ...shared,
  limit: limitFrom(process.env.RATE_LIMIT_AUTH_MAX, 120),
  message: { error: "Too many authentication requests" },
});
