import { useId, useState, type ReactNode } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { FileQuestion } from "lucide-react";
import { cn } from "cn";

import ErrorAlert from "@/components/ErrorAlert";
import TicketCategoryTag from "@/components/tickets/TicketCategoryTag";
import TicketStatusBadge from "@/components/tickets/TicketStatusBadge";
import { useTicket } from "@/hooks/use-tickets";
import { formatDateTime } from "@/lib/format-date";
import { ticketReference } from "@/lib/ticket-reference";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";

function statusOf(error: unknown): number | undefined {
  return (error as { response?: { status?: number } } | null)?.response?.status;
}

function openedFromList(state: unknown): boolean {
  return (state as { fromList?: unknown } | null)?.fromList === true;
}

function Meta({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-[0.6875rem] font-semibold tracking-wider text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="mt-1 truncate text-sm text-foreground">{children}</dd>
    </div>
  );
}

function LoadingBody() {
  return (
    <>
      <SheetHeader className="gap-3 border-b border-border p-6">
        <SheetTitle className="sr-only">Loading ticket</SheetTitle>
        <Skeleton className="h-5 w-24 rounded-full" />
        <Skeleton className="h-6 w-4/5" />
      </SheetHeader>
      <div className="space-y-6 p-6">
        <div className="grid grid-cols-2 gap-4">
          {[0, 1, 2, 3].map((cell) => (
            <div key={cell} className="space-y-1.5">
              <Skeleton className="h-2.5 w-14" />
              <Skeleton className="h-4 w-32" />
            </div>
          ))}
        </div>
        <div className="space-y-2.5">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-3/5" />
        </div>
      </div>
    </>
  );
}

export default function TicketDetailSheet() {
  const { id = "" } = useParams();
  const { search, state } = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);
  const messageHeadingId = useId();

  const { data: ticket, isPending, isError, error } = useTicket(id);
  const notFound = isError && statusOf(error) === 404;

  // Opened from a row: step back, so Back after closing doesn't reopen it. Opened from a link:
  // replace, so the list takes its place in history. Either way the filters survive in `search`.
  const leave = () => {
    if (openedFromList(state)) navigate(-1);
    else navigate({ pathname: "/tickets", search }, { replace: true });
  };

  return (
    <Sheet
      open={open}
      onOpenChange={setOpen}
      onOpenChangeComplete={(isOpen) => {
        if (!isOpen) leave();
      }}
    >
      <SheetContent
        side="right"
        className="gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-xl"
      >
        {isPending && <LoadingBody />}

        {notFound && (
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <FileQuestion className="size-8 text-muted-foreground/50" />
            <SheetTitle className="mt-3 text-base font-semibold">Ticket not found</SheetTitle>
            <SheetDescription className="mt-1">
              It may have been removed, or the link is wrong.
            </SheetDescription>
          </div>
        )}

        {isError && !notFound && (
          <div className="space-y-4 p-6 pr-14">
            <SheetTitle className="text-base font-semibold">Couldn't load this ticket</SheetTitle>
            <ErrorAlert error={error} fallback="Failed to load this ticket." />
          </div>
        )}

        {ticket && (
          <>
            <SheetHeader className="gap-3 border-b border-border p-6 pr-14">
              <div className="flex items-center gap-3">
                <TicketStatusBadge status={ticket.status} />
                <span className="text-sm font-medium tracking-wide text-muted-foreground tabular-nums">
                  {ticketReference(ticket.id)}
                </span>
              </div>
              <SheetTitle className="text-xl leading-snug font-semibold tracking-tight break-words">
                {ticket.subject}
              </SheetTitle>
              <SheetDescription className="sr-only">
                Ticket {ticketReference(ticket.id)} from {ticket.requesterEmail}
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 space-y-6 overflow-y-auto p-6">
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
                <Meta label="From" className="col-span-2 sm:col-span-1">
                  <a
                    href={`mailto:${ticket.requesterEmail}`}
                    className="text-brand-700 hover:underline"
                    title={ticket.requesterEmail}
                  >
                    {ticket.requesterEmail}
                  </a>
                </Meta>
                <Meta label="Category">
                  <TicketCategoryTag category={ticket.category} />
                </Meta>
                <Meta label="Received">
                  <time dateTime={ticket.createdAt}>{formatDateTime(ticket.createdAt)}</time>
                </Meta>
                <Meta label="Last updated">
                  <time dateTime={ticket.updatedAt}>{formatDateTime(ticket.updatedAt)}</time>
                </Meta>
              </dl>

              <section aria-labelledby={messageHeadingId}>
                <h3
                  id={messageHeadingId}
                  className="text-[0.6875rem] font-semibold tracking-wider text-muted-foreground uppercase"
                >
                  Message
                </h3>
                <p className="mt-2 rounded-lg bg-muted/50 p-4 text-sm leading-relaxed break-words whitespace-pre-wrap text-foreground">
                  {ticket.body}
                </p>
              </section>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
