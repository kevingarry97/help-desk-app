import type {
  TicketCategory as PrismaTicketCategory,
  TicketStatus as PrismaTicketStatus,
} from "../../generated/prisma/enums";
import type { TicketCategory, TicketStatus } from "core/constants/ticket";

/**
 * Compile-time only, and deliberately imported by nothing: tsc still checks every file
 * under src, so this fails `bun run typecheck` the moment core/constants/ticket.ts and
 * the Prisma enums disagree. core's copies exist so the client can share the ticket
 * schemas, and they are what `prisma.ticket.create` ultimately receives — a value in one
 * and not the other would only surface as a runtime enum error from Postgres.
 */
type Equals<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Assert<T extends true> = T;

export type StatusParity = Assert<Equals<TicketStatus, PrismaTicketStatus>>;
export type CategoryParity = Assert<Equals<TicketCategory, PrismaTicketCategory>>;
