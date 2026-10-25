CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"code" text PRIMARY KEY NOT NULL,
	"category" text NOT NULL,
	"description" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"window_started_at" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"blocked_until" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"role_id" text NOT NULL,
	"permission_code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "role_permissions_role_id_permission_code_pk" PRIMARY KEY("role_id","permission_code")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "two_factor" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"secret" text NOT NULL,
	"backup_codes" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"user_id" text NOT NULL,
	"role_id" text NOT NULL,
	"granted_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_roles_user_id_role_id_pk" PRIMARY KEY("user_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"disabled_at" timestamp with time zone,
	"disabled_reason" text,
	"must_change_password" boolean DEFAULT false NOT NULL,
	"failed_login_attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"two_factor_enabled" boolean DEFAULT false NOT NULL,
	CONSTRAINT "user_status_ck" CHECK ("user"."status" in ('active', 'disabled'))
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "application_settings" (
	"company_id" uuid NOT NULL,
	"key" text NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "application_settings_company_id_key_pk" PRIMARY KEY("company_id","key")
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid,
	"actor_user_id" text,
	"actor_label" text,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"before" jsonb,
	"after" jsonb,
	"ip" text,
	"user_agent" text,
	"request_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"bank_name" text NOT NULL,
	"account_name" text NOT NULL,
	"account_number" text NOT NULL,
	"swift" text,
	"instructions" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business_settings" (
	"company_id" uuid PRIMARY KEY NOT NULL,
	"default_currency" text DEFAULT 'MYR' NOT NULL,
	"default_locale" text DEFAULT 'en-MY' NOT NULL,
	"default_timezone" text DEFAULT 'Asia/Kuala_Lumpur' NOT NULL,
	"default_document_language" text DEFAULT 'en' NOT NULL,
	"bilingual_documents" boolean DEFAULT false NOT NULL,
	"date_format" text DEFAULT 'dd/MM/yyyy' NOT NULL,
	"number_format" text DEFAULT 'en-MY' NOT NULL,
	"payment_terms_days" integer DEFAULT 30 NOT NULL,
	"quotation_validity_days" integer DEFAULT 14 NOT NULL,
	"invoice_due_days" integer DEFAULT 30 NOT NULL,
	"default_footer" text,
	"default_terms" text,
	"default_notes" text,
	"tax_treatment" text DEFAULT 'exclusive' NOT NULL,
	"tax_label" text DEFAULT 'SST' NOT NULL,
	"sst_registered" boolean DEFAULT false NOT NULL,
	"sst_registration_number" text,
	"paper_size" text DEFAULT 'A4' NOT NULL,
	"page_orientation" text DEFAULT 'portrait' NOT NULL,
	"page_margins" jsonb,
	"email_sender_name" text,
	"email_sender_address" text,
	"email_reply_to" text,
	"label_overrides" jsonb,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "business_settings_currency_ck" CHECK (length("business_settings"."default_currency") = 3),
	CONSTRAINT "business_settings_terms_ck" CHECK ("business_settings"."payment_terms_days" >= 0)
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legal_name" text NOT NULL,
	"trading_name" text,
	"registration_number" text,
	"tax_registration_number" text,
	"registered_address" text,
	"business_address" text,
	"phone" text,
	"email" text,
	"website" text,
	"logo_file_id" uuid,
	"secondary_logo_file_id" uuid,
	"signature_file_id" uuid,
	"stamp_file_id" uuid,
	"signatory_name" text,
	"signatory_designation" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"document_type" text NOT NULL,
	"document_id" uuid NOT NULL,
	"stored_file_id" uuid NOT NULL,
	"label" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"document_type" text NOT NULL,
	"document_id" uuid NOT NULL,
	"event" text NOT NULL,
	"from_status" text,
	"to_status" text,
	"actor_user_id" text,
	"note" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_sequences" (
	"company_id" uuid NOT NULL,
	"doc_type" text NOT NULL,
	"period" text DEFAULT 'year' NOT NULL,
	"prefix" text NOT NULL,
	"separator" text DEFAULT '-' NOT NULL,
	"padding" integer DEFAULT 5 NOT NULL,
	"next_value" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_sequences_company_id_doc_type_period_pk" PRIMARY KEY("company_id","doc_type","period"),
	CONSTRAINT "document_sequences_padding_ck" CHECK ("document_sequences"."padding" between 1 and 12),
	CONSTRAINT "document_sequences_next_ck" CHECK ("document_sequences"."next_value" >= 1)
);
--> statement-breakpoint
CREATE TABLE "email_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"document_type" text,
	"document_id" uuid,
	"recipient" text NOT NULL,
	"cc" jsonb,
	"subject" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"provider" text,
	"provider_message_id" text,
	"error" text,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"sent_at" timestamp with time zone,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_methods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"code" text NOT NULL,
	"label" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reporting_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"label" text NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "stored_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"purpose" text NOT NULL,
	"storage_key" text NOT NULL,
	"url" text NOT NULL,
	"visibility" text DEFAULT 'private' NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"checksum_sha256" text,
	"original_name" text,
	"uploaded_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "stored_files_visibility_ck" CHECK ("stored_files"."visibility" in ('public', 'private'))
);
--> statement-breakpoint
CREATE TABLE "customer_addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"label" text,
	"line1" text,
	"line2" text,
	"city" text,
	"state" text,
	"postcode" text,
	"country" text DEFAULT 'MY' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_addresses_kind_ck" CHECK ("customer_addresses"."kind" in ('billing', 'shipping'))
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"customer_type" text DEFAULT 'company' NOT NULL,
	"name" text NOT NULL,
	"legal_name" text,
	"registration_number" text,
	"tax_registration_number" text,
	"billing_address" text,
	"shipping_address" text,
	"contact_person" text,
	"email" text,
	"phone" text,
	"customer_reference" text,
	"payment_terms_days" integer,
	"default_currency" text,
	"tax_treatment" text,
	"tax_exempt" boolean,
	"tax_exemption_reason" text,
	"notes" text,
	"status" text DEFAULT 'active' NOT NULL,
	"archived_at" timestamp with time zone,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customers_status_ck" CHECK ("customers"."status" in ('active', 'archived')),
	CONSTRAINT "customers_type_ck" CHECK ("customers"."customer_type" in ('individual', 'company'))
);
--> statement-breakpoint
CREATE TABLE "product_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"parent_id" uuid,
	"description" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"kind" text DEFAULT 'product' NOT NULL,
	"sku" text,
	"name" text NOT NULL,
	"description" text,
	"category_id" uuid,
	"unit" text DEFAULT 'unit' NOT NULL,
	"unit_price" numeric(18, 4) DEFAULT '0' NOT NULL,
	"cost_price" numeric(18, 4),
	"discount_type" text DEFAULT 'none' NOT NULL,
	"discount_value" numeric(18, 4) DEFAULT '0' NOT NULL,
	"tax_rate_id" uuid,
	"image_file_id" uuid,
	"notes" text,
	"status" text DEFAULT 'active' NOT NULL,
	"archived_at" timestamp with time zone,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_price_ck" CHECK ("products"."unit_price" >= 0),
	CONSTRAINT "products_status_ck" CHECK ("products"."status" in ('active', 'archived')),
	CONSTRAINT "products_discount_ck" CHECK ("products"."discount_type" in ('none', 'percent', 'amount'))
);
--> statement-breakpoint
CREATE TABLE "tax_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"rate" numeric(9, 4) DEFAULT '0' NOT NULL,
	"is_inclusive" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tax_rates_rate_ck" CHECK ("tax_rates"."rate" >= 0)
);
--> statement-breakpoint
CREATE TABLE "credit_note_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"credit_note_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_note_allocations_amount_ck" CHECK ("credit_note_allocations"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "credit_note_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"credit_note_id" uuid NOT NULL,
	"line_no" integer NOT NULL,
	"product_id" uuid,
	"sku" text,
	"name" text NOT NULL,
	"description" text,
	"unit" text DEFAULT 'unit' NOT NULL,
	"quantity" numeric(14, 4) DEFAULT '1' NOT NULL,
	"unit_price" numeric(18, 4) DEFAULT '0' NOT NULL,
	"discount_type" text DEFAULT 'none' NOT NULL,
	"discount_value" numeric(18, 4) DEFAULT '0' NOT NULL,
	"tax_rate" numeric(9, 4) DEFAULT '0' NOT NULL,
	"tax_inclusive" boolean DEFAULT false NOT NULL,
	"tax_amount" numeric(18, 4) DEFAULT '0' NOT NULL,
	"line_subtotal" numeric(18, 4) DEFAULT '0' NOT NULL,
	"line_total" numeric(18, 4) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_note_items_qty_ck" CHECK ("credit_note_items"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "credit_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"credit_note_number" text NOT NULL,
	"invoice_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"issue_date" date NOT NULL,
	"currency" text DEFAULT 'MYR' NOT NULL,
	"reason" text NOT NULL,
	"notes" text,
	"subtotal" numeric(18, 2) DEFAULT '0' NOT NULL,
	"discount_total" numeric(18, 2) DEFAULT '0' NOT NULL,
	"tax_total" numeric(18, 2) DEFAULT '0' NOT NULL,
	"credit_total" numeric(18, 2) DEFAULT '0' NOT NULL,
	"issued_at" timestamp with time zone,
	"issued_by" text,
	"voided_at" timestamp with time zone,
	"void_reason" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_notes_reason_ck" CHECK (length("credit_notes"."reason") > 0)
);
--> statement-breakpoint
CREATE TABLE "document_charges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"document_type" text NOT NULL,
	"document_id" uuid NOT NULL,
	"label" text NOT NULL,
	"amount" numeric(18, 4) DEFAULT '0' NOT NULL,
	"taxable" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "document_charges_type_ck" CHECK ("document_charges"."document_type" in ('quotation', 'invoice'))
);
--> statement-breakpoint
CREATE TABLE "invoice_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"line_no" integer NOT NULL,
	"product_id" uuid,
	"sku" text,
	"name" text NOT NULL,
	"description" text,
	"unit" text DEFAULT 'unit' NOT NULL,
	"quantity" numeric(14, 4) DEFAULT '1' NOT NULL,
	"unit_price" numeric(18, 4) DEFAULT '0' NOT NULL,
	"discount_type" text DEFAULT 'none' NOT NULL,
	"discount_value" numeric(18, 4) DEFAULT '0' NOT NULL,
	"tax_rate_id" uuid,
	"tax_rate" numeric(9, 4) DEFAULT '0' NOT NULL,
	"tax_inclusive" boolean DEFAULT false NOT NULL,
	"tax_amount" numeric(18, 4) DEFAULT '0' NOT NULL,
	"line_subtotal" numeric(18, 4) DEFAULT '0' NOT NULL,
	"line_total" numeric(18, 4) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoice_items_qty_ck" CHECK ("invoice_items"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"invoice_number" text NOT NULL,
	"customer_id" uuid NOT NULL,
	"quotation_id" uuid,
	"status" text DEFAULT 'draft' NOT NULL,
	"issue_date" date NOT NULL,
	"due_date" date,
	"currency" text DEFAULT 'MYR' NOT NULL,
	"customer_po" text,
	"project_reference" text,
	"internal_notes" text,
	"notes" text,
	"terms" text,
	"payment_instructions" text,
	"subtotal" numeric(18, 2) DEFAULT '0' NOT NULL,
	"discount_total" numeric(18, 2) DEFAULT '0' NOT NULL,
	"shipping_total" numeric(18, 2) DEFAULT '0' NOT NULL,
	"tax_total" numeric(18, 2) DEFAULT '0' NOT NULL,
	"grand_total" numeric(18, 2) DEFAULT '0' NOT NULL,
	"document_discount_type" text DEFAULT 'none' NOT NULL,
	"document_discount_value" numeric(18, 4) DEFAULT '0' NOT NULL,
	"deposit_amount" numeric(18, 2) DEFAULT '0' NOT NULL,
	"issued_at" timestamp with time zone,
	"issued_by" text,
	"voided_at" timestamp with time zone,
	"voided_by" text,
	"void_reason" text,
	"archived_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_status_ck" CHECK (length("invoices"."invoice_number") > 0)
);
--> statement-breakpoint
CREATE TABLE "payment_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_allocations_amount_ck" CHECK ("payment_allocations"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "payment_milestones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"document_type" text NOT NULL,
	"document_id" uuid NOT NULL,
	"label" text NOT NULL,
	"percent" numeric(7, 4) DEFAULT '0' NOT NULL,
	"due_on" date,
	"notes" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "payment_milestones_percent_ck" CHECK ("payment_milestones"."percent" between 0 and 100)
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"payment_date" date NOT NULL,
	"method_code" text NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"currency" text DEFAULT 'MYR' NOT NULL,
	"external_reference" text,
	"notes" text,
	"status" text DEFAULT 'recorded' NOT NULL,
	"reversal_reason" text,
	"reversed_at" timestamp with time zone,
	"reversed_by" text,
	"recorded_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_amount_ck" CHECK ("payments"."amount" > 0),
	CONSTRAINT "payments_status_ck" CHECK ("payments"."status" in ('recorded', 'reversed'))
);
--> statement-breakpoint
CREATE TABLE "quotation_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"quotation_id" uuid NOT NULL,
	"line_no" integer NOT NULL,
	"product_id" uuid,
	"sku" text,
	"name" text NOT NULL,
	"description" text,
	"unit" text DEFAULT 'unit' NOT NULL,
	"quantity" numeric(14, 4) DEFAULT '1' NOT NULL,
	"unit_price" numeric(18, 4) DEFAULT '0' NOT NULL,
	"discount_type" text DEFAULT 'none' NOT NULL,
	"discount_value" numeric(18, 4) DEFAULT '0' NOT NULL,
	"tax_rate_id" uuid,
	"tax_rate" numeric(9, 4) DEFAULT '0' NOT NULL,
	"tax_inclusive" boolean DEFAULT false NOT NULL,
	"tax_amount" numeric(18, 4) DEFAULT '0' NOT NULL,
	"line_subtotal" numeric(18, 4) DEFAULT '0' NOT NULL,
	"line_total" numeric(18, 4) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quotation_items_qty_ck" CHECK ("quotation_items"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "quotations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"quotation_number" text NOT NULL,
	"customer_id" uuid NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"issue_date" date NOT NULL,
	"expiry_date" date,
	"currency" text DEFAULT 'MYR' NOT NULL,
	"customer_po" text,
	"internal_notes" text,
	"notes" text,
	"terms" text,
	"subtotal" numeric(18, 2) DEFAULT '0' NOT NULL,
	"discount_total" numeric(18, 2) DEFAULT '0' NOT NULL,
	"shipping_total" numeric(18, 2) DEFAULT '0' NOT NULL,
	"tax_total" numeric(18, 2) DEFAULT '0' NOT NULL,
	"grand_total" numeric(18, 2) DEFAULT '0' NOT NULL,
	"document_discount_type" text DEFAULT 'none' NOT NULL,
	"document_discount_value" numeric(18, 4) DEFAULT '0' NOT NULL,
	"issued_at" timestamp with time zone,
	"issued_by" text,
	"accepted_at" timestamp with time zone,
	"accepted_by" text,
	"acceptance_name" text,
	"acceptance_designation" text,
	"rejected_at" timestamp with time zone,
	"rejected_by" text,
	"rejection_reason" text,
	"expired_at" timestamp with time zone,
	"converted_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quotations_status_ck" CHECK (length("quotations"."quotation_number") > 0)
);
--> statement-breakpoint
CREATE TABLE "receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"receipt_number" text NOT NULL,
	"payment_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"issue_date" date NOT NULL,
	"currency" text DEFAULT 'MYR' NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"notes" text,
	"issued_at" timestamp with time zone,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"document_type" text NOT NULL,
	"document_id" uuid NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"template_id" uuid,
	"template_version_id" uuid,
	"snapshot" jsonb NOT NULL,
	"pdf_file_id" uuid,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_template_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"config" jsonb NOT NULL,
	"note" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"doc_type" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"current_version" integer DEFAULT 1 NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_code_permissions_code_fk" FOREIGN KEY ("permission_code") REFERENCES "public"."permissions"("code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "two_factor" ADD CONSTRAINT "two_factor_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_granted_by_user_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_settings" ADD CONSTRAINT "application_settings_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_settings" ADD CONSTRAINT "business_settings_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_settings" ADD CONSTRAINT "business_settings_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_logo_file_id_stored_files_id_fk" FOREIGN KEY ("logo_file_id") REFERENCES "public"."stored_files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_secondary_logo_file_id_stored_files_id_fk" FOREIGN KEY ("secondary_logo_file_id") REFERENCES "public"."stored_files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_signature_file_id_stored_files_id_fk" FOREIGN KEY ("signature_file_id") REFERENCES "public"."stored_files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_stamp_file_id_stored_files_id_fk" FOREIGN KEY ("stamp_file_id") REFERENCES "public"."stored_files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_attachments" ADD CONSTRAINT "document_attachments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_attachments" ADD CONSTRAINT "document_attachments_stored_file_id_stored_files_id_fk" FOREIGN KEY ("stored_file_id") REFERENCES "public"."stored_files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_events" ADD CONSTRAINT "document_events_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_events" ADD CONSTRAINT "document_events_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_sequences" ADD CONSTRAINT "document_sequences_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reporting_periods" ADD CONSTRAINT "reporting_periods_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stored_files" ADD CONSTRAINT "stored_files_uploaded_by_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_product_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."product_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_tax_rate_id_tax_rates_id_fk" FOREIGN KEY ("tax_rate_id") REFERENCES "public"."tax_rates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_rates" ADD CONSTRAINT "tax_rates_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_note_allocations" ADD CONSTRAINT "credit_note_allocations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_note_allocations" ADD CONSTRAINT "credit_note_allocations_credit_note_id_credit_notes_id_fk" FOREIGN KEY ("credit_note_id") REFERENCES "public"."credit_notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_note_allocations" ADD CONSTRAINT "credit_note_allocations_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_note_items" ADD CONSTRAINT "credit_note_items_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_note_items" ADD CONSTRAINT "credit_note_items_credit_note_id_credit_notes_id_fk" FOREIGN KEY ("credit_note_id") REFERENCES "public"."credit_notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_note_items" ADD CONSTRAINT "credit_note_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_charges" ADD CONSTRAINT "document_charges_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_tax_rate_id_tax_rates_id_fk" FOREIGN KEY ("tax_rate_id") REFERENCES "public"."tax_rates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_milestones" ADD CONSTRAINT "payment_milestones_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_quotation_id_quotations_id_fk" FOREIGN KEY ("quotation_id") REFERENCES "public"."quotations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_tax_rate_id_tax_rates_id_fk" FOREIGN KEY ("tax_rate_id") REFERENCES "public"."tax_rates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_snapshots" ADD CONSTRAINT "document_snapshots_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_snapshots" ADD CONSTRAINT "document_snapshots_pdf_file_id_stored_files_id_fk" FOREIGN KEY ("pdf_file_id") REFERENCES "public"."stored_files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_template_versions" ADD CONSTRAINT "document_template_versions_template_id_document_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."document_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_templates" ADD CONSTRAINT "document_templates_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "account_credential_uq" ON "account" USING btree ("user_id","provider_id") WHERE "account"."provider_id" = 'credential';--> statement-breakpoint
CREATE INDEX "rate_limits_blocked_until_idx" ON "rate_limits" USING btree ("blocked_until");--> statement-breakpoint
CREATE INDEX "role_permissions_permission_idx" ON "role_permissions" USING btree ("permission_code");--> statement-breakpoint
CREATE UNIQUE INDEX "roles_key_uq" ON "roles" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "session_token_uq" ON "session" USING btree ("token");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_expires_at_idx" ON "session" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "two_factor_user_uq" ON "two_factor" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_roles_role_idx" ON "user_roles" USING btree ("role_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_email_uq" ON "user" USING btree ("email");--> statement-breakpoint
CREATE INDEX "user_created_at_idx" ON "user" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_logs_actor_idx" ON "audit_logs" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "audit_logs_company_created_idx" ON "audit_logs" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_created_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "bank_accounts_company_idx" ON "bank_accounts" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "document_attachments_document_idx" ON "document_attachments" USING btree ("document_type","document_id");--> statement-breakpoint
CREATE INDEX "document_attachments_company_idx" ON "document_attachments" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "document_events_document_idx" ON "document_events" USING btree ("document_type","document_id","created_at");--> statement-breakpoint
CREATE INDEX "document_events_company_created_idx" ON "document_events" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE INDEX "email_logs_company_created_idx" ON "email_logs" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE INDEX "email_logs_status_idx" ON "email_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "email_logs_document_idx" ON "email_logs" USING btree ("document_type","document_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_methods_company_code_uq" ON "payment_methods" USING btree ("company_id","code");--> statement-breakpoint
CREATE INDEX "payment_methods_company_idx" ON "payment_methods" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "reporting_periods_company_idx" ON "reporting_periods" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stored_files_key_uq" ON "stored_files" USING btree ("storage_key");--> statement-breakpoint
CREATE INDEX "stored_files_company_purpose_idx" ON "stored_files" USING btree ("company_id","purpose");--> statement-breakpoint
CREATE INDEX "customer_addresses_customer_idx" ON "customer_addresses" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "customers_company_status_idx" ON "customers" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "customers_company_name_idx" ON "customers" USING btree ("company_id",lower("name"));--> statement-breakpoint
CREATE INDEX "customers_email_idx" ON "customers" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "customers_phone_idx" ON "customers" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "product_categories_company_idx" ON "product_categories" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_categories_name_uq" ON "product_categories" USING btree ("company_id",lower("name"));--> statement-breakpoint
CREATE INDEX "products_company_status_idx" ON "products" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "products_company_name_idx" ON "products" USING btree ("company_id",lower("name"));--> statement-breakpoint
CREATE INDEX "products_category_idx" ON "products" USING btree ("category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "products_sku_uq" ON "products" USING btree ("company_id",lower("sku")) WHERE "products"."sku" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "tax_rates_company_code_uq" ON "tax_rates" USING btree ("company_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_note_allocations_uq" ON "credit_note_allocations" USING btree ("credit_note_id","invoice_id");--> statement-breakpoint
CREATE INDEX "credit_note_allocations_invoice_idx" ON "credit_note_allocations" USING btree ("invoice_id");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_note_items_line_uq" ON "credit_note_items" USING btree ("credit_note_id","line_no");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_notes_number_uq" ON "credit_notes" USING btree ("company_id","credit_note_number");--> statement-breakpoint
CREATE INDEX "credit_notes_company_status_idx" ON "credit_notes" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "credit_notes_invoice_idx" ON "credit_notes" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "credit_notes_customer_idx" ON "credit_notes" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "document_charges_document_idx" ON "document_charges" USING btree ("document_type","document_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoice_items_line_uq" ON "invoice_items" USING btree ("invoice_id","line_no");--> statement-breakpoint
CREATE INDEX "invoice_items_product_idx" ON "invoice_items" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_number_uq" ON "invoices" USING btree ("company_id","invoice_number");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_quotation_uq" ON "invoices" USING btree ("quotation_id") WHERE "invoices"."quotation_id" is not null and "invoices"."status" <> 'void';--> statement-breakpoint
CREATE INDEX "invoices_company_status_idx" ON "invoices" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "invoices_company_issue_date_idx" ON "invoices" USING btree ("company_id","issue_date");--> statement-breakpoint
CREATE INDEX "invoices_company_due_date_idx" ON "invoices" USING btree ("company_id","due_date");--> statement-breakpoint
CREATE INDEX "invoices_customer_idx" ON "invoices" USING btree ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_allocations_uq" ON "payment_allocations" USING btree ("payment_id","invoice_id");--> statement-breakpoint
CREATE INDEX "payment_allocations_invoice_idx" ON "payment_allocations" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "payment_milestones_document_idx" ON "payment_milestones" USING btree ("document_type","document_id");--> statement-breakpoint
CREATE INDEX "payments_company_date_idx" ON "payments" USING btree ("company_id","payment_date");--> statement-breakpoint
CREATE INDEX "payments_customer_idx" ON "payments" USING btree ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "quotation_items_line_uq" ON "quotation_items" USING btree ("quotation_id","line_no");--> statement-breakpoint
CREATE INDEX "quotation_items_product_idx" ON "quotation_items" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "quotations_number_uq" ON "quotations" USING btree ("company_id","quotation_number");--> statement-breakpoint
CREATE INDEX "quotations_company_status_idx" ON "quotations" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "quotations_company_issue_date_idx" ON "quotations" USING btree ("company_id","issue_date");--> statement-breakpoint
CREATE INDEX "quotations_customer_idx" ON "quotations" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "quotations_company_expiry_idx" ON "quotations" USING btree ("company_id","expiry_date");--> statement-breakpoint
CREATE UNIQUE INDEX "receipts_number_uq" ON "receipts" USING btree ("company_id","receipt_number");--> statement-breakpoint
CREATE UNIQUE INDEX "receipts_payment_uq" ON "receipts" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "receipts_customer_idx" ON "receipts" USING btree ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "document_snapshots_revision_uq" ON "document_snapshots" USING btree ("document_type","document_id","revision");--> statement-breakpoint
CREATE INDEX "document_snapshots_document_idx" ON "document_snapshots" USING btree ("document_type","document_id");--> statement-breakpoint
CREATE INDEX "document_snapshots_company_idx" ON "document_snapshots" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "template_versions_uq" ON "document_template_versions" USING btree ("template_id","version");--> statement-breakpoint
CREATE INDEX "template_versions_template_idx" ON "document_template_versions" USING btree ("template_id");--> statement-breakpoint
CREATE UNIQUE INDEX "document_templates_name_uq" ON "document_templates" USING btree ("company_id","doc_type","name");--> statement-breakpoint
CREATE UNIQUE INDEX "document_templates_default_uq" ON "document_templates" USING btree ("company_id","doc_type") WHERE "document_templates"."is_default" = true;--> statement-breakpoint
CREATE INDEX "document_templates_company_type_idx" ON "document_templates" USING btree ("company_id","doc_type");