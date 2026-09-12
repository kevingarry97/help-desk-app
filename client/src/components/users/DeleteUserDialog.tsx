import type { UserListItem } from "core/schemas/users";

import ErrorAlert from "@/components/ErrorAlert";
import { useDeleteUser } from "@/hooks/use-users";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Props = {
  user: UserListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function DeleteUserDialog({ user, open, onOpenChange }: Props) {
  const remove = useDeleteUser();

  const handleOpenChange = (next: boolean) => {
    if (!next && remove.isPending) return;
    if (!next) remove.reset();

    onOpenChange(next);
  };

  const confirm = () => {
    if (!user) return;

    remove.mutate(user.id, { onSuccess: () => onOpenChange(false) });
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {user?.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            {user?.email} will be signed out and lose access to the helpdesk. This can’t be
            undone.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <ErrorAlert error={remove.error} fallback="Could not delete the user. Please try again." />

        <AlertDialogFooter>
          <AlertDialogCancel disabled={remove.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={remove.isPending} onClick={confirm}>
            {remove.isPending ? "Deleting…" : "Delete user"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
