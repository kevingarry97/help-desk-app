import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { request, type FullConfig } from "@playwright/test";

import { ADMIN, AGENT, BASE_URL, STORAGE_STATE, serverEnv } from "./test-env";

function runInServer(serverDir: string, command: string, args: string[]) {
  execFileSync(command, args, {
    cwd: serverDir,
    env: { ...process.env, ...serverEnv },
    stdio: "inherit",
  });
}

async function saveSignedInState(account: typeof ADMIN | typeof AGENT, statePath: string) {
  const context = await request.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: { origin: BASE_URL },
  });

  const response = await context.post("/api/auth/sign-in/email", {
    data: { email: account.email, password: account.password },
  });

  if (!response.ok()) {
    throw new Error(
      `E2E sign-in failed for ${account.email}: ${response.status()} ${await response.text()}`,
    );
  }

  await context.storageState({ path: statePath });
  await context.dispose();
}

export default async function globalSetup(config: FullConfig) {
  const repoRoot = config.configFile ? path.dirname(config.configFile) : process.cwd();
  const serverDir = path.join(repoRoot, "server");

  if (!existsSync(path.join(serverDir, "generated/prisma/client.ts"))) {
    runInServer(serverDir, "bunx", ["--bun", "prisma", "generate"]);
  }

  runInServer(serverDir, "bun", ["run", "db:test:create"]);
  runInServer(serverDir, "bun", ["run", "db:test:migrate"]);
  runInServer(serverDir, "bun", ["run", "db:test:seed"]);

  mkdirSync(path.join(repoRoot, "e2e/.auth"), { recursive: true });

  await saveSignedInState(ADMIN, path.join(repoRoot, STORAGE_STATE.admin));
  await saveSignedInState(AGENT, path.join(repoRoot, STORAGE_STATE.agent));

  // Hand the specs a full sign-in budget rather than the zero these two just left, so a
  // retried login spec fails on its own merits instead of on a 429.
  runInServer(serverDir, "bun", ["prisma/test-db.ts", "reset-rate-limits"]);
}
