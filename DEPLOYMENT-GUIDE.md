# Vercel Deployment Guide

This guide walks through deploying the Quotation & Invoicing Management System to Vercel with all required integrations.

## 📋 Prerequisites

Before starting, ensure you have:

1. **Vercel Account** - Sign up at [vercel.com](https://vercel.com)
2. **Neon Database** - Sign up at [neon.tech](https://neon.tech) and create a PostgreSQL database
3. **Resend Account** - Sign up at [resend.com] for transactional emails
4. **Git Repository** - Push code to GitHub, GitLab, or Bitbucket

## 🔧 Step 1: Prepare Your Codebase

### 1.1 Ensure `.env.example` is Complete

The `.env.example` file in your project root should contain all required environment variables. See the included `.env.example` for the full list.

### 1.2 Verify TypeScript Compilation

```bash
npm run typecheck
# or
npx tsc --noEmit
```

Fix any errors before deploying.

### 1.3 Run Tests

```bash
npm run test    # Unit tests (Vitest)
npm run test:e2e  # End-to-end tests (Playwright)
```

All tests must pass before deployment.

## 🗄️ Step 2: Provision Neon Database

### 2.1 Create a Neon Database

1. Sign in to [neon.tech](https://neon.tech)
2. Click "New Project"
3. Choose a region close to your users
4. Note the connection string (you'll need both pooled and direct URLs)

### 2.2 Connect to Vercel (Recommended)

1. In your Vercel project, go to **"Marketplace"**
2. Select **"Neon"** from the marketplace
3. Click "Connect" and follow the authorization flow
4. Vercel will automatically:
   - Add `DATABASE_URL` environment variable
   - Add `DATABASE_URL_DIRECT` environment variable
   - Keep the connection string up to date

### 2.3 Manual Configuration (if not using Vercel Marketplace)

Add these to your Vercel project settings → Environment Variables:

| Variable | Value |
|---|---|
| `DATABASE_URL` | `postgresql://user:password@hostname/db?sslmode=require` |
| `DATABASE_URL_DIRECT` | `postgresql://user:password@hostname-db?sslmode=require` (remove `-pooler` from host) |

## 📦 Step 3: Provision Vercel Blob Storage

### 3.1 Enable Blob Storage

1. In your Vercel project, go to **"Storage"**
2. Click **"Blob"** → "Connect"
3. Follow the setup flow to provision Blob storage
4. Vercel will automatically add `BLOB_READ_WRITE_TOKEN` to environment variables

### 3.2 Blob Security Notes

- `BLOB_READ_WRITE_TOKEN` is server-side only - never expose with `NEXT_PUBLIC_` prefix
- Files are stored with purpose-based categorization
- Private files require authenticated download routes
- Public files can be served directly via URL

## 📧 Step 4: Configure Resend for Email

### 4.1 Create a Resend Account

1. Sign up at [resend.com](https://resend.com)
2. Verify your email address
3. Add a verified sender domain (required for sending emails)

### 4.2 Configure Sender Addresses

1. In Resend dashboard, go to "Domains"
2. Add your domain (e.g., `yourdomain.com`)
3. Verify domain ownership via DNS TXT record
4. Once verified, you can send from `@yourdomain.com` addresses

### 4.3 Add Environment Variables to Vercel

In your Vercel project → Settings → Environment Variables, add:

| Variable | Value |
|---|---|
| `RESEND_API_KEY` | Your Resend API key from the dashboard |
| `EMAIL_SENDER_NAME` | e.g., "Quotation & Invoicing System" |
| `EMAIL_SENDER_ADDRESS` | e.g., "no-reply@yourdomain.com" (must be verified in Resend) |
| `EMAIL_REPLY_TO` | Optional: e.g., "reply@yourdomain.com" |

### 4.4 Test Email Configuration

```bash
# Run locally to test
npm run dev

# Visit the email setup page to verify configuration
# The app will show setup instructions if credentials are missing
```

## 🚀 Step 5: Deploy to Vercel

### 5.1 Connect Your Git Repository

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your Git repository (GitHub, GitLab, or Bitbucket)
3. Vercel will automatically detect the Next.js framework

### 5.2 Configuration Settings

Ensure these settings are correct:

| Setting | Value |
|---|---|
| **Framework Preset** | Next.js (auto-detected) |
| **Build Command** | `next build` |
| **Output Directory** | `.next` (auto-detected) |
| **Development Command** | `npm run dev` |
| **Root Directory** | `.` (project root) |

### 5.3 Environment Variables in Vercel

After the initial deploy, add all environment variables:

1. Go to Project Settings → Environment Variables
2. Add each variable from `.env.example`:
   - `DATABASE_URL` (auto-filled if Neon Marketplace is connected)
   - `DATABASE_URL_DIRECT`
   - `BETTER_AUTH_SECRET` - generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('base64))"`
   - `BETTER_AUTH_URL` - e.g., `https://your-app.vercel.app`
   - `BLOB_READ_WRITE_TOKEN` (auto-filled if Blob is connected)
   - `RESEND_API_KEY`
   - `EMAIL_SENDER_NAME`
   - `EMAIL_SENDER_ADDRESS`
   - `EMAIL_REPLY_TO` (optional)
   - `SETUP_TOKEN` - leave empty after first admin is created

### 5.4 Deploy

Click "Deploy" and wait for the build to complete. Vercel will show the deployment URL (e.g., `https://your-app.vercel.app`).

## 🔧 Step 6: Post-Deployment Setup

### 6.1 Create the First Super Administrator

After the first deploy, run the bootstrap script:

```bash
# Via Vercel CLI or Dashboard
vercel run "npm run bootstrap:admin"
```

Or access the bootstrap endpoint directly:
```
https://your-app.vercel.app/(auth)/bootstrap
```

Follow the on-screen instructions to create the first administrator account.

### 6.2 Run Database Migrations

```bash
npx drizzle-kit migrate
# or via Vercel
vercel exec "npm run db:migrate"
```

### 6.3 Seed Demonstration Data (optional)

```bash
npm run seed
```

This populates the database with sample customers, products, and business settings for testing.

### 6.4 Verify All Integrations

1. **Database**: Try creating a customer - should work without errors
2. **Blob**: Try uploading a test file - should store in Blob
3. **Email**: Try the email setup page - should show "configured" status
4. **Authentication**: Log in with the newly created admin account

### 6.5 Configure Custom Domain (Optional)

1. In Vercel, go to "Domains"
2. Add your custom domain (e.g., `quotes.yourbusiness.com`)
3. Follow the DNS verification steps
4. Update SSL certificate settings

## 📊 Step 7: Monitoring and Maintenance

### 7.1 Monitor Database Usage

- Check Neon console for query counts and storage
- Set up alerts for connection limits
- Monitor storage growth (Blobs, PDFs, attachments)

### 7.2 Monitor Email Sending

- Check Vercel function logs for email send errors
- Review `email_logs` table for send status
- Set up Resend dashboard alerts for sending failures

### 7.3 Backup Strategy

**Database Backups:**
- Neon provides point-in-time recovery (PITR) depending on your plan
- Enable automatic backups in the Neon dashboard
- Export critical data periodically using `pg_dump`

**Blob Storage:**
- Vercel Blob does not provide automatic backups
- Download important files periodically
- Keep a separate backup of PDFs and attachments

### 7.4 Update Deployment

To deploy new changes:

```bash
git add .
git commit -m "Your commit message"
git push
# Vercel will automatically redeploy on push to main branch
```

Or manually:
```bash
vercel deploy
vercel promote  # Promote preview to production
```

### 7.5 Security Checks

Regularly:
- Rotate `BETTER_AUTH_SECRET` and `BLOB_READ_WRITE_TOKEN`
- Review `RESEND_API_KEY` access and revoke if compromised
- Check for dependency vulnerabilities: `npm audit`
- Review audit logs for suspicious activity
- Test password reset and recovery flows

## 🛠️ Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|---|---|---|
| "DATABASE_URL not configured" | Neon not connected via Vercel Marketplace | Connect via Vercel → Marketplace → Neon, or manually add DATABASE_URL |
| "BLOB_READ_WRITE_TOKEN not configured" | Blob storage not provisioned | Go to Vercel → Storage → Blob → Connect |
| "RESEND_API_KEY not configured" | Resend not set up | Add RESEND_API_KEY to Vercel env vars + verify sender domain |
| "EMAIL_SENDER_ADDRESS not configured" | Sender address not set | Add EMAIL_SENDER_ADDRESS to env vars (must be verified in Resend) |
| TypeScript errors after deploy | Missing environment variables | Ensure all env vars are set in Vercel, not just locally |
| Authentication redirect loops | BETTER_AUTH_URL mismatch | Set BETTER_AUTH_URL to the actual production URL |
| PDFs not generating | Missing Blob token or database issues | Check BLOB_READ_WRITE_TOKEN and DATABASE_URL |
| Emails not sending | Resend API key invalid or sender unverified | Verify Resend key and sender domain in Resend dashboard |
| Numbering duplicates under concurrency | Race condition in numbering | Ensure `allocateDocumentNumber` uses `SELECT ... FOR UPDATE` (already implemented) |
| Customers visible across companies | Missing company_id filter | Ensure all queries filter by `companyId` from session |

### Need Help?

- Check the [Vercel Documentation](https://vercel.com/docs)
- Review [Neon Documentation](https://neon.tech/docs)
- Check [Resend API Reference](https://resend.com/docs)
- Open an issue in the repository

---
*This guide was generated as part of the Quotation & Invoicing Management System deployment setup.*