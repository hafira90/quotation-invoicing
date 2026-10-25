# Invoices Listing Design

## Intent

Make the existing Invoices sidebar link usable by adding the missing `/invoices` page. The app already has `listInvoices`, invoice status definitions, permissions, and shared list-page UI patterns.

## Goal and scope

- Add a server-rendered invoice listing page under the authenticated app route group.
- Require `INVOICE_VIEW`, scope the query to the current company, and use `listInvoices`.
- Provide search, status/date filters, invoice totals/statuses, an empty state, and pagination consistent with Quotations.
- Show amount paid and outstanding using the existing query result.

## Non-goals

- Do not add invoice detail, create, edit, payment, or status-transition screens.
- Do not change invoice query semantics, actions, permissions, or database behavior.
- Do not redirect the link to another page.

## Approaches

1. Add an invoices listing backed by `listInvoices` (selected): fixes the dead link and presents existing invoice data without inventing new backend behavior.
2. Hide the sidebar link: avoids the 404 but leaves implemented invoice data inaccessible from navigation.
3. Build the entire invoice workflow: substantially exceeds the request and requires detail/form UI beyond the existing list query.

The user selected the listing page backed by the existing query. The page will follow the current Quotations list conventions while adapting columns and filters to invoice fields.

## Constraints and implementation calls

- Use Next.js App Router conventions and the existing shared table, badge, input, select, button, format, permission, and session helpers.
- Query filters: text search, status (including overdue), and issue-date range.
- List columns: invoice number, customer, effective status, issue date, due date, total, paid, and outstanding.
- Link invoice numbers only where a corresponding detail route exists; do not create links to missing screens.
- Default sort to newest-created invoices and retain active filters through pagination.

## Verification

- Add a focused test for page rendering if the existing test setup supports server-rendering this page without database mutation; otherwise validate with typecheck, lint, and production build.
- Confirm the production route list includes `/invoices`.
