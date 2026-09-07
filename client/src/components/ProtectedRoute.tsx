import { Navigate, Outlet, useLocation } from "react-router";

import RouteSpinner from "@/components/RouteSpinner";
import { useSession } from "@/lib/auth-client";

export default function ProtectedRoute() {
  const { data: session, isPending } = useSession();
  const location = useLocation();

  if (isPending) return <RouteSpinner />;

  // Carry where they were headed so signing in returns them there, not to "/".
  if (!session) return <Navigate to="/login" state={{ from: location }} replace />;

  return <Outlet />;
}
