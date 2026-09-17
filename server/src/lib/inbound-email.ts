import type { InboundEmailInput } from "core/schemas/inbound-email";

export const SUBJECT_MAX = 200;

export const BODY_MAX = 50_000;

export const NO_SUBJECT = "(no subject)";
export const NO_BODY = "(no message body)";
export const TRUNCATED_MARKER = "\n\n[message truncated]";

const ENTITIES: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

function decodeEntity(match: string, name: string): string {
  if (name[0] !== "#") return ENTITIES[name.toLowerCase()] ?? match;

  const hex = name[1] === "x" || name[1] === "X";
  const codePoint = Number.parseInt(name.slice(hex ? 2 : 1), hex ? 16 : 10);

  return Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
    ? String.fromCodePoint(codePoint)
    : match;
}

export function htmlToText(html: string): string {
  return (
    html
      .replace(/<(script|style|head)\b[\s\S]*?<\/\1\s*>/gi, "")
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/\s+/g, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|tr|h[1-6]|blockquote)\s*>/gi, "\n")
      .replace(/<[^>]*>/g, "")
      .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, decodeEntity)
      .split("\n")
      .map((line) => line.trim())
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

function truncate(value: string, max: number, marker = ""): string {
  return value.length > max ? value.slice(0, max) + marker : value;
}

export function normalizeMessageId(messageId: string | null | undefined): string | null {
  const bare = messageId?.trim().replace(/^<(.*)>$/, "$1").trim();
  return bare ? bare : null;
}

export type InboundTicketData = {
  subject: string;
  body: string;
  requesterEmail: string;
  messageId: string | null;
};

export function toTicketData(email: InboundEmailInput): InboundTicketData {
  const subject = (email.subject ?? "").replace(/\s+/g, " ").trim();
  const text = (email.text ?? "").trim();
  const body = text || htmlToText(email.html ?? "");

  return {
    subject: truncate(subject || NO_SUBJECT, SUBJECT_MAX),
    body: truncate(body || NO_BODY, BODY_MAX, TRUNCATED_MARKER),
    requesterEmail: email.from,
    messageId: normalizeMessageId(email.messageId),
  };
}
