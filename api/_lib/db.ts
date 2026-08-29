import { sql } from "@vercel/postgres";

export { sql };

export function requireDatabaseConfig() {
  if (!process.env.POSTGRES_URL) {
    throw new Error("Database is not configured. Set POSTGRES_URL in Vercel project environment variables.");
  }
}
