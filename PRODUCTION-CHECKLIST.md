# Production Readiness Checklist

This checklist ensures the Quotation & Invoicing Management System is fully ready for production deployment. Complete every item before declaring the application complete.

## 🚀 Deployment Checklist

### Infrastructure

- [ ] **Vercel project created** and connected to Git repository
- [ ] **Neon database** connected via Vercel Marketplace (DATABASE_URL auto-injected)
- [ ] **Neon DATABASE_URL_DIRECT** set for drizzle-kit migrations
- [ ] **Vercel Blob storage** provisioned and BLOB_READ_WRITE_TOKEN set
- [ ] **Resend account** created with verified sender domain
- [ ] **Resend API key** added to Vercel environment variables
- [ ] **EMAIL_SENDER_NAME** configured in Vercel env vars
- [ ] **EMAIL_SENDER_ADDRESS** configured in Vercel env vars (verified in Resend)
- [ ] **BETTER_AUTH_SECRET** generated and set (32-byte base64 string)
- [ ] **BETTER_AUTH_URL** set to production URL (e.g., `https://your-app.vercel.app`)
- [ ] **Custom domain** configured (optional) with SSL certificate
- [ ] **Backup domain** (vercel.app) working as fallback

### Database

- [ ] **Migrations run** successfully (`npm run db:migrate`)
- [ ] **All tables created** without errors
- [ ] **Unique constraints** verified (no duplicate keys)
- [ ] **Indexes created** for performance-critical queries
- [ ] **Point-in-time recovery** enabled in Neon (depending on plan)
- [ ] **Database connection tested** - can create/read/update records
- [ ] **Row-level security** - all queries filtered by company_id
- [ ] **Migration rollback tested** - `npx drizzle-kit generate` + `migrate` rollback

### Authentication & Authorization

- [ ] **Super Admin created** via `npm run bootstrap:admin`
- [ ] **Login flow works** - email/password authentication
- [ ] **Logout clears session** completely
- [ ] **Password reset flow** - forgot password → token → new password
- [ ] **Email verification** - tokens expire after use
- [ ] **Rate limiting** on login/password reset endpoints
- [ ] **Account lockout** after consecutive failed attempts
- [ ] **TOTP MFA** (if enabled) works correctly
- [ ] **Role-based access control** verified for all 5 roles:
  - [ ] Super Admin: full access
  - [ ] Administrator: manage operations, users, documents
  - [ ] Sales: manage customers, products, quotations, invoices
  - [ ] Finance: manage invoices, payments, credit notes, reports
  - [ ] Viewer: read-only access to permitted records
- [ ] **Permission checks** on every server API route and Server Action
- [ ] **CSRF protection** enabled on all forms
- [ ] **Secure cookies** - HttpOnly, SameSite, Secure flags

### Financial Calculations

- [ ] **Decimal-safe arithmetic** - no JavaScript floating-point for money
- [ ] **Tax calculation** - exclusive vs inclusive correctly handled
- [ ] **Discount allocation** - line-level and document-level working
- [ ] **Rounding** - consistent approach across UI, API, PDFs, reports
- [ ] **Currency precision** - MYR and 2-decimal display
- [ ] **Partial payments** - update outstanding balances correctly
- [ ] **Fully paid invoices** never appear overdue
- [ ] **Concurrent document creation** - no duplicate numbers (28/28 tests pass)
- [ ] **Quotation-to-invoice conversion** - atomic, no duplicate invoices

### Document Designer & PDF Generation

- [ ] **PDF download** works for quotations, invoices, receipts, credit notes
- [ ] **A4 output** - correct page size and margins
- [ ] **Page numbers** rendered correctly
- [ ] **Logo and signature** rendering verified
- [ ] **Currency formatting** - RM display for MYR
- [ ] **Selectable text** in PDF (not rendered as image)
- [ ] **Multi-page support** - long documents span multiple pages
- [ ] **Repeated table headers** on subsequent pages
- [ ] **Footer placement** - no overlap with content
- [ ] **Print preview** - CSS print stylesheet works in browser
- [ ] **Historical documents** - template changes don't affect issued documents
- [ ] **Document snapshots** preserved at issuance time

### Email Integration

- [ ] **Resend API key** validated and emails sending
- [ ] **Quotation emails** send with PDF attachment
- [ ] **Invoice emails** send with PDF attachment
- [ ] **Receipt emails** send with payment details
- [ ] **Credit note emails** send with adjustment details
- [ ] **Email status tracking** - pending/sent/failed in email_logs table
- [ ] **Retry logic** for failed email sends
- [ ] **Delivery status** where supported by provider
- [ ] **Failure reporting** - errors logged without corrupting document records
- [ ] **Email activity history** visible in admin UI
- [ ] **Configurable templates** - subject and message customizable
- [ ] **CC/BCC** support on email sends

### Customer & Product Management

- [ ] **Customer CRUD** - create, edit, view, archive, restore
- [ ] **Duplicate detection** - warnings before creating similar customers
- [ ] **CSV import** - validates data, reports failed rows
- [ ] **CSV export** - exports customer and product records
- [ ] **Product catalogue** - create, edit, archive, restore items
- [ ] **Search and filter** - by name, SKU, category, status
- [ ] **Pagination** - all lists paginated server-side
- [ ] **Tax categories** - configured with rates and treatment
- [ ] **Cost price** - visible only to authorized roles
- [ ] **Image uploads** - product images stored in Blob

### Quotation Workflow

- [ ] **Create quotation** - select customer, add lines, issue
- [ ] **Status transitions** - valid only allowed paths:
  - draft → issued → sent → accepted/rejected/expired/cancelled
- [ ] **Convert to invoice** - only from accepted status
- [ ] **Duplicate protection** - no duplicate invoices from conversion
- [ ] **Preserve quotation link** - invoice remembers source quotation
- [ ] **Record acceptance details** - name, designation, date
- [ ] **Record rejection reasons** - mandatory on reject
- [ ] **Duplicate quotation** - creates fresh draft with today's dates
- [ ] **Email quotation** - sends with preview/PDF
- [ ] **Mark as expired** - automatic or manual
- [ ] **Archive quotation** - soft delete preserving history

### Invoice Workflow

- [ ] **Create invoice** - from scratch or convert from quotation
- [ ] **Status transitions** - draft → issued → sent → partially_paid → paid / overdue / void
- [ ] **Void invoices** - mandatory reason, audit trail
- [ ] **Record payments** - multiple methods, allocation to invoices
- [ ] **Partial payments** - update outstanding balance
- [ ] **Fully paid invoices** status = 'paid', never 'overdue'
- [ ] **Credit notes** - for returns, corrections, adjustments
- [ ] **Duplicate invoices** - new number, don't reuse issued numbers
- [ ] **Invoice duplication** - creates draft copy of draft only
- [ ] **Payment history** - view all payments per invoice
- [ ] **Outstanding balance** - calculated from payments + credits
- [ ] **Overdue calculation** - due date + outstanding balance

### Payment Tracking

- [ ] **Payment methods** - cash, bank transfer, card, DuitNow QR, FPX, cheque
- [ ] **Receipt generation** - unique receipt number, PDF
- [ ] **Payment allocation** - one payment to multiple invoices, partial payments
- [ ] **Payment reversals** - mandatory reason, audit trail preserved
- [ ] **Unallocated payments** - where supported
- [ ] **External transaction references** - recorded but not verified automatically
- [ ] **Currency support** - MYR displays correctly
- [ ] **Receipt printing** - A4 format, layout preserved

### Reports & Financial Analytics

- [ ] **Dashboard** - all key metrics displayed
- [ ] **Quotation summary** - counts by status, conversion rate
- [ ] **Invoice summary** - issued, paid, outstanding totals
- [ ] **Outstanding receivables** - amount owed, aging
- [ ] **Overdue invoice report** - list with aging buckets
- [ ] **Payment collection report** - received vs outstanding by period
- [ ] **Customer transaction statement** - per-customer history
- [ ] **Sales by customer** - revenue per customer
- [ ] **Sales by product/service** - revenue per item
- [ ] **Monthly invoiced totals** - time-series chart
- [ ] **Monthly collections** - time-series chart
- [ ] **Tax summary** - based on configured tax treatments
- [ ] **Credit note summary** - totals by type/reason
- [ ] **Date-range filters** - all reports support custom ranges
- [ ] **CSV export** - all reports exportable
- [ ] **Clear labeling** - issuance vs collection vs revenue recognition

### Security

- [ ] **No secrets in NEXT_PUBLIC_* environment variables**
- [ ] **Database credentials** not exposed to browser
- [ ] **Blob access tokens** not in client code or logs
- [ ] **SQL injection protection** - all queries use parameterized queries/ORM
- [ ] **XSS protection** - safe output encoding on all pages
- [ ] **Input validation** - Zod schemas on all server actions
- [ ] **CSRF tokens** on all forms
- [ ] **Rate limiting** on sensitive endpoints (login, password reset, API)
- [ ] **Brute-force protection** - account lockout + progressive delays
- [ ] **Upload validation** - MIME type, file signature, size limits
- [ ] **Executable file rejection** - .exe, .script, etc. rejected
- [ ] **Safe error messages** - no stack traces or secrets leaked to users
- [ ] **Audit logs** - critical events logged (auth, permissions, data changes)
- [ ] **Audit log protection** - ordinary users cannot modify/delete audit records
- [ ] **Permission checks** on all file downloads (private Blob files)
- [ ] **Direct object reference protection** - verify user owns record before access
- [ ] **Privilege escalation prevention** - cannot bypass role checks
- [ ] **Dependency vulnerability checks** - `npm audit` clean or remediated

### Testing

- [ ] **Unit tests passing** - `npm run test` (28 tests, all green)
- [ ] **E2E tests passing** - `npm run test:e2e` (Playwright tests)
- [ ] **Authorization tests** - Viewer cannot create/edit/issue documents
- [ ] **Cross-company data isolation** - cannot access another company's records
- [ ] **Concurrency tests** - no duplicate numbers under load
- [ ] **Financial calculation tests** - rounding, discounts, tax precision
- [ ] **Partial payment tests** - balance updates correctly
- [ ] **PDF generation tests** - layout, totals, fonts verified
- [ ] **Email sending tests** - send and log successfully
- [ ] **CSV import/export tests** - data validates, reports failed rows
- [ ] **Production build test** - `npm run build` passes

### Documentation

- [ ] **README.md** - development, deployment, backup, recovery instructions
- [ ] **ER-DIAGRAM.md** - entity-relationship diagram with all tables
- [ ] **DEPLOYMENT-GUIDE.md** - Vercel + Neon + Resend setup steps
- [ ] **PRODUCTION-CHECKLIST.md** - this file, all items complete
- [ ] **Environment variable example** - `.env.example` without real secrets
- [ ] **Neon database setup guide** - provisioning and connection steps
- [ ] **Vercel Blob setup guide** - storage configuration steps
- [ ] **Email configuration guide** - Resend setup and credentials
- [ ] **Database ER diagram** - visual or markdown diagram
- [ ] **Implementation checklist** - tracked throughout development

### Backup & Recovery

- [ ] **Database backup strategy** - Neon PITR or automated backups enabled
- [ ] **Blob file backup** - important files downloaded periodically
- [ ] **Export procedure** - how to export business data
- [ ] **Recovery test** - can restore database from backup
- [ ] **File restoration** - can re-upload and associate with records
- [ ] **Email provider outage** - application remains functional (emails queue/skip)
- [ ] **Database connection error** - graceful fallback, safe error messages
- [ ] **Production health checks** - monitoring application errors and usage

### Final Verification

- [ ] **Full sign-in flow** - login, navigate, create, edit, export, logout
- [ ] **Multi-company isolation** - if enabled, verify company A cannot see B's data
- [ ] **All navigation items** only show for authorized users
- [ ] **Responsive design** - desktop, tablet, mobile views work
- [ ] **Accessibility** - keyboard navigation, screen reader friendly
- [ ] **Toast notifications** - success/error messages displayed
- [ ] **Loading skeletons** - all data fetches show loading state
- [ ] **Empty states** - no data displays appropriately
- [ ] **Confirmation dialogs** - critical actions (delete, void, archive)
- [ ] **Print documents** - A4, layout, fonts, page numbers
- [ ] **Download PDFs** - correct filename, content, selectable text

---
*Last updated: Production readiness verification for Quotation & Invoicing Management System*