import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { users } from "./auth";

/* ------------------------------------------------------------------ */
/* Files                                                               */
/* ------------------------------------------------------------------ */

/**
 * Metadata for every object stored in Vercel Blob. The Blob URL is never the
 * only authorisation mechanism: `purpose` + `company_id` decide who may read
 * a file, and private files are streamed through an authenticated route.
 */
export const storedFiles = pgTable(
  "stored_files",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id").notNull(),
    purpose: text("purpose", {
      enum: [
        "logo",
        "secondary_logo",
        "signature",
        "stamp",
        "product_image",
        "document_pdf",
        "attachment",
      ],
    }).notNull(),
    /** Blob pathname (storage key). Content-versioned for generated PDFs. */
    storageKey: text("storage_key").notNull(),
    /** Blob URL. Public only when visibility = 'public'. */
    url: text("url").notNull(),
    visibility: text("visibility", { enum: ["public", "private"] })
      .notNull()
      .default("private"),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    checksumSha256: text("checksum_sha256"),
    originalName: text("original_name"),
    uploadedBy: text("uploaded_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("stored_files_key_uq").on(t.storageKey),
    index("stored_files_company_purpose_idx").on(t.companyId, t.purpose),
    check("stored_files_visibility_ck", sql`${t.visibility} in ('public', 'private')`),
  ]
);

/* ------------------------------------------------------------------ */
/* Company / business settings                                         */
/* ------------------------------------------------------------------ */

export const companies = pgTable("companies", {
  id: uuid("id").defaultRandom().primaryKey(),
  legalName: text("legal_name").notNull(),
  tradingName: text("trading_name"),
  registrationNumber: text("registration_number"),
  taxRegistrationNumber: text("tax_registration_number"),
  registeredAddress: text("registered_address"),
  businessAddress: text("business_address"),
  phone: text("phone"),
  email: text("email"),
  website: text("website"),
  logoFileId: uuid("logo_file_id").references(() => storedFiles.id, {
    onDelete: "set null",
  }),
  secondaryLogoFileId: uuid("secondary_logo_file_id").references(
    () => storedFiles.id,
    { onDelete: "set null" }
  ),
  signatureFileId: uuid("signature_file_id").references(() => storedFiles.id, {
    onDelete: "set null",
  }),
  stampFileId: uuid("stamp_file_id").references(() => storedFiles.id, {
    onDelete: "set null",
  }),
  signatoryName: text("signatory_name"),
  signatoryDesignation: text("signatory_designation"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Per-company defaults: currency, locale, timezone, payment terms, tax
 * treatment, document formatting, numbering display preferences and email
 * sender identity. Everything the spec's settings page can configure.
 */
export const businessSettings = pgTable(
  "business_settings",
  {
    companyId: uuid("company_id")
      .primaryKey()
      .references(() => companies.id, { onDelete: "cascade" }),
    defaultCurrency: text("default_currency").notNull().default("MYR"),
    defaultLocale: text("default_locale").notNull().default("en-MY"),
    defaultTimezone: text("default_timezone").notNull().default("Asia/Kuala_Lumpur"),
    defaultDocumentLanguage: text("default_document_language", {
      enum: ["en", "ms"],
    })
      .notNull()
      .default("en"),
    /** Enable bilingual English/Malay labels on documents. */
    bilingualDocuments: boolean("bilingual_documents").notNull().default(false),
    dateFormat: text("date_format").notNull().default("dd/MM/yyyy"),
    numberFormat: text("number_format").notNull().default("en-MY"),
    paymentTermsDays: integer("payment_terms_days").notNull().default(30),
    quotationValidityDays: integer("quotation_validity_days").notNull().default(14),
    invoiceDueDays: integer("invoice_due_days").notNull().default(30),
    defaultFooter: text("default_footer"),
    defaultTerms: text("default_terms"),
    defaultNotes: text("default_notes"),
    /** 'exclusive' = tax added on top; 'inclusive' = tax inside the price. */
    taxTreatment: text("tax_treatment", { enum: ["exclusive", "inclusive"] })
      .notNull()
      .default("exclusive"),
    taxLabel: text("tax_label").notNull().default("SST"),
    /** Optional SST registration details; never assumed to be registered. */
    sstRegistered: boolean("sst_registered").notNull().default(false),
    sstRegistrationNumber: text("sst_registration_number"),
    paperSize: text("paper_size", { enum: ["A4", "Letter", "A5"] })
      .notNull()
      .default("A4"),
    pageOrientation: text("page_orientation", { enum: ["portrait", "landscape"] })
      .notNull()
      .default("portrait"),
    pageMargins: jsonb("page_margins").$type<{
      top: number;
      right: number;
      bottom: number;
      left: number;
    }>(),
    emailSenderName: text("email_sender_name"),
    emailSenderAddress: text("email_sender_address"),
    emailReplyTo: text("email_reply_to"),
    /** Arbitrary label overrides merged over the default label set. */
    labelOverrides: jsonb("label_overrides").$type<Record<string, string>>(),
    updatedBy: text("updated_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check("business_settings_currency_ck", sql`length(${t.defaultCurrency}) = 3`),
    check("business_settings_terms_ck", sql`${t.paymentTermsDays} >= 0`),
  ]
);

/** Free-form key/value application settings scoped to a company. */
export const applicationSettings = pgTable(
  "application_settings",
  {
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    value: jsonb("value").notNull(),
    updatedBy: text("updated_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.companyId, t.key] })]
);

/**
 * Document numbering counters. Allocation happens inside the document
 * creation transaction with `SELECT ... FOR UPDATE`, so two concurrent
 * requests can never receive the same number. Never derived from COUNT(*).
 */
export const documentSequences = pgTable(
  "document_sequences",
  {
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    docType: text("doc_type", {
      enum: ["quotation", "invoice", "receipt", "credit_note"],
    }).notNull(),
    /** Sequence period, e.g. "2026" for yearly numbering. */
    period: text("period").notNull().default("year"),
    prefix: text("prefix").notNull(),
    separator: text("separator").notNull().default("-"),
    padding: integer("padding").notNull().default(5),
    nextValue: integer("next_value").notNull().default(1),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.companyId, t.docType, t.period] }),
    check("document_sequences_padding_ck", sql`${t.padding} between 1 and 12`),
    check("document_sequences_next_ck", sql`${t.nextValue} >= 1`),
  ]
);

/** Status transitions and notable actions on any document. */
export const documentEvents = pgTable(
  "document_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    documentType: text("document_type", {
      enum: ["quotation", "invoice", "payment", "credit_note"],
    }).notNull(),
    documentId: uuid("document_id").notNull(),
    event: text("event").notNull(),
    fromStatus: text("from_status"),
    toStatus: text("to_status"),
    actorUserId: text("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    note: text("note"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("document_events_document_idx").on(
      t.documentType,
      t.documentId,
      t.createdAt
    ),
    index("document_events_company_created_idx").on(t.companyId, t.createdAt),
  ]
);

export const emailLogs = pgTable(
  "email_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    documentType: text("document_type", {
      enum: ["quotation", "invoice", "receipt", "credit_note"],
    }),
    documentId: uuid("document_id"),
    recipient: text("recipient").notNull(),
    cc: jsonb("cc").$type<string[]>(),
    subject: text("subject").notNull(),
    status: text("status", { enum: ["pending", "sent", "failed"] })
      .notNull()
      .default("pending"),
    provider: text("provider"),
    providerMessageId: text("provider_message_id"),
    error: text("error"),
    attemptCount: integer("attempt_count").notNull().default(0),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("email_logs_company_created_idx").on(t.companyId, t.createdAt),
    index("email_logs_status_idx").on(t.status),
    index("email_logs_document_idx").on(t.documentType, t.documentId),
  ]
);

/**
 * Append-only audit trail. Rows are written by the audit helper only; there
 * is no update or delete path anywhere in the application.
 */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id"),
    actorUserId: text("actor_user_id"),
    actorLabel: text("actor_label"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    before: jsonb("before"),
    after: jsonb("after"),
    ip: text("ip"),
    userAgent: text("user_agent"),
    requestId: text("request_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("audit_logs_entity_idx").on(t.entityType, t.entityId),
    index("audit_logs_actor_idx").on(t.actorUserId),
    index("audit_logs_company_created_idx").on(t.companyId, t.createdAt),
    index("audit_logs_created_idx").on(t.createdAt),
  ]
);

/**
 * Optional per-document supporting files (quotes, PO scans, delivery notes).
 * Kept separate from company assets so authorisation can differ.
 */
export const documentAttachments = pgTable(
  "document_attachments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    documentType: text("document_type", {
      enum: ["quotation", "invoice", "credit_note", "payment"],
    }).notNull(),
    documentId: uuid("document_id").notNull(),
    storedFileId: uuid("stored_file_id")
      .notNull()
      .references(() => storedFiles.id, { onDelete: "cascade" }),
    label: text("label"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("document_attachments_document_idx").on(t.documentType, t.documentId),
    index("document_attachments_company_idx").on(t.companyId),
  ]
);

/** Bank accounts and payment instructions shown on documents. */
export const bankAccounts = pgTable(
  "bank_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    bankName: text("bank_name").notNull(),
    accountName: text("account_name").notNull(),
    accountNumber: text("account_number").notNull(),
    swift: text("swift"),
    instructions: text("instructions"),
    sortOrder: integer("sort_order").notNull().default(0),
    isDefault: boolean("is_default").notNull().default(false),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("bank_accounts_company_idx").on(t.companyId)]
);

/** Configurable payment methods (cash, transfer, DuitNow QR, FPX, ...). */
export const paymentMethods = pgTable(
  "payment_methods",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    label: text("label").notNull(),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [
    uniqueIndex("payment_methods_company_code_uq").on(t.companyId, t.code),
    index("payment_methods_company_idx").on(t.companyId),
  ]
);

/** Financial year / reporting periods used by reports and exports. */
export const reportingPeriods = pgTable(
  "reporting_periods",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    startsOn: date("starts_on").notNull(),
    endsOn: date("ends_on").notNull(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
  },
  (t) => [index("reporting_periods_company_idx").on(t.companyId)]
);
