import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "../db";

// Sessions land in the `session` table because a database adapter is configured and no
// secondaryStorage or cookie cache is — that default is what makes these database sessions.
// `secret` and `baseURL` come from BETTER_AUTH_SECRET / BETTER_AUTH_URL.
export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: { enabled: true },
  trustedOrigins: ["http://localhost:5173"],
});
