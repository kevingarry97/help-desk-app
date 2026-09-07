import { AlertCircle } from "lucide-react";

type Props = {
  message?: string;
  error?: unknown;
  fallback?: string;
};

function extract(error: unknown): string | undefined {
  if (!error) return undefined;
  if (typeof error === "string") return error;
  if (typeof error === "object" && error !== null) {
    const maybe = error as { message?: unknown };
    if (typeof maybe.message === "string" && maybe.message) return maybe.message;
  }
  return undefined;
}

export default function ErrorAlert({ message, error, fallback }: Props) {
  const text = message ?? extract(error) ?? (error ? fallback : undefined);
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
