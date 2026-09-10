import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, UserPlus } from "lucide-react";
import { createUserSchema } from "core/schemas/users";
import type { CreateUserInput, CreateUserValues } from "core/schemas/users";
import { Role } from "core/constants/role";

import ErrorAlert from "@/components/ErrorAlert";
import ErrorMessage from "@/components/ErrorMessage";
import { useCreateUser } from "@/hooks/use-users";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const ROLE_OPTIONS = [
  {
    value: Role.Agent,
    label: "Agent",
    hint: "Works the ticket queue.",
  },
  {
    value: Role.Admin,
    label: "Admin",
    hint: "Everything an agent can do, plus managing this list.",
  },
] as const;

const EMPTY_FORM: CreateUserValues = {
  name: "",
  email: "",
  password: "",
  role: Role.Agent,
};

function Required() {
  return <span className="text-destructive">*</span>;
}

/**
 * The "New user" action and the panel behind it.
 *
 * Sign-up is disabled, so this form is the only way an account comes into existence outside
 * the seed scripts — which is why it asks for a password: an admin sets one and passes it
 * on, since the new user has no way to choose or reset one themselves.
 */
export default function CreateUserSheet() {
  const [open, setOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const create = useCreateUser();

  // Three generics because the schema transforms: the form holds what is being typed
  // (CreateUserValues), and handleSubmit hands on what the resolver produced from it
  // (CreateUserInput — trimmed and lowercased), which is what the API wants.
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateUserValues, unknown, CreateUserInput>({
    resolver: zodResolver(createUserSchema),
    defaultValues: EMPTY_FORM,
  });

  const handleOpenChange = (next: boolean) => {
    // A request in flight owns the panel. Dismissing here — Escape, the backdrop, Cancel —
    // would throw away what was typed while the account may still be being created, and
    // leave the admin unsure whether it was.
    if (!next && create.isPending) return;

    if (next) {
      // Reopening starts clean: no values from the last account, and no error from an
      // attempt the admin has already walked away from.
      reset(EMPTY_FORM);
      create.reset();
      setShowPassword(false);
    }

    setOpen(next);
  };

  const onSubmit = (values: CreateUserInput) => {
    // mutate rather than mutateAsync: a rejection here would propagate out of
    // handleSubmit's promise with nobody to catch it, and the failure is already on screen
    // through create.error.
    create.mutate(values, { onSuccess: () => setOpen(false) });
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger
        render={<Button size="lg" className="bg-brand-600 hover:bg-brand-700" />}
      >
        <UserPlus data-icon="inline-start" />
        New user
      </SheetTrigger>

      <SheetContent className="w-full gap-0 sm:max-w-md">
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex min-h-0 flex-1 flex-col"
          noValidate
        >
          {/* pr-12 keeps the description clear of the close button, which the primitive
              pins to the top-right corner of the panel. */}
          <SheetHeader className="border-b border-border p-5 pr-12">
            <SheetTitle className="text-base">New user</SheetTitle>
            <SheetDescription>
              They can sign in as soon as you create the account.
            </SheetDescription>
          </SheetHeader>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
            <ErrorAlert
              error={create.error}
              fallback="Could not create the user. Please try again."
            />

            <div>
              <Label htmlFor="new-user-name" className="mb-2">
                Name
                <Required />
              </Label>
              <Input
                id="new-user-name"
                autoComplete="off"
                placeholder="Ada Lovelace"
                aria-invalid={!!errors.name}
                className="h-10"
                {...register("name")}
              />
              <ErrorMessage message={errors.name?.message} />
            </div>

            <div>
              <Label htmlFor="new-user-email" className="mb-2">
                Email
                <Required />
              </Label>
              <Input
                id="new-user-email"
                type="email"
                autoComplete="off"
                placeholder="ada@example.com"
                aria-invalid={!!errors.email}
                className="h-10"
                {...register("email")}
              />
              <ErrorMessage message={errors.email?.message} />
            </div>

            <div>
              <Label htmlFor="new-user-password" className="mb-2">
                Temporary password
                <Required />
              </Label>
              <div className="relative">
                <Input
                  id="new-user-password"
                  type={showPassword ? "text" : "password"}
                  // Not "new-password": the browser would offer to save this under the
                  // signed-in admin's own credentials, which are not the ones being set.
                  autoComplete="off"
                  placeholder="At least 8 characters"
                  aria-invalid={!!errors.password}
                  aria-describedby="new-user-password-hint"
                  className="h-10 pr-10"
                  {...register("password")}
                />
                {/* Revealable because the admin has to read this back to someone. */}
                <button
                  type="button"
                  onClick={() => setShowPassword((shown) => !shown)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-0 grid w-10 place-items-center rounded-r-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {showPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
              <ErrorMessage message={errors.password?.message} />
              <p id="new-user-password-hint" className="mt-1.5 text-xs text-muted-foreground">
                Pass this on yourself — there is no sign-up or password reset for them to
                use.
              </p>
            </div>

            <div>
              <span id="new-user-role-label" className="mb-2 block text-sm font-medium">
                Role
              </span>
              <Controller
                control={control}
                name="role"
                render={({ field }) => (
                  <RadioGroup
                    aria-labelledby="new-user-role-label"
                    value={field.value}
                    onValueChange={(value) => field.onChange(value)}
                    onBlur={field.onBlur}
                  >
                    {ROLE_OPTIONS.map((option) => {
                      const id = `new-user-role-${option.value}`;

                      return (
                        // The whole card is the label, so the hint is part of the hit
                        // target rather than dead space beside the dot.
                        <Label
                          key={option.value}
                          htmlFor={id}
                          className="items-start gap-3 rounded-lg border border-input p-3 transition-colors hover:bg-muted/50 has-data-checked:border-primary has-data-checked:bg-muted/40"
                        >
                          {/* Named by the option's own text rather than by the wrapping
                              label: a radio built on a button takes its accessible name
                              from its contents, and its contents are the indicator dot. */}
                          <RadioGroupItem
                            id={id}
                            value={option.value}
                            aria-labelledby={`${id}-label`}
                            aria-describedby={`${id}-hint`}
                            className="mt-0.5"
                          />
                          <span className="grid gap-0.5">
                            <span id={`${id}-label`} className="font-medium">
                              {option.label}
                            </span>
                            <span
                              id={`${id}-hint`}
                              className="text-xs font-normal text-muted-foreground"
                            >
                              {option.hint}
                            </span>
                          </span>
                        </Label>
                      );
                    })}
                  </RadioGroup>
                )}
              />
              <ErrorMessage message={errors.role?.message} />
            </div>
          </div>

          <SheetFooter className="flex-row justify-end gap-2 border-t border-border p-5">
            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={create.isPending}
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="lg"
              disabled={create.isPending}
              className="bg-brand-600 hover:bg-brand-700"
            >
              {create.isPending ? "Creating…" : "Create user"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
