import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * Security Headers Middleware
 * 
 * Sets the following security headers on all responses:
 * 1. Content-Security-Policy - Prevents XSS and injection attacks
 * 2. Cross-Origin-Embedder-Policy - Ensures only cross-origin authorized resources are loaded
 * 3. Cross-Origin-Opener-Policy - Isolates the window from cross-origin documents
 * 4. X-Frame-Options - Prevents clickjacking
 * 5. X-Content-Type-Options - Prevents MIME-type sniffing
 */
export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Content Security Policy
  // Restricts sources of executable scripts, styles, images, etc.
  // 'self' means same origin; 'unsafe-inline' should be avoided in production
  // and 'unsafe-eval' should never be used
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");

  // Cross-Origin-Embedder-Policy
  const coep = "credentialless";

  // Cross-Origin-Opener-Policy
  const coop = "same-origin";

  // X-Frame-Options - Prevents the page from being embedded in frames
  const xfo = "DENY";

  // X-Content-Type-Options - Prevents MIME sniffing
  const xcto = "nosniff";

  // Set all headers
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("Cross-Origin-Embedder-Policy", coep);
  response.headers.set("Cross-Origin-Opener-Policy", coop);
  response.headers.set("X-Frame-Options", xfo);
  response.headers.set("X-Content-Type-Options", xcto);

  // Additional security headers
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");

  return response;
}// Configure which paths the middleware runs on
// Running on all routes for maximum security coverage
export const config = {
  matcher: ["/((?!.*\._next).*)"],
};
