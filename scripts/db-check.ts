/**
 * Connectivity / migration sanity check.
 *
 * Usage: npx tsx scripts/db-check.ts
 *
 * Loads .env.local the same way drizzle.config.ts does, then reports which
 * tables and indexes actually exist in the database.
 */
import "./load-env";

import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const sql = neon(url);

async function main() {
  const tables = await sql`
    select table_name
    from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE'
    order by table_name
  `;
  const indexes = await sql`
    select count(*)::int as n
    from pg_indexes
    where schemaname = 'public'
  `;
  const migrations = await sql`
    select count(*)::int as n from drizzle.__drizzle_migrations
  `.catch(() => [{ n: -1 }]);

  console.log(`tables (${tables.length}):`);
  console.log(tables.map((r) => String(r.table_name)).join(", "));
  console.log(`indexes: ${indexes[0].n}`);
  console.log(`applied migrations: ${migrations[0].n}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("DB check failed:", err?.message ?? err);
    process.exit(1);
  });
