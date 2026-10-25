/**
 * Server-side environment access.
 *
 * Every helper here throws a clear configuration error instead of failing
 * later with an opaque crash, and none of these values are ever exposed to
 * the browser (no NEXT_PUBLIC_ prefix, no leaking into client bundles).
 */

export function isConfigured(name: string): boolean {
  const value = process.env[name];
  return typeof value === "string" && value.length > 0;
}

/** Read a required server-only variable, or throw a configuration error. */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `[env] ${name} is not configured. Add it to .env.local for local ` +
        `development or to Vercel → Settings → Environment Variables. ` +
        `See .env.example for the full list.`
    );
  }
  return value;
}/** True when the app has the credentials needed to send email. */

export function isEmailConfigured(): boolean {
  return isConfigured("RESEND_API_KEY") && isConfigured("EMAIL_SENDER_ADDRESS");
}

/** True when Vercel Blob storage is connected. */

export function isBlobConfigured(): boolean {
  return isConfigured("BLOB_READ_WRITE_TOKEN");
}

/** True when email sender name is configured. */
export function isEmailSenderConfigured(): boolean {
  return isConfigured("EMAIL_SENDER_NAME") && isConfigured("EMAIL_SENDER_ADDRESS");
}

