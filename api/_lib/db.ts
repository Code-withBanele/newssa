import { sql } from "@vercel/postgres";
import type { VercelPoolClient } from "@vercel/postgres";

export { sql };

export function requireDatabaseConfig() {
  if (!process.env.POSTGRES_URL) {
    throw new Error("Database is not configured. Set POSTGRES_URL in Vercel project environment variables.");
  }
}

export async function withTransaction<T>(work: (client: VercelPoolClient) => Promise<T>): Promise<T> {
  const client = await sql.connect();
  try {
    await client.sql`BEGIN`;
    const result = await work(client);
    await client.sql`COMMIT`;
    return result;
  } catch (error) {
    await client.sql`ROLLBACK`;
    throw error;
  } finally {
    client.release();
  }
}
