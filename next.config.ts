import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // Security headers at the framework level (middleware also sets these)
  async headers() {
    return [
      {
        // Apply to all routes (`/`), and subpaths (`/about`, `/path/*`, etc.)
        source: "/((?!api|_next).*)",
        headers: [
          // Content Security Policy
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self';"
          },
          // Cross-Origin-Embedder-Policy
          {
            key: "Cross-Origin-Embedder-Policy",
            value: "credentialless"
          },
          // Cross-Origin-Opener-Policy
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin"
          },
          // X-Frame-Options - Prevent clickjacking
          {
            key: "X-Frame-Options",
            value: "DENY"
          },
          // X-Content-Type-Options - Prevent MIME sniffing
          {
            key: "X-Content-Type-Options",
            value: "nosniff"
          },
          // Referrer-Policy
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin"
          },
          // Permissions-Policy
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()"
          }
        ]
      }
    ];
  }
};

export default nextConfig;
