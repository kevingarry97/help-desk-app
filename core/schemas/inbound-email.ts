import { z } from "zod/v4";

export function extractAddress(from: string): string {
  const bracketed = from.match(/<([^<>]*)>[^<>]*$/);
  return (bracketed ? bracketed[1] : from).trim().toLowerCase();
}

export const inboundEmailSchema = z.object({
  from: z.string().trim().max(998).transform(extractAddress).pipe(z.email().max(320)),
  subject: z.string().max(10_000).nullish(),
  text: z.string().max(1_000_000).nullish(),
  html: z.string().max(1_000_000).nullish(),
  messageId: z.string().max(998).nullish(),
});

export type InboundEmailInput = z.infer<typeof inboundEmailSchema>;
