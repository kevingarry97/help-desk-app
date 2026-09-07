import { AlertCircle } from "lucide-react";

type Props = {
  message?: string;
  error?: unknown;
  fallback?: string;
};

const GENERIC = "Something went wrong. Please try again.";

/**
 * Pulls the most useful string out of a thrown value. An AxiosError's own `.message` is
 * the generic "Request failed with status code 400", so the server's body is checked
 * first — this API puts its text in `{ error: "..." }` (see server/src/index.ts).
 */
function extract(error: unknown): string | undefined {
  if (!error) return undefined;
  if (typeof error === "string") return error;
  if (typeof error !== "object") return undefined;

  const response = (error as { response?: { data?: unknown } }).response;
  const data = response?.data;

  if (typeof data === "string" && data) return data;

  if (data && typeof data === "object") {
    const body = data as { error?: unknown; message?: unknown };
    if (typeof body.error === "string" && body.error) return body.error;
    if (typeof body.message === "string" && body.message) return body.message;
  }

  const message = (error as { message?: unknown }).message;
  return typeof message === "string" && message ? message : undefined;
}

export default function ErrorAlert({ message, error, fallback }: Props) {
  // Never render nothing when there is an error to report — a silently swallowed
  // failure looks to the user like the action simply did nothing.
  const text = message ?? (error ? (extract(error) ?? fallback ?? GENERIC) : undefined);
  if (!text) return null;

  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" />
      <span>{text}</span>
    </div>
  );
}
