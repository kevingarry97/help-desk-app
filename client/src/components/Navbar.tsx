import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router";
import { LogOut } from "lucide-react";
import { cn } from "cn";

import ErrorAlert from "@/components/ErrorAlert";
import Logo from "@/components/Logo";
import { Role } from "core/constants/role";
import { signOut, useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

export default function Navbar() {
  const { data: session } = useSession();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<unknown>(null);

  const user = session?.user;
  const isAdmin = user?.role === Role.Admin;

  const handleSignOut = async () => {
    setSigningOut(true);
    setSignOutError(null);

    try {
      const { error } = await signOut();

      // Navigating on a failed sign-out would bounce straight back off LoginPage,
      // which redirects away whenever the session is still live.
      if (error) {
        setSignOutError(error);
        return;
      }

      navigate("/login", { replace: true });
    } catch (error) {
      setSignOutError(error);
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-5">
        <div className="flex items-center gap-4 sm:gap-8">
          <Link
            to="/"
            aria-label="Helpdesk home"
            className="rounded-md transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Logo />
          </Link>
          {isAdmin && (
            <nav className="flex items-center gap-1">
              <NavLink
                to="/users"
                className={({ isActive }) =>
                  cn(
                    "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-brand-50 text-brand-700"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )
                }
              >
                Users
              </NavLink>
            </nav>
          )}
        </div>

        <div className="flex items-center gap-4">
          {user && (
            <div className="flex items-center gap-2.5">
              <span className="grid size-9 place-items-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700">
                {user.name.charAt(0).toUpperCase()}
              </span>
              <div className="hidden leading-tight sm:block">
                <p className="text-sm font-semibold text-foreground">{user.name}</p>
                <p className="text-xs text-muted-foreground capitalize">{user.role}</p>
              </div>
            </div>
          )}

          <Button
            variant="outline"
            onClick={handleSignOut}
            disabled={signingOut}
            className="h-9"
          >
            <LogOut className="size-4" />
            <span className="hidden sm:inline">
              {signingOut ? "Signing out…" : "Sign out"}
            </span>
          </Button>
        </div>
      </div>

      {signOutError !== null && (
        <div className="mx-auto max-w-6xl px-5 pb-3">
          <ErrorAlert error={signOutError} fallback="Could not sign out. Please try again." />
        </div>
      )}
    </header>
  );
}
