import { useMemo } from "react";
import { Role } from "core/constants/role";
import type { TicketAssignee as Assignee } from "core/schemas/tickets";

import ErrorAlert from "@/components/ErrorAlert";
import { useAssignTicket } from "@/hooks/use-tickets";
import { useUsers } from "@/hooks/use-users";
import { useSession } from "@/lib/auth-client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

const UNASSIGNED = "none";

const UNASSIGNED_LABEL = "Unassigned";

/**
 * Who owns a ticket. Agents read it; only admins can change it, which mirrors
 * `requireRole(Role.Admin)` on PATCH /api/tickets/:id/assignee — this decides what renders, the
 * server decides what is allowed.
 */
export default function TicketAssignee({
  ticketId,
  assignee,
  headingId,
}: {
  ticketId: string;
  assignee: Assignee | null;
  headingId: string;
}) {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === Role.Admin;

  return (
    <section aria-labelledby={headingId}>
      <h3
        id={headingId}
        className="text-[0.6875rem] font-semibold tracking-wider text-muted-foreground uppercase"
      >
        Assignee
      </h3>

      {isAdmin ? (
        <AssigneePicker ticketId={ticketId} assignee={assignee} labelledBy={headingId} />
      ) : (
        <p className="mt-2 text-sm text-foreground">{assignee?.name ?? UNASSIGNED_LABEL}</p>
      )}
    </section>
  );
}

function AssigneePicker({
  ticketId,
  assignee,
  labelledBy,
}: {
  ticketId: string;
  assignee: Assignee | null;
  labelledBy: string;
}) {
  const { data: users, isPending, isError, error } = useUsers();
  const assign = useAssignTicket(ticketId);

  // Base UI reads the trigger's text from here, so without it the trigger shows the raw id.
  const items = useMemo(() => {
    const byId: Record<string, string> = { [UNASSIGNED]: UNASSIGNED_LABEL };
    for (const user of users ?? []) byId[user.id] = user.name;
    return byId;
  }, [users]);

  if (isPending) return <Skeleton className="mt-2 h-9 w-full rounded-lg" />;

  if (isError) {
    return (
      <div className="mt-2">
        <ErrorAlert error={error} fallback="Couldn't load the list of people." />
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-2">
      <ErrorAlert error={assign.error} fallback="Couldn't change the assignee. Please try again." />

      <Select
        items={items}
        value={assignee?.id ?? UNASSIGNED}
        disabled={assign.isPending}
        onValueChange={(next) => {
          const assigneeId = next === UNASSIGNED ? null : (next as string);
          if (assigneeId !== (assignee?.id ?? null)) assign.mutate(assigneeId);
        }}
      >
        <SelectTrigger aria-labelledby={labelledBy} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={UNASSIGNED}>{UNASSIGNED_LABEL}</SelectItem>
          {users.map((user) => (
            <SelectItem key={user.id} value={user.id}>
              {user.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
