import type { RequestHandler } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../lib/auth";

declare global {
  namespace Express {
    interface Request {
      user?: typeof auth.$Infer.Session.user;
      session?: typeof auth.$Infer.Session.session;
    }
  }
}

export const requireAuth: RequestHandler<any> = async (req, res, next) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  req.user = session.user;
  req.session = session.session;
  next();
};
