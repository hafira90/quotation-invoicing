import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";

import * as schema from "@/db/schema";

/**
 * Application database client.
 *
 * Uses node-postgres over the Neon **pooled** endpoint (DATABASE_URL).
 * The pooler is what serverless functions should use: each Vercel invocation
 * opens short-lived connections and Neon's PgBouncer-style pooler multiplexes
 * them. Migrations use the direct endpoint instead (see drizzle.config.ts).
 *
 * node-postgres supports transactions, which the document-numbering and
 * document-conversion paths require — the HTTP driver does not.
 */
function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "[db] DATABASE_URL is not configured. Set it in .env.local for local " +
        "development, or in Vercel → Settings → Environment Variables for " +
        "preview and production. See .env.example."
    );
  }

  const needsSsl = /sslmode=(require|verify-ca|verify-full)/.test(connectionString);

  return new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ...(needsSsl ? { ssl: { rejectUnauthorized: true } } : {}),
  });
}

const globalForDb = globalThis as unknown as { __pgPool?: Pool };

export const pool = globalForDb.__pgPool ?? createPool();

if (process.env.NODE_ENV !== "production") {
  globalForDb.__pgPool = pool;
}

export const db = drizzle({ client: pool, schema });

export type Database = typeof db;
