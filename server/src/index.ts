import express from "express";
import cors from "cors";
import helmet from "helmet";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth";
import { getAllowedOrigins } from "./lib/origins";
import { clientIp } from "./middleware/client-ip";
import { errorHandler } from "./middleware/error-handler";
import { apiLimiter, authLimiter } from "./middleware/rate-limit";
import { healthRouter } from "./routes/health";
import { ticketsRouter } from "./routes/tickets";

const allowedOrigins = getAllowedOrigins();

const app = express();
const port = Number(process.env.PORT ?? 4000);

const trustProxy = process.env.TRUST_PROXY;

if (trustProxy) {
  if (trustProxy === "true") {
    throw new Error(
      'TRUST_PROXY="true" trusts every hop, which puts X-Forwarded-For — and with it req.ip, ' +
        "the key both rate limiters and Better Auth's IP resolution use — back under the " +
        "caller's control. Set the number of proxy hops in front of the API (usually 1), a " +
        'comma-separated list of proxy addresses, or a preset such as "loopback".',
    );
  }

  app.set("trust proxy", /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy);
}

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

app.use(cors({ origin: allowedOrigins, credentials: true }));

app.use(clientIp);

app.use("/api", apiLimiter);
app.use("/api/auth", authLimiter);

app.all("/api/auth/{*any}", toNodeHandler(auth));

app.use(express.json());

app.use("/api/health", healthRouter);
app.use("/api/tickets", ticketsRouter);

app.use(errorHandler);

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
