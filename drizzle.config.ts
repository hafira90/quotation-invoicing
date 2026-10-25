import { defineConfig } from "drizzle-kit";

// Node >= 20.12 supports loading .env without an extra dependency.
// .env.local wins over .env, matching Next.js' own precedence.
for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // File not present — fall through to the ambient environment.
  }
}

/**
 * Neon is provisioned through the Vercel Marketplace integration.
 *
 * - DATABASE_URL         : pooled connection string (serverless runtime + app queries)
 * - DATABASE_URL_DIRECT  : direct (non-pooled) connection string, used only by
 *                          drizzle-kit generate/migrate. Neon requires the
 *                          direct endpoint for DDL: transaction-mode poolers
 *                          cannot run migration scripts reliably.
 *
 * drizzle-kit is a CLI, never part of the serverless bundle, so it always
 * prefers the direct endpoint and falls back to DATABASE_URL if that is all
 * that is configured.
 */
const url = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL;

if (!url) {
  console.warn(
    "[drizzle] DATABASE_URL is not set. Set it in .env.local (local dev) or in " +
      "Vercel → Project Settings → Environment Variables (preview/production)."
  );
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  strict: true,
  verbose: true,
  dbCredentials: {
    // Empty string keeps the config type-valid when no env file exists yet;
    // generate works without a connection, migrate will fail loudly above.
    url: url ?? "",
  },
});
