/**
 * Ad-hoc read-only query helper for diagnostics.
 *
 * Usage: npx tsx scripts/query.ts "select * from invoices limit 5"
 */
import "./load-env";

import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const text = process.argv.slice(2).join(" ").trim();
if (!text) {
  console.error("Usage: npx tsx scripts/query.ts \"<sql>\"");
  process.exit(1);
}

const sql = neon(url);

sql
  .query(text, [])
  .then((rows) => {
    console.log(JSON.stringify(rows, null, 2));
    process.exit(0);
  })
  .catch((err) => {
    console.error("Query failed:", err?.message ?? err);
    process.exit(1);
  });
