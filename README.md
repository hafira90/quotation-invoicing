# Quotation & Invoicing Management System

A complete, production-ready web-based Quotation and Invoicing Management System built with Next.js, TypeScript, Tailwind CSS, and PostgreSQL (Neon Serverless).

## 📋 Overview

This application enables businesses to manage customers, products and services, create customizable quotations and invoices, track payments, generate professional PDFs, print documents, and view financial reports.

### Key Features

- **Authentication**: Secure login/out with email/password, forgot password flow, session management
- **Customer Management**: Full CRUD, search/filter/paginate, CSV import/export, duplicate detection
- **Product Catalogue**: SKU/name/description management with tax categories and pricing
- **Quotation Workflow**: Create, edit, issue, send, accept/reject, convert to invoice, duplicate, export
- **Invoice Management**: Create, edit, issue, send, record payments, void, credit notes, duplicate
- **Payment Tracking**: Multiple payment methods, receipts, allocation, reversals with audit trail
- **Credit Notes**: For returns, corrections, and adjustments
- **Document Designer**: Visual template customization for all document types
- **Financial Reports**: Comprehensive reports with date-range filters and CSV export
- **Email Integration**: Transactional emails via Resend for quotations, invoices, receipts, credit notes
- **Audit Trail**: Complete logging of all critical operations
- **Role-Based Access Control**: Super Admin, Administrator, Sales, Finance, Viewer roles

## 🛠️ Technology Stack

- **Framework**: Next.js 16.4.3 with App Router and TypeScript
- **Styling**: Tailwind CSS 4.x with shadcn/ui component system
- **Database**: Neon Serverless PostgreSQL (provisioned via Vercel Marketplace)
- **ORM**: Drizzle ORM 0.45.x
- **Validation**: Zod 4.6.x
- **PDF Generation**: pdfmake 0.3.x (server-side rendering)
- **Email**: Resend transactional email API
- **Testing**: Vitest 5.x + Playwright 1.64.x for E2E
- **Deployment**: Vercel with separate development, preview, and production environments

## 📦 Prerequisites

- Node.js 20+ (recommended: latest LTS)
- npm, pnpm, or bun
- Vercel account (for deployment)
- Neon database (provisioned via Vercel Marketplace)
- Resend account (for transactional emails)

## 🚀 Quick Start

### 1. Installation

```bash
# Install dependencies
npm install
# or
pnpm install
# or
bun install
```

### 2. Environment Configuration

Copy `.env.example` to `.env.local` and fill in the required values:

```bash
cp .env.example .env.local
```

Required environment variables:

| Variable | Description |
|---|---|
| `DATABASE_URL` | Pooled Neon connection string (auto-injected by Vercel Marketplace) |
| `DATABASE_URL_DIRECT` | Direct Neon endpoint for drizzle-kit migrations |
| `BETTER_AUTH_SECRET` | Session/token signing secret (generate with `node -e "console.log(require('crypto').randomBytes(32).toString('base64))"`) |
| `BETTER_AUTH_URL` | Base URL of the app (e.g., `http://localhost:3000`) |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob write token (for file storage) |
| `RESEND_API_KEY` | Resend API key for transactional emails |
| `EMAIL_SENDER_NAME` | Sender name shown on outgoing emails |
| `EMAIL_SENDER_ADDRESS` | Verified sender address in Resend |
| `EMAIL_REPLY_TO` | Optional reply-to address |

### 3. Database Setup

```bash
# Generate Drizzle migrations
npm run db:generate

# Run migrations
npm run db:migrate

# Check database status
npm run db:check
```

### 4. Run Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:3000`. 

### 5. Create First Super Administrator

```bash
# Ensure DATABASE_URL points to the database where the account should be created.
npm run bootstrap:admin
```

This creates the company defaults, roles, permissions, and the first Super Admin
if they do not already exist. Set `ADMIN_EMAIL` and optionally `ADMIN_NAME` to
choose the account details. If `ADMIN_PASSWORD` is omitted, the script generates
a strong password and prints it once; save it in a password manager. The script
does not reset passwords for existing users.

### 6. Seed Demonstration Data (optional)

```bash
npm run seed
```

This populates the database with sample customers, products, and business settings for testing.

## 📚 Usage

### Authentication

- **Login**: Access the login page at `/login` and enter your credentials
- **Forgot Password**: Use the forgot password link to receive a reset token via email
- **Logout**: Click the user profile menu and select "Sign Out"

### Navigation

The sidebar provides access to all major sections:

1. **Dashboard** - Overview of quotations, invoices, and financial metrics
2. **Quotations** - Create, manage, and convert quotations
3. **Invoices** - Create, manage, and track invoices and payments
4. **Customers** - Manage customer database with search and filters
5. **Products & Services** - Product catalogue management
6. **Payments & Receipts** - Record and track payments
7. **Credit Notes** - Create and manage credit notes/adjustments
8. **Reports** - Financial reports and analytics
9. **Document Designer** - Customize document templates
10. **User Management** - Admin-only: create/disable/reactivate users, assign roles
11. **Settings** - Configure business settings, tax, numbering, email
12. **Audit Logs** - View complete audit trail of all operations

### Key Workflows

#### Creating a Quotation

1. Navigate to **Quotations** → **New Quotation**
2. Select or create a customer
3. Add products/services from the catalogue or add custom line items
4. Set quantities, unit prices, discounts, and taxes
5. Review the preview and issue the quotation
6. Send via email or mark as sent
7. Track acceptance/rejection status

#### Converting a Quotation to Invoice

1. Ensure the quotation status is "accepted"
2. Navigate to the quotation detail page
3. Click **"Convert to Invoice"**
4. Review and edit invoice details if needed
5. The invoice is created atomically with all line items preserved

#### Recording a Payment

1. Navigate to **Payments & Receipts** → **New Payment**
2. Select the invoice(s) to apply the payment to
3. Choose payment method (cash, bank transfer, card, etc.)
4. Enter the amount received
5. The system updates outstanding balances automatically

## 🏗️ Architecture

### Database Schema

Key tables include:

- **users** - User accounts with Better Auth
- **companies** - Business entity with legal details
- **business_settings** - Per-company defaults (currency, locale, tax treatment, etc.)
- **customers** - Customer database with addresses and payment terms
- **products** - Product/service catalogue with SKUs and tax categories
- **quotations** - Quotation headers with status tracking
- **quotation_items** - Quotation line items
- **invoices** - Invoice headers
- **invoice_items** - Invoice line items
- **payments** - Payment records with receipt numbers
- **credit_notes** - Credit note records
- **document_sequences** - Concurrency-safe numbering counters
- **document_events** - Status transition audit trail
- **email_logs** - Email sending history
- **audit_logs** - Complete audit trail of all operations
- **stored_files** - Vercel Blob storage metadata
- **payment_methods** - Configurable payment methods

### Authentication & Authorization

- Uses **Better Auth** for session management
- Role-based access control with 5 roles: Super Admin, Administrator, Sales, Finance, Viewer
- All server-side operations enforce permission checks
- CSRF protection on forms
- Secure, HttpOnly cookies with SameSite and Secure flags

### Document Rendering Strategy

- **PDF Generation**: Server-side using pdfmake with deterministic layout
- **Print Preview**: CSS print stylesheet for browser printing
- **Template Designer**: Visual editor with live preview
- **Historical Documents**: Snapshot template configuration at issuance time
- **Consistency**: Same layout model for both downloadable PDFs and browser printing

### Numbering Engine

- Concurrency-safe document numbering using PostgreSQL `SELECT ... FOR UPDATE`
- Configurable patterns: `QUO-2026-00001`, `INV-2026-00001`, etc.
- Never derived from `COUNT(*)` - uses sequence counters with row locks
- Supports prefixes, year components, and padding

## 📦 Deployment

### Vercel Deployment

1. Push your code to a Git repository (GitHub, GitLab, or Bitbucket)
2. Connect your repository to Vercel
3. In Vercel project settings, add environment variables:
   - All variables from `.env.example`
   - Ensure `DATABASE_URL` is set via Vercel Marketplace → Neon integration
4. Vercel will automatically detect the `next.config.ts` and configure the build
5. Deploy - the app will be available at your Vercel subdomain

### Neon Database Setup

1. Sign up at [neon.tech](https://neon.tech)
2. Create a new PostgreSQL database
3. Connect to Vercel: In your Vercel project, go to "Marketplace" → "Neon" and follow the integration
4. The `DATABASE_URL` will be automatically injected by Vercel

### Vercel Blob Storage

1. In your Vercel project, go to "Storage" → "Blob"
2. Click "Connect" to provision Blob storage
3. The `BLOB_READ_WRITE_TOKEN` will be automatically injected
4. Files are stored with purpose-based categorization (logo, signature, stamp, document_pdf, etc.)

### Email Configuration

1. Sign up at [resend.com](https://resend.com)
2. Verify your sender domain
3. Add `RESEND_API_KEY`, `EMAIL_SENDER_NAME`, and `EMAIL_SENDER_ADDRESS` to Vercel environment variables
4. The application will automatically use Resend for transactional emails

## 🧪 Testing

### Unit Tests

```bash
npm run test
```

Runs Vitest unit tests (28 tests covering calculation engine, numbering concurrency, etc.)

### E2E Tests

```bash
npm run test:e2e
```

Runs Playwright end-to-end tests against the development server.

### Test Coverage

- Calculation engine: rounding, discount allocation, tax precision
- Numbering concurrency: no duplicate numbers under concurrent load
- Document workflows: creation, status transitions, conversion
- Authorization: role-based access controls
- Financial calculations: decimal-safe arithmetic

## 📋 Production Readiness Checklist

- [ ] All environment variables configured in Vercel
- [ ] Neon database connected via Vercel Marketplace
- [ ] Vercel Blob storage provisioned
- [ ] Resend account verified with sender domain
- [ ] First super administrator created via `npm run bootstrap:admin`
- [ ] Database migrations run (`npm run db:migrate`)
- [ ] Unit tests passing (`npm run test`)
- [ ] E2E tests passing (`npm run test:e2e`)
- [ ] Custom domain configured (optional)
- [ ] Backup and recovery procedures documented
- [ ] Monitoring and error tracking set up

## 🆘 Common Issues

### "DATABASE_URL not configured"

Ensure you've connected the Neon integration via Vercel Marketplace and the `DATABASE_URL` environment variable is set.

### "RESEND_API_KEY not configured"

Add your Resend API key to Vercel environment variables. The app will gracefully fall back to showing setup instructions instead of sending emails.

### "BLOB_READ_WRITE_TOKEN not configured"

Provision Vercel Blob storage and ensure the token is set. Without this, file uploads and PDF storage will not work.

### TypeScript errors after adding new files

Run `npm run typecheck` or `npx tsc --noEmit` to verify compilation.

### Migration failures

Run `npm run db:check` to diagnose schema issues. Ensure `DATABASE_URL_DIRECT` is set for DDL operations.

## 📞 Support

For issues, questions, or contributions, please refer to the codebase or open an issue in the repository.

---
Built with ❤️ for secure, professional quotation and invoicing management.