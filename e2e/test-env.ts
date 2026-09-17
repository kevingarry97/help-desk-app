export const SERVER_PORT = Number(process.env.E2E_SERVER_PORT ?? 4001);
export const CLIENT_PORT = Number(process.env.E2E_CLIENT_PORT ?? 5174);

export const SERVER_URL = `http://localhost:${SERVER_PORT}`;
export const BASE_URL = `http://localhost:${CLIENT_PORT}`;

export const DATABASE_URL =
  process.env.E2E_DATABASE_URL ??
  "postgresql://helpdesk:helpdesk@localhost:5433/helpdesk_test?schema=public";

export const ADMIN = {
  email: "admin@e2e.test",
  password: "e2e-admin-password",
  name: "E2E Admin",
} as const;

export const AGENT = {
  email: "agent@e2e.test",
  password: "e2e-agent-password",
  name: "E2E Agent",
} as const;

/**
 * Bearer secret for POST /api/webhooks/inbound-email. E2E-only. Must be at least 32
 * characters: server/src/middleware/require-inbound-secret.ts refuses to boot on a shorter one.
 */
export const INBOUND_EMAIL_SECRET = "e2e-only-inbound-email-secret-not-for-any-deployment";

export const STORAGE_STATE = {
  admin: "e2e/.auth/admin.json",
  agent: "e2e/.auth/agent.json",
} as const;

export const serverEnv = {
  NODE_ENV: "test",
  PORT: String(SERVER_PORT),
  DATABASE_URL,
  BETTER_AUTH_URL: SERVER_URL,
  BETTER_AUTH_SECRET: "e2e-only-secret-not-for-any-deployment-000000",
  CORS_ORIGINS: `${BASE_URL},${SERVER_URL}`,
  TRUST_PROXY: "",
  ADMIN_EMAIL: ADMIN.email,
  ADMIN_PASSWORD: ADMIN.password,
  AGENT_EMAIL: AGENT.email,
  AGENT_PASSWORD: AGENT.password,
  INBOUND_EMAIL_SECRET,
  RATE_LIMIT_API_MAX: "100000",
  RATE_LIMIT_AUTH_MAX: "100000",
} satisfies Record<string, string>;

export const clientEnv = {
  VITE_API_URL: SERVER_URL,
} satisfies Record<string, string>;
