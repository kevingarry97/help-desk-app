import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { updateUserSchema } from "core/schemas/users";
import type { UpdateUserInput, UpdateUserValues, UserListItem } from "core/schemas/users";

import ErrorAlert from "@/components/ErrorAlert";
import ErrorMessage from "@/components/ErrorMessage";
import RoleRadioGroup from "@/components/users/RoleRadioGroup";
import { useUpdateUser } from "@/hooks/use-users";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type Props = {
  user: UserListItem | null;
  open: boolean;
  isSelf: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: (user: UserListItem) => void;
};

type FormProps = {
  user: UserListItem;
  isSelf: boolean;
  isPending: boolean;
  error: unknown;
  onCancel: () => void;
  onDelete: () => void;
  onSubmit: (values: UpdateUserInput) => void;
};

function Required() {
  return <span className="text-destructive">*</span>;
}

function EditUserForm({
  user,
  isSelf,
  isPending,
  error,
  onCancel,
  onDelete,
  onSubmit,
}: FormProps) {
  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<UpdateUserValues, unknown, UpdateUserInput>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: { name: user.name, email: user.email, role: user.role },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col" noValidate>
      <SheetHeader className="border-b border-border p-5 pr-12">
        <SheetTitle className="text-base">Edit user</SheetTitle>
        <SheetDescription>Update {user.name}’s details and role.</SheetDescription>
      </SheetHeader>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
        <ErrorAlert error={error} fallback="Could not save the changes. Please try again." />

        <div>
          <Label htmlFor="edit-user-name" className="mb-2">
            Name
            <Required />
          </Label>
          <Input
            id="edit-user-name"
            autoComplete="off"
            aria-invalid={!!errors.name}
            className="h-10"
            {...register("name")}
          />
          <ErrorMessage message={errors.name?.message} />
        </div>

        <div>
          <Label htmlFor="edit-user-email" className="mb-2">
            Email
            <Required />
          </Label>
          <Input
            id="edit-user-email"
            type="email"
            autoComplete="off"
            aria-invalid={!!errors.email}
            className="h-10"
            {...register("email")}
          />
          <ErrorMessage message={errors.email?.message} />
        </div>

        <div>
          <span id="edit-user-role-label" className="mb-2 block text-sm font-medium">
            Role
          </span>
          <Controller
            control={control}
            name="role"
            render={({ field }) => (
              <RoleRadioGroup
                idPrefix="edit-user-role"
                labelledBy="edit-user-role-label"
                value={field.value}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
                disabled={isSelf}
              />
            )}
          />
          <ErrorMessage message={errors.role?.message} />
          {isSelf && (
            <p className="mt-1.5 text-xs text-muted-foreground">
              You can’t change your own role.
            </p>
          )}
        </div>
      </div>

      <SheetFooter className="flex-row justify-end gap-2 border-t border-border p-5">
        {!isSelf && (
          <Button
            type="button"
            variant="destructive"
            size="lg"
            disabled={isPending}
            onClick={onDelete}
            className="mr-auto"
          >
            Delete user
          </Button>
        )}
        <Button type="button" variant="outline" size="lg" disabled={isPending} onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="submit"
          size="lg"
          disabled={isPending || !isDirty}
          className="bg-brand-600 hover:bg-brand-700"
        >
          {isPending ? "Saving…" : "Save changes"}
        </Button>
      </SheetFooter>
    </form>
  );
}

export default function EditUserSheet({ user, open, isSelf, onOpenChange, onDelete }: Props) {
  const update = useUpdateUser();

  const handleOpenChange = (next: boolean) => {
    if (!next && update.isPending) return;
    if (!next) update.reset();

    onOpenChange(next);
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="w-full gap-0 sm:max-w-md">
        {user && (
          <EditUserForm
            key={user.id}
            user={user}
            isSelf={isSelf}
            isPending={update.isPending}
            error={update.error}
            onCancel={() => handleOpenChange(false)}
            onDelete={() => {
              handleOpenChange(false);
              onDelete(user);
            }}
            onSubmit={(values) =>
              update.mutate({ id: user.id, ...values }, { onSuccess: () => onOpenChange(false) })
            }
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
