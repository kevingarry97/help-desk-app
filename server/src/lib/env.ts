export const MIN_SECRET_LENGTH = 32;

type Env = Record<string, string | undefined>;

/**
 * Reads a secret from the environment and refuses to boot on one too short to be a real
 * secret. Called at module load, so a misconfigured deployment fails at startup rather than
 * on the first request that needs it.
 *
 * `required: true` returns a string or throws. Without it, an unset or empty secret returns
 * `undefined` — the feature it guards is off — but a set-and-short one still throws: that is
 * an attempt at configuration that went wrong, not a choice to leave the feature disabled.
 *
 * `env` is a parameter so tests can pass their own; callers leave it to `process.env`.
 */
export function readSecret(name: string, options: { required: true }, env?: Env): string;
export function readSecret(
  name: string,
  options?: { required?: false },
  env?: Env,
): string | undefined;
export function readSecret(
  name: string,
  { required = false }: { required?: boolean } = {},
  env: Env = process.env,
): string | undefined {
  const value = env[name];
  const generate = "Generate one with `openssl rand -base64 32`";

  if (!value) {
    if (required) throw new Error(`${name} is not set. ${generate} and set it in server/.env.`);
    return undefined;
  }

  if (value.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `${name} is ${value.length} characters long; it must be at least ${MIN_SECRET_LENGTH}. ` +
        (required ? `${generate}.` : `${generate}, or leave it empty to turn the feature off.`),
    );
  }

  return value;
}
