const raw = process.env.CORS_ORIGINS;

if (!raw) {
  throw new Error("CORS_ORIGINS is not set — copy .env.example to .env");
}

export const allowedOrigins = raw
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

if (allowedOrigins.length === 0) {
  throw new Error("CORS_ORIGINS is empty — set at least one origin, e.g. http://localhost:5173");
}
