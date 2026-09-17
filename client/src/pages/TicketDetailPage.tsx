import { Link, useLocation, useParams } from "react-router";
import { ArrowLeft, FileQuestion } from "lucide-react";

import ErrorAlert from "@/components/ErrorAlert";
import TicketCategoryTag from "@/components/tickets/TicketCategoryTag";
import TicketStatusBadge from "@/components/tickets/TicketStatusBadge";
import { useTicket } from "@/hooks/use-tickets";
import { formatDateTime } from "@/lib/format-date";
import { ticketReference } from "@/lib/ticket-reference";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function listSearchFrom(state: unknown): string {
  const search = (state as { listSearch?: unknown } | null)?.listSearch;
  return typeof search === "string" && search.startsWith("?") ? search : "";
}

function statusOf(error: unknown): number | undefined {
  return (error as { response?: { status?: number } } | null)?.response?.status;
}

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-7 w-2/3" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="space-y-2.5 rounded-xl bg-card p-6 ring-1 ring-foreground/10">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-11/12" />
        <Skeleton className="h-4 w-3/5" />
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <div className="rounded-xl bg-card px-6 py-16 text-center ring-1 ring-foreground/10">
      <FileQuestion className="mx-auto size-8 text-muted-foreground/50" />
      <h1 className="mt-3 text-base font-semibold text-foreground">Ticket not found</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        It may have been removed, or the link is wrong.
      </p>
    </div>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[0.6875rem] font-semibold tracking-wider text-surface-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="mt-0.5 truncate text-sm text-foreground">{children}</dd>
    </div>
  );
}

export default function TicketDetailPage() {
  const { id = "" } = useParams();
  const { state } = useLocation();
  const { data: ticket, isPending, isError, error } = useTicket(id);

  const notFound = isError && statusOf(error) === 404;

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        to={`/tickets${listSearchFrom(state)}`}
        className="inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-surface-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <ArrowLeft className="size-4" />
        All tickets
      </Link>

      <div className="mt-6">
        {isPending && <DetailSkeleton />}

        {notFound && <NotFound />}

        {isError && !notFound && (
          <ErrorAlert error={error} fallback="Failed to load this ticket." />
        )}

        {ticket && (
          <article className="space-y-6">
            <header>
              <div className="flex items-center gap-3">
                <TicketStatusBadge status={ticket.status} />
                <span className="text-sm font-medium tracking-wide text-surface-muted-foreground tabular-nums">
                  {ticketReference(ticket.id)}
                </span>
              </div>
              <h1 className="mt-3 text-2xl font-bold tracking-tight break-words text-foreground">
                {ticket.subject}
              </h1>

              <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
                <Meta label="From">
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
            </header>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">Message</CardTitle>
              </CardHeader>
              <CardContent>
                {/* Plain text, as it arrived: keep the sender's line breaks, and wrap long
                    unbroken strings (URLs, IDs) instead of stretching the card. */}
                <p className="text-sm leading-relaxed break-words whitespace-pre-wrap text-foreground">
                  {ticket.body}
                </p>
              </CardContent>
            </Card>
          </article>
        )}
      </div>
    </div>
  );
}
