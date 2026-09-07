import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "../db";
import { Role } from "core/constants/role";
import { CLIENT_IP_HEADER } from "../middleware/client-ip";
import { getAllowedOrigins } from "./origins";

const DEFAULT_SECRET = "better-auth-secret-12345678901234567890";
const secret = process.env.BETTER_AUTH_SECRET;

if (!secret || secret === DEFAULT_SECRET) {
  throw new Error(
    "BETTER_AUTH_SECRET is missing or set to Better Auth's public default. " +
      "Generate one with `openssl rand -base64 32` and set it in server/.env.",
  );
}

if (secret.length < 32) {
  throw new Error(
    `BETTER_AUTH_SECRET is ${secret.length} characters long; it must be at least 32. ` +
      "Generate one with `openssl rand -base64 32`.",
  );
}

// Asserted for the same reason as the secret: Better Auth falls back to deriving the
// session cookie's Secure flag from this URL's scheme, so a missing or http:// value
// silently ships the session token over plaintext.
const baseURL = process.env.BETTER_AUTH_URL;

if (!baseURL) {
  throw new Error(
    "BETTER_AUTH_URL is not set — copy .env.example to server/.env. It is the origin " +
      "Better Auth issues cookies and callback URLs for.",
  );
}

let parsedBaseURL: URL;

try {
  parsedBaseURL = new URL(baseURL);
} catch {
  throw new Error(`BETTER_AUTH_URL is not a valid URL: ${baseURL}`);
}

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
const isLocal = LOCAL_HOSTNAMES.has(parsedBaseURL.hostname);
const useSecureCookies = parsedBaseURL.protocol === "https:";

// Deliberately not keyed off NODE_ENV: a deployment that forgets to change it would
// otherwise hand out non-Secure cookies without a word.
if (!isLocal && !useSecureCookies) {
  throw new Error(
    `BETTER_AUTH_URL is "${baseURL}". Any non-local host must be https:// — the session ` +
      "cookie's Secure flag follows this scheme, and over http the token travels in the clear.",
  );
}

export const auth = betterAuth({
  secret,
  baseURL,
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: { enabled: true, disableSignUp: true },
  user: {
    additionalFields: {
      role: { type: "string", defaultValue: Role.Agent, input: false },
    },
  },

  // storage "database" rather than the default "memory": in-process counters reset on
  // every `bun --hot` reload and every deploy, and would be per-replica behind a load
  // balancer — a brute-force budget that resets itself is not a limit.
  rateLimit: { enabled: true, storage: "database" },
  // Better Auth calls this once at context creation with no request — which `bun run
  // db:seed` triggers, and seeding has no HTTP layer to configure origins for — and then
  // again for every request. Resolving only in the request case keeps the invariant where
  // it counts: a deployment with no CORS_ORIGINS fails loudly on the first call instead of
  // quietly running with a CSRF allowlist containing nothing but BETTER_AUTH_URL.
  trustedOrigins: (request) => (request ? getAllowedOrigins() : []),
  advanced: {
    useSecureCookies,
    // Read only the header middleware/client-ip.ts writes. The default is
    // `x-forwarded-for`, which is caller-controlled and makes the limiter's per-IP
    // buckets trivially skippable.
    ipAddress: { ipAddressHeaders: [CLIENT_IP_HEADER] },
  },
});
