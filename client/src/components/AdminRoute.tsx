import { Navigate, Outlet } from "react-router";

import RouteSpinner from "@/components/RouteSpinner";
import { Role } from "core/constants/role";
import { useSession } from "@/lib/auth-client";

/**
 * Renders admin-only routes. This decides what the browser shows and nothing more: the
 * API answers direct calls regardless, so every admin-only endpoint has to mount
 * `requireRole(Role.Admin)` (server/src/middleware/require-role.ts) as well. There are
 * none yet — /users is a stub with no backing endpoint — so this redirect is currently
 * the only thing gating the page, and it is not a security boundary.
 */
export default function AdminRoute() {
  const { data: session, isPending } = useSession();

  if (isPending) return <RouteSpinner />;

  if (session?.user.role !== Role.Admin) return <Navigate to="/" replace />;

  return <Outlet />;
}
