# Invoices Listing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a usable authenticated `/invoices` listing backed by the existing invoice query.

**Architecture:** Create a server-rendered route in the existing `(app)` route group. It checks `INVOICE_VIEW`, scopes `listInvoices` to the current company, and follows the existing Quotations list conventions for filters, tables, and pagination.

**Tech Stack:** Next.js App Router, React, TypeScript, Drizzle-backed query, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-25-invoices-list-design.md`

## Global Constraints

- Use Next.js App Router conventions and the existing shared table, badge, input, select, button, format, permission, and session helpers.
- Query filters: text search, status (including overdue), and issue-date range.
- List columns: invoice number, customer, effective status, issue date, due date, total, paid, and outstanding.
- Link invoice numbers only where a corresponding detail route exists; do not create links to missing screens.
- Default sort to newest-created invoices and retain active filters through pagination.
- Do not add invoice detail, create, edit, payment, or status-transition screens.
- Do not change invoice query semantics, actions, permissions, or database behavior.

## Review Focus

- Search and filter values must remain scoped to the current company and preserve the filter state when paging; test the query arguments and generated pagination URLs.
- The overdue filter must use the existing effective-status-aware query behavior; test that the page passes `status: "overdue"` through unchanged.
- Empty results must show an accurate empty state and not expose an action to a missing route; test the empty-state markup.
- Paid/outstanding values must use the financial values returned from `listInvoices`; test a fixture with a partial payment.
- Users without `INVOICE_VIEW` must be rejected before the list is queried; test permission enforcement ordering.

---

### Task 1: Add the authenticated invoices listing route

**Files:**
- Create: `src/app/(app)/invoices/page.tsx`
- Test: `tests/invoices-page.test.ts`

**Interfaces:**
- Consumes `listInvoices(params: InvoiceListParams)`, `INVOICE_STATUSES`, `getCompany()`, `requirePermission(PERMISSIONS.INVOICE_VIEW)`, and the existing quotation list UI conventions.
- Produces a server page accepting `searchParams: Promise<{ q?: string; status?: string; from?: string; to?: string; sort?: string; dir?: string; page?: string }>` and rendering invoice search/filter controls, list rows, empty state, and pagination.

- [x] **Step 1: Write the failing page test**

Add `tests/invoices-page.test.ts` with Vitest mocks for `listInvoices`, `getCompany`, and `requirePermission`, then call and server-render the page.

Test names and assertions:
- `renders invoice rows and uses the current company with default sorting`: assert invoice number, customer, effective status, formatted issue/due dates, total, paid, and outstanding appear; assert permission is required and `listInvoices` receives the company ID, `sort: "created"`, `dir: "desc"`, `page: 1`, and `pageSize: 20`.
- `preserves active filters when requesting the next page`: provide q/status/date/sort/dir/page inputs, assert those inputs reach `listInvoices`, and assert the Next link retains the filters and advances the page.
- `shows an empty state without linking to missing invoice screens`: assert the no-invoices message appears and no create/detail link is rendered.
- `requires invoice view permission before querying invoices`: assert `requirePermission` is called before `listInvoices`.

- [x] **Step 2: Run the tests and verify they fail**

Run: `npx vitest run tests/invoices-page.test.ts`
Expected: FAIL because `src/app/(app)/invoices/page.tsx` does not exist.

- [x] **Step 3: Implement the listing route**

Create `InvoicesPage` in `src/app/(app)/invoices/page.tsx`. Require `PERMISSIONS.INVOICE_VIEW`, get the current company, parse the provided search parameters, and call `listInvoices` with page size 20 and default sort `created` descending. Use `INVOICE_STATUSES` for the status selector; render issue date filters, query search, rows showing all specified fields, a useful empty state, and previous/next links that preserve current filters. Do not render links to invoice detail/create routes because those routes do not exist.

- [x] **Step 4: Run the focused page test**

Run: `npx vitest run tests/invoices-page.test.ts`
Expected: all page tests pass without a database connection.

- [x] **Step 5: Run route-level quality checks**

Run:
- `npm run typecheck`
- `npx eslint 'src/app/(app)/invoices/page.tsx' tests/invoices-page.test.ts`
- `npm run build`

Expected: checks pass and the production route list includes `/invoices`.
