import type { RequestHandler } from "express";
import type { UserRole } from "core/constants/role";


export function requireRole(...roles: UserRole[]): RequestHandler {
  return (req, res, next) => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (!roles.includes(req.user.role as UserRole)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    next();
  };
}
