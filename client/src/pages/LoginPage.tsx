import { useState } from "react";
import { Navigate, useNavigate } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod/v4";

import { signIn, useSession } from "@/lib/auth-client";
import BrandPanel from "@/components/BrandPanel";
import Logo from "@/components/Logo";
import ErrorAlert from "@/components/ErrorAlert";
import ErrorMessage from "@/components/ErrorMessage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const loginSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});

type LoginValues = z.infer<typeof loginSchema>;

function Required() {
  return <span className="text-destructive">*</span>;
}

export default function LoginPage() {
  const { data: session, isPending } = useSession();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

  if (!isPending && session) return <Navigate to="/" replace />;

  const onSubmit = async (values: LoginValues) => {
    setFormError(null);

    const { error } = await signIn.email({
      email: values.email,
      password: values.password,
    });

    if (error) {
      setFormError(
        error.status === 401
          ? "Invalid email or password"
          : (error.message ?? "Could not sign in. Please try again."),
      );
      return;
    }

    navigate("/", { replace: true });
  };

  return (
    <div className="grid min-h-screen place-items-center bg-brand-900 p-4 sm:p-6">
      <div className="w-full max-w-[1100px] rounded-[28px] bg-white p-4 shadow-2xl">
        <div className="grid gap-0 lg:grid-cols-2">
          <BrandPanel />

          <div className="flex flex-col justify-center px-2 py-10 sm:px-10 lg:px-14">
            <Logo />

            <h1 className="mt-9 text-[32px] font-bold tracking-tight text-foreground">
              Sign in
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Agent accounts are created by an administrator.
            </p>

            <form onSubmit={handleSubmit(onSubmit)} className="mt-7 space-y-5" noValidate>
              {formError && <ErrorAlert message={formError} />}

              <div>
                <Label htmlFor="email" className="mb-2 text-sm font-medium">
                  Email
                  <Required />
                </Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="Enter your email"
                  aria-invalid={!!errors.email}
                  className="h-11"
                  {...register("email")}
                />
                <ErrorMessage message={errors.email?.message} />
              </div>

              <div>
                <Label htmlFor="password" className="mb-2 text-sm font-medium">
                  Password
                  <Required />
                </Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  aria-invalid={!!errors.password}
                  className="h-11"
                  {...register("password")}
                />
                <ErrorMessage message={errors.password?.message} />
              </div>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="h-11 w-full bg-brand-600 text-base font-semibold hover:bg-brand-700"
              >
                {isSubmitting ? "Signing in…" : "Sign in"}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
