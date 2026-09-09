import { Navigate, Outlet } from "react-router";

import RouteSpinner from "@/components/RouteSpinner";
import { Role } from "core/constants/role";
import { useSession } from "@/lib/auth-client";

/**
 * Renders admin-only routes. This decides what the browser shows and nothing more: the
 * API answers direct calls regardless, so every admin-only endpoint has to mount
 * `requireRole(Role.Admin)` (server/src/middleware/require-role.ts) as well. /users does —
 * `usersRouter` guards the whole router — and that, not this redirect, is the boundary.
 */
export default function AdminRoute() {
  const { data: session, isPending } = useSession();

  if (isPending) return <RouteSpinner />;

  if (session?.user.role !== Role.Admin) return <Navigate to="/" replace />;

  return <Outlet />;
}
