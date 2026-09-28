import { cn } from "cn";
import type { TicketDetail, TicketReply } from "core/schemas/tickets";

import TicketReplyForm from "@/components/tickets/TicketReplyForm";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format-date";

type Entry = {
  key: string;
  author: string;
  body: string;
  at: string;
  isRequester: boolean;
  isInternal: boolean;
};

/** The requester's original email is entry one; it lives on the ticket, not in the replies. */
function entries(ticket: TicketDetail): Entry[] {
  const original: Entry = {
    key: "original",
    author: ticket.requesterEmail,
    body: ticket.body,
    at: ticket.createdAt,
    isRequester: true,
    isInternal: false,
  };

  return [
    original,
    ...ticket.replies.map((reply: TicketReply) => ({
      key: reply.id,
      // The snapshotted name, so a reply still says who wrote it after that account is deleted.
      author: reply.author?.name ?? reply.authorName,
      body: reply.body,
      at: reply.createdAt,
      isRequester: false,
      isInternal: reply.isInternal,
    })),
  ];
}

function ConversationEntry({ entry }: { entry: Entry }) {
  return (
    <li
      className={cn(
        "rounded-lg p-4",
        entry.isInternal
          ? "border border-dashed border-border bg-muted"
          : entry.isRequester
            ? "bg-muted/50"
            : "border border-border bg-card",
      )}
    >
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="min-w-0 truncate text-sm font-medium text-foreground">
          {entry.author}
        </span>
        {entry.isInternal && (
          <Badge variant="secondary" className="shrink-0">
            Internal note
          </Badge>
        )}
        <time dateTime={entry.at} className="ml-auto shrink-0 text-xs text-muted-foreground">
          {formatDateTime(entry.at)}
        </time>
      </div>
      <p className="mt-2 text-sm leading-relaxed break-words whitespace-pre-wrap text-foreground">
        {entry.body}
      </p>
    </li>
  );
}

/**
 * The ticket's thread: the email that opened it, then every reply, then the composer.
 * Bodies are plain text — never HTML, whatever the inbound email contained.
 */
export default function TicketConversation({
  ticket,
  headingId,
}: {
  ticket: TicketDetail;
  headingId: string;
}) {
  return (
    <section aria-labelledby={headingId}>
      <h3
        id={headingId}
        className="text-[0.6875rem] font-semibold tracking-wider text-muted-foreground uppercase"
      >
        Conversation
      </h3>

      <ol className="mt-2 space-y-3">
        {entries(ticket).map((entry) => (
          <ConversationEntry key={entry.key} entry={entry} />
        ))}
      </ol>

      <TicketReplyForm ticket={ticket} />
    </section>
  );
}
