import type { RequestHandler } from "express";

/** Private header Better Auth reads the client IP from. Never trusted from the caller. */
export const CLIENT_IP_HEADER = "x-client-ip";

/**
 * Better Auth resolves the client IP from request headers only, and with no
 * `advanced.ipAddress.trustedProxies` configured it accepts a single-value
 * `X-Forwarded-For` verbatim — so an attacker who varies that header gets a fresh
 * rate-limit bucket per request and never trips the sign-in limit.
 *
 * This overwrites our own header on every request (Better Auth is pointed at it in
 * lib/auth.ts), so the value always comes from Express: the socket address, or the
 * forwarded hops TRUST_PROXY explicitly vouches for. Mount it above the auth handler.
 */
export const clientIp: RequestHandler = (req, _res, next) => {
  const ip = req.ip ?? req.socket.remoteAddress;

  // Delete rather than leave a caller-supplied value in place when we have nothing.
  if (ip) req.headers[CLIENT_IP_HEADER] = ip;
  else delete req.headers[CLIENT_IP_HEADER];

  next();
};
