import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set — copy .env.example to .env");
}

// Prisma 7 talks to Postgres through a driver adapter rather than its own
// query engine binary, so the pg pool is what actually holds the connection.
const adapter = new PrismaPg({ connectionString });

export const prisma = new PrismaClient({ adapter });
