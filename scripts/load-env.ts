/**
 * Loads .env.local then .env into process.env.
 *
 * Must be the FIRST import of every entry script: ES module imports are
 * hoisted and evaluated in order, so listing this one first guarantees the
 * environment exists before any other module (db pool, auth config) reads it.
 *
 * The Next.js server does its own env loading — app code never imports this.
 */
try {
  process.loadEnvFile(".env.local");
} catch {
  /* optional */
}
try {
  process.loadEnvFile(".env");
} catch {
  /* optional */
}

export {};
