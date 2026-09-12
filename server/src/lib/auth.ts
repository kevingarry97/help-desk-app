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

  rateLimit: { enabled: true, storage: "database" },
  trustedOrigins: (request) => (request ? getAllowedOrigins() : []),
  advanced: {
    useSecureCookies,
    ipAddress: { ipAddressHeaders: [CLIENT_IP_HEADER] },
  },
});
