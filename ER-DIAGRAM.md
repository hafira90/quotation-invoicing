# Entity-Relationship Diagram

## Overview

This diagram illustrates the key entity relationships in the Quotation & Invoicing Management System. The schema is normalized for data integrity and supports multi-company isolation through `company_id` foreign keys.

## Core Entities and Relationships

### 1. Companies (Root Isolation)

| Field | Type |
|---|---|
| `id` (PK) | uuid |
| `legal_name` | text |
| `trading_name` | text |
| `registration_number` | text |
| `email` | text |
| `phone` | text |
| `website` | text |

**Relationships:**
- **1-to-Many**: Companies → Users (via `company_id`)
- **1-to-Many**: Companies → Business Settings (1:1 via primary key)
- **1-to-Many**: Companies → All other tables (customers, products, quotations, invoices, etc.)

### 2. Users & Authentication

| Field | Type |
|---|---|
| `id` (PK) | uuid |
| `email` (UK) | text |
| `name` | text |
| `status` | enum: 'active', 'disabled' |
| `failed_login_attempts` | integer |
| `locked_until` | timestamp |

**Relationships:**
- **1-to-Many**: Users → User Roles
- **1-to-Many**: Users → Sessions
- **1-to-Many**: Users → Two Factor auth
- **Many-to-Many**: Users ↔ Roles (via `user_roles` junction table)
- **1-to-Many**: Users → Audit Logs (as actor)
- **1-to-Many**: Users → Stored Files (as uploader)

### 3. Roles & Permissions

| Field | Type |
|---|---|
| `id` (PK) | uuid (roles) / text (permissions) |
| `name` / `key` | text |
| `is_system` | boolean |

**Relationships:**
- **Many-to-Many**: Roles ↔ Users (via `user_roles`)
- **Many-to-Many**: Roles ↔ Permissions (via `role_permissions`)
- Each role has specific `PermissionCode` entries controlling access to quotations, invoices, customers, products, settings, etc.

### 4. Customers

| Field | Type |
|---|---|
| `id` (PK) | uuid |
| `company_id` (FK) | uuid |
| `customer_type` | enum: 'individual', 'company' |
| `name` / `legal_name` | text |
| `email` | text |
| `phone` | text |
| `registration_number` | text |
| `tax_registration_number` | text |
| `tax_exempt` | boolean |
| `status` | enum: 'active', 'archived' |
| `payment_terms_days` | integer |

**Relationships:**
- **Many-to-One**: Customers → Companies
- **1-to-Many**: Customers → Quotations (via `customer_id`)
- **1-to-Many**: Customers → Invoices (via `customer_id`)
- **1-to-Many**: Customers → Payments (via `customer_id`)
- **1-to-Many**: Customers → Credit Notes (via `customer_id`)
- **1-to-Many**: Customers → Customer Addresses

### 5. Products & Services

| Field | Type |
|---|---|
| `id` (PK) | uuid |
| `company_id` (FK) | uuid |
| `kind` | enum: 'product', 'service' |
| `sku` | text (unique per company) |
| `name` | text |
| `description` | text |
| `category_id` (FK) | uuid → product_categories |
| `unit_price` | numeric(18, 4) |
| `cost_price` | numeric(18, 4) (authorized only) |
| `discount_type` | enum: 'none', 'percent', 'amount' |
| `discount_value` | numeric(18, 4) |
| `tax_rate_id` (FK) | uuid → tax_rates |
| `image_file_id` (FK) | uuid → stored_files |
| `status` | enum: 'active', 'archived' |

**Relationships:**
- **Many-to-One**: Products → Companies
- **Many-to-One**: Products → Categories (self-referential possible)
- **Many-to-One**: Products → Tax Rates
- **Many-to-One**: Products → Stored Files (images)
- **1-to-Many**: Products → Quotation Items
- **1-to-Many**: Products → Invoice Items
- **1-to-Many**: Products → Credit Note Items

### 6. Quotations

| Field | Type |
|---|---|
| `id` (PK) | uuid |
| `company_id` (FK) | uuid |
| `customer_id` (FK) | uuid → customers |
| `status` | enum: 'draft', 'issued', 'sent', 'accepted', 'rejected', 'expired', 'converted', 'cancelled' |
| `quotation_number` | text (unique per company) |
| `issue_date` | date |
| `expiry_date` | date |
| `currency` | text |
| `customer_po` | text |
| `subtotal`, `discount_total`, `shipping_total`, `tax_total`, `grand_total` | numeric |
| `document_discount_type` | enum: 'none', 'percent', 'amount' |
| `document_discount_value` | numeric |
| `issued_at`, `accepted_at`, `rejected_at`, `expired_at`, `converted_at`, `archived_at` | timestamp |

**Relationships:**
- **Many-to-One**: Quotations → Companies
- **Many-to-One**: Quotations → Customers
- **One-to-Many**: Quotations → Quotation Items (cascade delete)
- **One-to-One**: Quotations → Invoices (via `quotation_id`, restricted to 'converted' status)
- **One-to-Many**: Quotations → Document Events (status transitions)
- **One-to-Many**: Quotations → Payment Milestones

### 7. Quotation Items

| Field | Type |
|---|---|
| `id` (PK) | uuid |
| `quotation_id` (FK) | uuid → quotations |
| `line_no` | integer |
| `product_id` (FK) | uuid → products |
| `sku` | text |
| `name` | text |
| `description` | text |
| `unit` | text |
| `quantity` | numeric(14, 4) |
| `unit_price` | numeric(18, 4) |
| `discount_type` | enum: 'none', 'percent', 'amount' |
| `discount_value` | numeric(18, 4) |
| `tax_rate_id` (FK) | uuid → tax_rates |
| `tax_rate` | numeric(9, 4) |
| `tax_inclusive` | boolean |
| `tax_amount` | numeric(18, 4) |
| `line_subtotal`, `line_total` | numeric(18, 4) |

**Relationships:**
- **Many-to-One**: Quotation Items → Quotations (cascade delete)
- **Many-to-One**: Quotation Items → Products (set null on delete)

### 8. Invoices

| Field | Type |
|---|---|
| `id` (PK) | uuid |
| `company_id` (FK) | uuid |
| `customer_id` (FK) | uuid → customers |
| `quotation_id` (FK) | uuid → quotations (unique where not void) |
| `invoice_number` | text (unique per company) |
| `status` | enum: 'draft', 'issued', 'sent', 'partially_paid', 'paid', 'overdue', 'void' |
| `issue_date` | date |
| `due_date` | date |
| `currency` | text |
| `customer_po` | text |
| `project_reference` | text |
| `subtotal`, `discount_total`, `shipping_total`, `tax_total`, `grand_total` | numeric |
| `document_discount_type`, `document_discount_value` | text/numeric |
| `deposit_amount` | numeric |
| `issued_at`, `voided_at` | timestamp |
| `void_reason` | text (required on void) |

**Relationships:**
- **Many-to-One**: Invoices → Companies
- **Many-to-One**: Invoices → Customers (restrict on delete)
- **One-to-One**: Invoices → Quotations (unique constraint, only when quotation_id is set and status ≠ 'void')
- **One-to-Many**: Invoices → Invoice Items (cascade delete)
- **One-to-Many**: Invoices → Payment Allocations (restrict on delete)
- **One-to-Many**: Invoices → Document Events

### 8. Invoice Items

| Field | Type |
|---|---|
| `id` (PK) | uuid |
| `invoice_id` (FK) | uuid → invoices |
| `line_no` | integer |
| `product_id` (FK) | uuid → products |
| `sku` | text |
| `name` | text |
| `description` | text |
| `unit` | text |
| `quantity` | numeric(14, 4) |
| `unit_price` | numeric(18, 4) |
| `discount_type` | enum: 'none', 'percent', 'amount' |
| `discount_value` | numeric(18, 4) |
| `tax_rate_id` (FK) | uuid → tax_rates |
| `tax_rate` | numeric(9, 4) |
| `tax_inclusive` | boolean |
| `tax_amount` | numeric(18, 4) |
| `line_subtotal`, `line_total` | numeric(18, 4) |

**Relationships:**
- **Many-to-One**: Invoice Items → Invoices (cascade delete)
- **Many-to-One**: Invoice Items → Products (set null on delete)

### 9. Payments

| Field | Type |
|---|---|
| `id` (PK) | uuid |
| `company_id` (FK) | uuid |
| `customer_id` (FK) | uuid → customers |
| `payment_date` | date |
| `method_code` | text (cash, transfer, card, etc.) |
| `amount` | numeric(18, 2) |
| `currency` | text |
| `external_reference` | text (transaction reference) |
| `status` | enum: 'recorded', 'reversed' |
| `reversal_reason` | text |
| `reversed_at`, `reversed_by` | timestamp / text |
| `recorded_by` | text → users.id |
| `created_at` | timestamp |

**Relationships:**
- **Many-to-One**: Payments → Companies
- **Many-to-One**: Payments → Customers
- **One-to-Many**: Payments → Payment Allocations (cascade delete)
- **One-to-One**: Payments → Receipts (one receipt per payment)

### 10. Payment Allocations

| Field | Type |
|---|---|
| `id` (PK) | uuid |
| `payment_id` (FK) | uuid → payments |
| `invoice_id` (FK) | uuid → invoices |
| `amount` | numeric(18, 2) |

**Relationships:**
- **Many-to-One**: Payment Allocations → Payments (cascade delete)
- **Many-to-One**: Payment Allocations → Invoices (restrict on delete)
- **Unique Constraint**: (`payment_id`, `invoice_id`) - prevents double allocation

### 11. Credit Notes

| Field | Type |
|---|---|
| `id` (PK) | uuid |
| `company_id` (FK) | uuid |
| `invoice_id` (FK) | uuid → invoices |
| `customer_id` (FK) | uuid → customers |
| `status` | enum: 'draft', 'issued' |
| `issue_date` | date |
| `currency` | text |
| `reason` | text (required, length > 0) |
| `subtotal`, `discount_total`, `tax_total`, `credit_total` | numeric(18, 2) |
| `issued_at`, `voided_at` | timestamp |
| `void_reason` | text |

**Relationships:**
- **Many-to-One**: Credit Notes → Companies
- **Many-to-One**: Credit Notes → Invoices (restrict on delete)
- **Many-to-One**: Credit Notes → Customers (restrict on delete)
- **One-to-Many**: Credit Note Items → Credit Notes (cascade delete)

### 11. Credit Note Items

| Field | Type |
|---|---|
| `id` (PK) | uuid |
| `credit_note_id` (FK) | uuid → credit_notes |
| `line_no` | integer |
| `product_id` (FK) | uuid → products |
| `sku` | text |
| `name` | text |
| `description` | text |
| `unit` | text |
| `quantity` | numeric(14, 4) |
| `unit_price` | numeric(18, 4) |
| `discount_type` | enum: 'none', 'percent', 'amount' |
| `discount_value` | numeric(18, 4) |
| `tax_amount` | numeric(9, 4) |
| `tax_inclusive` | boolean |
| `line_subtotal`, `line_total` | numeric(18, 4) |

**Relationships:**
- **Many-to-One**: Credit Note Items → Credit Notes (cascade delete)
- **Many-to-One**: Credit Note Items → Products (set null on delete)

### 12. Tax Rates

| Field | Type |
|---|---|
| `id` (PK) | uuid |
| `company_id` (FK) | uuid |
| `code` | text |
| `name` | text |
| `rate` | numeric(9, 4) |
| `is_inclusive` | boolean ('exclusive' = tax on top, 'inclusive' = tax inside price) |
| `active` | boolean |

**Relationships:**
- **Many-to-One**: Tax Rates → Companies
- **Many-to-One**: Products → Tax Rates (set null on delete)
- **Many-to-One**: Invoice Items → Tax Rates (set null on delete)
- **Many-to-One**: Quotation Items → Tax Rates (set null on delete)

### 13. Business Settings

| Field | Type |
|---|---|
| `company_id` (PK, FK) | uuid → companies |
| `default_currency` | text (3-char code, default: 'MYR') |
| `default_locale` | text (default: 'en-MY') |
| `default_timezone` | text (default: 'Asia/Kuala_Lumpur') |
| `default_document_language` | enum: 'en', 'ms' |
| `bilingual_documents` | boolean |
| `date_format` | text (default: 'dd/MM/yyyy') |
| `number_format` | text (default: 'en-MY') |
| `payment_terms_days` | integer (default: 30) |
| `quotation_validity_days` | integer (default: 14) |
| `invoice_due_days` | integer (default: 30) |
| `tax_treatment` | enum: 'exclusive', 'inclusive' |
| `tax_label` | text (default: 'SST') |
| `sst_registered` | boolean |
| `sst_registration_number` | text |
| `paper_size` | enum: 'A4', 'Letter', 'A5' (default: 'A4') |
| `page_orientation` | enum: 'portrait', 'landscape' (default: 'portrait') |
| `page_margins` | jsonb |
| `email_sender_name` | text |
| `email_sender_address` | text |
| `email_reply_to` | text |
| `label_overrides` | jsonb |

**Relationships:**
- **1-to-1**: Companies → Business Settings (via primary key)

### 14. Document Templates

| Field | Type |
|---|---|
| `id` (PK) | uuid |
| `company_id` (FK) | uuid → companies |
| `doc_type` | enum: 'quotation', 'invoice', 'receipt', 'credit_note' |
| `name` | text |
| `description` | text |
| `is_default` | boolean |
| `active` | boolean |
| `current_version` | integer |
| `created_by` | text → users.id |

**Relationships:**
- **Many-to-One**: Templates → Companies
- **One-to-Many**: Templates → Template Versions (cascade delete)

### 15. Document Template Versions

| Field | Type |
|---|---|
| `id` (PK) | uuid |
| `template_id` (FK) | uuid → document_templates |
| `version` | integer |
| `config` | jsonb (full template configuration) |
| `note` | text |
| `created_by` | text → users.id |

**Relationships:**
- **Many-to-One**: Template Versions → Document Templates

### 16. Document Snapshots

| Field | Type |
|---|---|
| `id` (PK) | uuid |
| `company_id` (FK) | uuid → companies |
| `document_type` | enum: 'quotation', 'invoice', 'receipt', 'credit_note' |
| `document_id` | uuid → respective document |
| `revision` | integer (default: 1) |
| `template_id` | uuid → document_templates |
| `template_version_id` | uuid → document_template_versions |
| `snapshot` | jsonb (preserved business details, line items, totals, template config) |
| `pdf_file_id` | uuid → stored_files |
| `created_by` | text → users.id |

**Relationships:**
- **Many-to-One**: Snapshots → Companies
- **Many-to-One**: Snapshots → Document Templates
- **Many-to-One**: Snapshots → Template Versions
- **Many-to-One**: Snapshots → Stored Files (PDF binary, set null on delete)

### 17. Stored Files (Vercel Blob)

| Field | Type |
|---|---|
| `id` (PK) | uuid |
| `company_id` (FK) | uuid → companies |
| `purpose` | enum: 'logo', 'secondary_logo', 'signature', 'stamp', 'product_image', 'document_pdf', 'attachment' |
| `storage_key` | text (unique, content-versioned) |
| `url` | text (public or private based on visibility) |
| `visibility` | enum: 'public', 'private' (default: 'private') |
| `content_type` | text |
| `size_bytes` | integer |
| `checksum_sha256` | text |
| `original_name` | text |
| `uploaded_by` | text → users.id |

**Relationships:**
- **Many-to-One**: Stored Files → Companies
- **Many-to-One**: Stored Files → Users (as uploader, set null on delete)
- **Many-to-One**: Companies → Stored Files (logo, signature, stamp via company record)
- **Many-to-One**: Document Snapshots → Stored Files (PDF, set null on delete)

### 18. Document Events (Audit Trail for Status Changes)

| Field | Type |
|---|---|
| `id` (PK) | uuid |
| `company_id` (FK) | uuid → companies |
| `document_type` | enum: 'quotation', 'invoice', 'payment', 'credit_note' |
| `document_id` | uuid |
| `event` | text (the action taken) |
| `from_status` | text |
| `to_status` | text |
| `actor_user_id` (FK) | uuid → users |
| `note` | text |
| `metadata` | jsonb |
| `created_at` | timestamp |

**Relationships:**
- **Many-to-One**: Document Events → Companies
- **Many-to-One**: Document Events → Users (as actor, set null on delete)

### 19. Email Logs

| Field | Type |
|---|---|
| `id` (PK) | uuid |
| `company_id` (FK) | uuid → companies |
| `document_type` | enum: 'quotation', 'invoice', 'receipt', 'credit_note' |
| `document_id` | uuid |
| `recipient` | text |
| `subject` | text |
| `status` | enum: 'pending', 'sent', 'failed' |
| `provider` | text (e.g., 'resend') |
| `provider_message_id` | text |
| `error` | text |
| `attempt_count` | integer |
| `sent_at` | timestamp |
| `created_by` | text → users.id |

**Relationships:**
- **Many-to-One**: Email Logs → Companies
- **Many-to-One**: Email Logs → Users (as creator, set null on delete)

### 20. Payment Methods

| Field | Type |
|---|---|
| `id` (PK) | uuid |
| `company_id` (FK) | uuid → companies |
| `code` | text (unique per company) |
| `label` | text (e.g., 'Cash', 'Bank Transfer', 'DuitNow QR') |
| `active` | boolean |
| `sort_order` | integer |

**Relationships:**
- **Many-to-One**: Payment Methods → Companies

### 21. Reporting Periods

| Field | Type |
|---|---|
| `id` (PK) | uuid |
| `company_id` (FK) | uuid → companies |
| `label` | text |
| `starts_on` | date |
| `ends_on` | date |
| `closed_at` | timestamp |

**Relationships:**
- **Many-to-One**: Reporting Periods → Companies

### 22. Customer Addresses

| Field | Type |
|---|---|
| `id` (PK) | uuid |
| `company_id` (FK) | uuid → companies |
| `customer_id` (FK) | uuid → customers |
| `kind` | enum: 'billing', 'shipping' |
| `label` | text |
| `line1`, `line2` | text |
| `city`, `state` | text |
| `postcode`, `country` | text (default: 'MY') |
| `is_default` | boolean |

**Relationships:**
- **Many-to-One**: Customer Addresses → Companies
- **Many-to-One**: Customer Addresses → Customers

### 23. Application Settings

| Field | Type |
|---|---|
| `company_id` (PK, FK) | uuid → companies |
| `key` | text |
| `value` | jsonb |
| `updated_by` | text → users.id |

**Relationships:**
- **1-to-Many**: Companies → Application Settings (via company_id)
- **Many-to-One**: Application Settings → Users

## Key Constraints and Indexes

### Unique Constraints (preventing duplicates)

1. **`users_email_uq`**: `LOWER(email)` must be unique across all users
2. **`companies_registration_number_uq`**: (Implicit - registration_number not unique globally, but per-company context)
3. **`products_sku_uq`**: `LOWER(sku)` must be unique per company WHERE sku IS NOT NULL
4. **`tax_rates_company_code_uq`**: `LOWER(code)` must be unique per company
5. **`credit_note_number_uq`**: `company_id + credit_note_number` must be unique
6. **`invoice_number_uq`**: `company_id + invoice_number` must be unique
7. **`quotation_number_uq`**: `company_id + quotation_number` must be unique
8. **`receipt_number_uq`**: `company_id + receipt_number` must be unique
9. **`invoice_quotation_uq`**: `quotation_id` must be unique per invoice WHERE quotation_id IS NOT NULL AND status ≠ 'void'
10. **`payment_allocations_uq`**: (`payment_id`, `invoice_id`) unique combination
11. **`credit_note_items_line_uq`**: `credit_note_id + line_no` must be unique
12. **`invoice_items_line_uq`**: `invoice_id + line_no` must be unique
13. **`document_snapshots_revision_uq`**: (`document_type`, `document_id`, `revision`) unique
14. **`template_versions_uq`**: (`template_id`, `version`) must be unique
15. **`document_templates_name_uq`**: (`company_id`, `doc_type`, `name`) must be unique
16. **`document_templates_default_uq`**: (`company_id`, `doc_type`) WHERE is_default = true must be unique
17. **`product_categories_name_uq`**: (`company_id`, `LOWER(name)`) must be unique
18. **`payment_methods_company_code_uq`**: (`company_id`, `code`) must be unique

### Key Indexes (for query performance)

- `customers_company_status_idx` - filter customers by company + status
- `customers_company_name_idx` - search customers by company + name (case-insensitive)
- `customers_email_idx` - case-insensitive email lookup
- `customers_phone_idx` - phone number lookup
- `products_company_status_idx` - filter products by company + status
- `products_company_name_idx` - search products by company + name
- `products_category_idx` - filter products by category
- `products_sku_uq` - unique SKU enforcement
- `tax_rates_company_code_uq` - unique tax rate code per company
- `credit_note_allocations_uq` - (`credit_note_id`, `invoice_id`)
- `credit_notes_number_uq` - (`company_id`, `credit_note_number`)
- `invoices_number_uq` - (`company_id`, `invoice_number`)
- `invoices_quotation_uq` - unique quotation reference per invoice
- `invoices_company_status_idx` - filter invoices by company + status
- `invoices_company_issue_date_idx` - date-range queries on invoices
- `invoices_customer_idx` - look up invoices by customer
- `payment_allocations_uq` - (`payment_id`, `invoice_id`)
- `payment_allocations_invoice_idx` - look up allocations by invoice
- `payments_company_date_idx` - filter payments by company + date
- `payments_customer_idx` - look up payments by customer
- `quotations_number_uq` - (`company_id`, `quotation_number`)
- `quotations_company_status_idx` - filter quotations by company + status
- `quotations_company_issue_date_idx` - date-range queries on quotations
- `quotations_customer_idx` - look up quotations by customer
- `quotations_company_expiry_idx` - expiry date range queries
- `receipts_number_uq` - (`company_id`, `receipt_number`)
- `receipts_payment_uq` - unique payment reference per receipt
- `receipts_customer_idx` - look up receipts by customer
- `document_snapshots_revision_uq` - (`document_type`, `document_id`, `revision`)
- `document_snapshots_document_idx` - look up snapshots by document
- `document_snapshots_company_idx` - filter snapshots by company
- `template_versions_uq` - (`template_id`, `version`)
- `template_versions_template_idx` - look up versions by template
- `document_templates_name_uq` - (`company_id`, `doc_type`, `name`)
- `document_templates_default_uq` - (`company_id`, `doc_type`) where is_default
- `document_templates_company_type_idx` - filter templates by company + type
- `user_roles_role_idx` - look up roles per user
- `application_settings_company_id_key_idx` - look up settings by company + key
- `audit_logs_entity_idx` - (`entity_type`, `entity_id`)
- `audit_logs_actor_idx` - look up audit entries by actor
- `audit_logs_company_created_idx` - (`company_id`, `created_at`)
- `audit_logs_created_idx` - chronological audit entries
- `email_logs_company_created_idx` - (`company_id`, `created_at`)
- `email_logs_status_idx` - filter emails by status
- `email_logs_document_idx` - (`document_type`, `document_id`)
- `bank_accounts_company_idx` - filter bank accounts by company
- `customer_addresses_customer_idx` - look up addresses by customer
- `customer_addresses_kind_ck` - check constraint on kind
- `reporting_periods_company_idx` - filter periods by company

## Multi-Company Data Isolation

All core business tables include `company_id` as a foreign key referencing `companies.id` with `ON DELETE cascade`. This ensures:

1. **Data isolation**: Company A cannot access Company B's records
2. **Automatic cleanup**: When a company is deleted, all related records are cascaded
3. **Row-level security**: Applications must filter queries by `company_id`
4. **Business settings per company**: Each company has its own configuration (currency, locale, tax treatment, etc.)

## Entity Relationship Summary

```
companies (1) --- (n) users
companies (1) --- (1) business_settings
companies (1) --- (n) customers
companies (1) --- (n) products
companies (1) --- (n) quotations
companies (1) --- (n) invoices
companies (1) --- (n) payments
companies (1) --- (n) credit_notes
companies (1) --- (n) document_templates
companies (1) --- (n) stored_files
companies (1) --- (n) payment_methods
companies (1) --- (n) reporting_periods

users (1) --- (n) user_roles --- (1) roles
users (1) --- (n) sessions
users (1) --- (n) two_factor
users (1) --- (n) audit_logs (as actor)
users (1) --- (n) stored_files (as uploader)

products (1) --- (n) quotation_items (cascade)
products (1) --- (n) invoice_items (cascade)
products (1) --- (n) credit_note_items (set null)
products --- (1) product_categories (set null)

quotations (1) --- (n) quotation_items (cascade)
quotations (1) --- (1) invoices (unique, quotation_id)
quotations (1) --- (n) document_events
quotations (1) --- (n) payment_milestones

invoices (1) --- (n) invoice_items (cascade)
invoices (1) --- (n) payment_allocations (restrict)
invoices (1) --- (n) document_events
invoices (1) --- (1) credit_notes (restrict)

credit_notes (1) --- (n) credit_note_items (cascade)
credit_notes (1) --- (1) invoices (restrict)
credit_notes (1) --- (1) customers (restrict)

payment_allocations (1) --- (1) payments (cascade)
payment_allocations (1) --- (1) invoices (restrict)

document_events (n) -|----| ( ) companies
email_logs (n) -|----| ( ) companies

stored_files (1) --- (n) companies (via company_id, logo/signature/stamp)
stored_files (1) --- (n) document_snapshots (pdf_file_id, set null)
```

This ER diagram provides the foundation for all application data operations, ensuring data integrity, multi-company isolation, and auditability throughout the quotation and invoicing workflow.