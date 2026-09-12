import { useState } from "react";
import { Users } from "lucide-react";
import type { UserListItem } from "core/schemas/users";

import ErrorAlert from "@/components/ErrorAlert";
import CreateUserSheet from "@/components/users/CreateUserSheet";
import DeleteUserDialog from "@/components/users/DeleteUserDialog";
import EditUserSheet from "@/components/users/EditUserSheet";
import UsersTable from "@/components/users/UsersTable";
import { USER_GRID } from "@/components/users/UserRow";
import { useReorderUsers, useUsers } from "@/hooks/use-users";
import { useSession } from "@/lib/auth-client";
import { Skeleton } from "@/components/ui/skeleton";

function useUserDialog() {
  const [user, setUser] = useState<UserListItem | null>(null);
  const [open, setOpen] = useState(false);

  const show = (next: UserListItem) => {
    setUser(next);
    setOpen(true);
  };

  return { user, open, show, setOpen };
}

function TableSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
      <div className="h-11 border-b border-border bg-muted/40" />
      {[0, 1, 2, 3].map((row) => (
        <div key={row} className={`${USER_GRID} h-[4.5rem] border-b border-border last:border-b-0`}>
          <Skeleton className="size-4" />
          <Skeleton className="size-7 rounded-md" />
          <div className="flex items-center gap-3">
            <Skeleton className="hidden size-10 rounded-full sm:block" />
            <div className="space-y-1.5">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-3 w-44" />
            </div>
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="hidden h-3.5 w-20 sm:block" />
          <Skeleton className="size-7 rounded-md" />
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl bg-card px-6 py-16 text-center ring-1 ring-foreground/10">
      <Users className="mx-auto size-8 text-muted-foreground/50" />
      <p className="mt-3 text-sm font-medium text-foreground">No users yet</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Use “New user” to add the first account.
      </p>
    </div>
  );
}

export default function UsersPage() {
  const { data: users, isPending, isError, error } = useUsers();
  const reorder = useReorderUsers();
  const { data: session } = useSession();
  const editing = useUserDialog();
  const deleting = useUserDialog();

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Users</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Everyone with access to the helpdesk. Drag a row by its handle to change the
            order.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {reorder.isPending && (
            <span className="text-xs text-muted-foreground">Saving order…</span>
          )}

          <CreateUserSheet />
        </div>
      </div>

      <div className="mt-7 space-y-4">
        {isError && <ErrorAlert error={error} fallback="Failed to load users." />}

        {reorder.isError && (
          <ErrorAlert
            error={reorder.error}
            fallback="Could not save the new order. The list has been put back."
          />
        )}

        {isPending && <TableSkeleton />}

        {users &&
          (users.length === 0 ? (
            <EmptyState />
          ) : (
            <UsersTable
              users={users}
              onReorder={(ids) => reorder.mutate(ids)}
              isSaving={reorder.isPending}
              onEdit={editing.show}
            />
          ))}
      </div>

      <EditUserSheet
        user={editing.user}
        open={editing.open}
        isSelf={editing.user?.id === session?.user.id}
        onOpenChange={editing.setOpen}
        onDelete={deleting.show}
      />

      <DeleteUserDialog
        user={deleting.user}
        open={deleting.open}
        onOpenChange={deleting.setOpen}
      />
    </>
  );
}
