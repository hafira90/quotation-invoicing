import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { companies } from "./core";
import { customers, products, taxRates } from "./crm";

/* ------------------------------------------------------------------ */
/* Quotations                                                          */
/* ------------------------------------------------------------------ */

export const quotations = pgTable(
  "quotations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    quotationNumber: text("quotation_number").notNull(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    status: text("status", {
      enum: [
        "draft",
        "issued",
        "sent",
        "accepted",
        "rejected",
        "expired",
        "converted",
        "cancelled",
      ],
    })
      .notNull()
      .default("draft"),
    issueDate: date("issue_date").notNull(),
    expiryDate: date("expiry_date"),
    currency: text("currency").notNull().default("MYR"),
    customerPo: text("customer_po"),
    /** Internal only — never printed. */
    internalNotes: text("internal_notes"),
    notes: text("notes"),
    terms: text("terms"),
    subtotal: numeric("subtotal", { precision: 18, scale: 2 }).notNull().default("0"),
    discountTotal: numeric("discount_total", { precision: 18, scale: 2 })
      .notNull()
      .default("0"),
    shippingTotal: numeric("shipping_total", { precision: 18, scale: 2 })
      .notNull()
      .default("0"),
    taxTotal: numeric("tax_total", { precision: 18, scale: 2 })
      .notNull()
      .default("0"),
    grandTotal: numeric("grand_total", { precision: 18, scale: 2 })
      .notNull()
      .default("0"),
    /** Document-level discount applied before tax. */
    documentDiscountType: text("document_discount_type", {
      enum: ["none", "percent", "amount"],
    })
      .notNull()
      .default("none"),
    documentDiscountValue: numeric("document_discount_value", {
      precision: 18,
      scale: 4,
    })
      .notNull()
      .default("0"),
    issuedAt: timestamp("issued_at", { withTimezone: true }),
    issuedBy: text("issued_by"),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    acceptedBy: text("accepted_by"),
    acceptanceName: text("acceptance_name"),
    acceptanceDesignation: text("acceptance_designation"),
    rejectedAt: timestamp("rejected_at", { withTimezone: true }),
    rejectedBy: text("rejected_by"),
    rejectionReason: text("rejection_reason"),
    expiredAt: timestamp("expired_at", { withTimezone: true }),
    convertedAt: timestamp("converted_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdBy: text("created_by"),
    updatedBy: text("updated_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Concurrency-safe numbering: the unique index is the final backstop on
    // top of the row lock taken when allocating from document_sequences.
    uniqueIndex("quotations_number_uq").on(t.companyId, t.quotationNumber),
    index("quotations_company_status_idx").on(t.companyId, t.status),
    index("quotations_company_issue_date_idx").on(t.companyId, t.issueDate),
    index("quotations_customer_idx").on(t.customerId),
    index("quotations_company_expiry_idx").on(t.companyId, t.expiryDate),
    check("quotations_status_ck", sql`length(${t.quotationNumber}) > 0`),
  ]
);

export const quotationItems = pgTable(
  "quotation_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    quotationId: uuid("quotation_id")
      .notNull()
      .references(() => quotations.id, { onDelete: "cascade" }),
    lineNo: integer("line_no").notNull(),
    /** Null for custom lines that are not in the catalogue. */
    productId: uuid("product_id").references(() => products.id, {
      onDelete: "set null",
    }),
    sku: text("sku"),
    name: text("name").notNull(),
    description: text("description"),
    unit: text("unit").notNull().default("unit"),
    quantity: numeric("quantity", { precision: 14, scale: 4 }).notNull().default("1"),
    unitPrice: numeric("unit_price", { precision: 18, scale: 4 })
      .notNull()
      .default("0"),
    discountType: text("discount_type", { enum: ["none", "percent", "amount"] })
      .notNull()
      .default("none"),
    discountValue: numeric("discount_value", { precision: 18, scale: 4 })
      .notNull()
      .default("0"),
    taxRateId: uuid("tax_rate_id").references(() => taxRates.id, {
      onDelete: "set null",
    }),
    /** Rate snapshot taken when the line was saved, e.g. "6.0000". */
    taxRate: numeric("tax_rate", { precision: 9, scale: 4 }).notNull().default("0"),
    taxInclusive: boolean("tax_inclusive").notNull().default(false),
    taxAmount: numeric("tax_amount", { precision: 18, scale: 4 })
      .notNull()
      .default("0"),
    /** Net of line discount, before tax. */
    lineSubtotal: numeric("line_subtotal", { precision: 18, scale: 4 })
      .notNull()
      .default("0"),
    /** Including tax when the treatment is inclusive. */
    lineTotal: numeric("line_total", { precision: 18, scale: 4 })
      .notNull()
      .default("0"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("quotation_items_line_uq").on(t.quotationId, t.lineNo),
    index("quotation_items_product_idx").on(t.productId),
    check("quotation_items_qty_ck", sql`${t.quantity} > 0`),
  ]
);

/** Delivery / shipping / handling charges and other document-level charges. */
export const documentCharges = pgTable(
  "document_charges",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    documentType: text("document_type", { enum: ["quotation", "invoice"] }).notNull(),
    documentId: uuid("document_id").notNull(),
    label: text("label").notNull(),
    amount: numeric("amount", { precision: 18, scale: 4 }).notNull().default("0"),
    taxable: boolean("taxable").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [
    index("document_charges_document_idx").on(t.documentType, t.documentId),
    check("document_charges_type_ck", sql`${t.documentType} in ('quotation', 'invoice')`),
  ]
);

/** Payment milestones / deposit schedule on a quotation. */
export const paymentMilestones = pgTable(
  "payment_milestones",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    documentType: text("document_type", { enum: ["quotation", "invoice"] }).notNull(),
    documentId: uuid("document_id").notNull(),
    label: text("label").notNull(),
    /** Percentage of the grand total, 0-100. */
    percent: numeric("percent", { precision: 7, scale: 4 }).notNull().default("0"),
    dueOn: date("due_on"),
    notes: text("notes"),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [
    index("payment_milestones_document_idx").on(t.documentType, t.documentId),
    check("payment_milestones_percent_ck", sql`${t.percent} between 0 and 100`),
  ]
);

/* ------------------------------------------------------------------ */
/* Invoices                                                            */
/* ------------------------------------------------------------------ */

export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    invoiceNumber: text("invoice_number").notNull(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    /** Set when the invoice was produced by Convert to Invoice. */
    quotationId: uuid("quotation_id"),
    status: text("status", {
      enum: [
        "draft",
        "issued",
        "sent",
        "partially_paid",
        "paid",
        "overdue",
        "void",
      ],
    })
      .notNull()
      .default("draft"),
    issueDate: date("issue_date").notNull(),
    dueDate: date("due_date"),
    currency: text("currency").notNull().default("MYR"),
    customerPo: text("customer_po"),
    projectReference: text("project_reference"),
    internalNotes: text("internal_notes"),
    notes: text("notes"),
    terms: text("terms"),
    paymentInstructions: text("payment_instructions"),
    subtotal: numeric("subtotal", { precision: 18, scale: 2 }).notNull().default("0"),
    discountTotal: numeric("discount_total", { precision: 18, scale: 2 })
      .notNull()
      .default("0"),
    shippingTotal: numeric("shipping_total", { precision: 18, scale: 2 })
      .notNull()
      .default("0"),
    taxTotal: numeric("tax_total", { precision: 18, scale: 2 })
      .notNull()
      .default("0"),
    grandTotal: numeric("grand_total", { precision: 18, scale: 2 })
      .notNull()
      .default("0"),
    documentDiscountType: text("document_discount_type", {
      enum: ["none", "percent", "amount"],
    })
      .notNull()
      .default("none"),
    documentDiscountValue: numeric("document_discount_value", {
      precision: 18,
      scale: 4,
    })
      .notNull()
      .default("0"),
    /** Deposit / advance payment recorded at issue time. */
    depositAmount: numeric("deposit_amount", { precision: 18, scale: 2 })
      .notNull()
      .default("0"),
    issuedAt: timestamp("issued_at", { withTimezone: true }),
    issuedBy: text("issued_by"),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    voidedBy: text("voided_by"),
    voidReason: text("void_reason"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdBy: text("created_by"),
    updatedBy: text("updated_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("invoices_number_uq").on(t.companyId, t.invoiceNumber),
    /**
     * Allows at most one live invoice per quotation: re-clicking Convert or
     * two concurrent requests cannot create a second one. A voided invoice
     * releases the slot so a corrected invoice can be created.
     */
    uniqueIndex("invoices_quotation_uq")
      .on(t.quotationId)
      .where(sql`${t.quotationId} is not null and ${t.status} <> 'void'`),
    index("invoices_company_status_idx").on(t.companyId, t.status),
    index("invoices_company_issue_date_idx").on(t.companyId, t.issueDate),
    index("invoices_company_due_date_idx").on(t.companyId, t.dueDate),
    index("invoices_customer_idx").on(t.customerId),
    check("invoices_status_ck", sql`length(${t.invoiceNumber}) > 0`),
  ]
);

export const invoiceItems = pgTable(
  "invoice_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    lineNo: integer("line_no").notNull(),
    productId: uuid("product_id").references(() => products.id, {
      onDelete: "set null",
    }),
    sku: text("sku"),
    name: text("name").notNull(),
    description: text("description"),
    unit: text("unit").notNull().default("unit"),
    quantity: numeric("quantity", { precision: 14, scale: 4 }).notNull().default("1"),
    unitPrice: numeric("unit_price", { precision: 18, scale: 4 })
      .notNull()
      .default("0"),
    discountType: text("discount_type", { enum: ["none", "percent", "amount"] })
      .notNull()
      .default("none"),
    discountValue: numeric("discount_value", { precision: 18, scale: 4 })
      .notNull()
      .default("0"),
    taxRateId: uuid("tax_rate_id").references(() => taxRates.id, {
      onDelete: "set null",
    }),
    taxRate: numeric("tax_rate", { precision: 9, scale: 4 }).notNull().default("0"),
    taxInclusive: boolean("tax_inclusive").notNull().default(false),
    taxAmount: numeric("tax_amount", { precision: 18, scale: 4 })
      .notNull()
      .default("0"),
    lineSubtotal: numeric("line_subtotal", { precision: 18, scale: 4 })
      .notNull()
      .default("0"),
    lineTotal: numeric("line_total", { precision: 18, scale: 4 })
      .notNull()
      .default("0"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("invoice_items_line_uq").on(t.invoiceId, t.lineNo),
    index("invoice_items_product_idx").on(t.productId),
    check("invoice_items_qty_ck", sql`${t.quantity} > 0`),
  ]
);

/* ------------------------------------------------------------------ */
/* Payments & receipts                                                 */
/* ------------------------------------------------------------------ */

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    paymentDate: date("payment_date").notNull(),
    methodCode: text("method_code").notNull(),
    amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
    currency: text("currency").notNull().default("MYR"),
    externalReference: text("external_reference"),
    notes: text("notes"),
    /**
     * 'reversed' payments keep their allocations for audit; balance queries
     * only count allocations whose payment is 'recorded'.
     */
    status: text("status", { enum: ["recorded", "reversed"] })
      .notNull()
      .default("recorded"),
    reversalReason: text("reversal_reason"),
    reversedAt: timestamp("reversed_at", { withTimezone: true }),
    reversedBy: text("reversed_by"),
    recordedBy: text("recorded_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("payments_company_date_idx").on(t.companyId, t.paymentDate),
    index("payments_customer_idx").on(t.customerId),
    check("payments_amount_ck", sql`${t.amount} > 0`),
    check("payments_status_ck", sql`${t.status} in ('recorded', 'reversed')`),
  ]
);

export const paymentAllocations = pgTable(
  "payment_allocations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    paymentId: uuid("payment_id")
      .notNull()
      .references(() => payments.id, { onDelete: "cascade" }),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "restrict" }),
    amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("payment_allocations_uq").on(t.paymentId, t.invoiceId),
    index("payment_allocations_invoice_idx").on(t.invoiceId),
    check("payment_allocations_amount_ck", sql`${t.amount} > 0`),
  ]
);

export const receipts = pgTable(
  "receipts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    receiptNumber: text("receipt_number").notNull(),
    paymentId: uuid("payment_id").notNull(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    issueDate: date("issue_date").notNull(),
    currency: text("currency").notNull().default("MYR"),
    amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
    notes: text("notes"),
    issuedAt: timestamp("issued_at", { withTimezone: true }),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("receipts_number_uq").on(t.companyId, t.receiptNumber),
    uniqueIndex("receipts_payment_uq").on(t.paymentId),
    index("receipts_customer_idx").on(t.customerId),
  ]
);

/* ------------------------------------------------------------------ */
/* Credit notes                                                        */
/* ------------------------------------------------------------------ */

export const creditNotes = pgTable(
  "credit_notes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    creditNoteNumber: text("credit_note_number").notNull(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "restrict" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    status: text("status", { enum: ["draft", "issued", "applied", "void"] })
      .notNull()
      .default("draft"),
    issueDate: date("issue_date").notNull(),
    currency: text("currency").notNull().default("MYR"),
    reason: text("reason").notNull(),
    notes: text("notes"),
    subtotal: numeric("subtotal", { precision: 18, scale: 2 }).notNull().default("0"),
    discountTotal: numeric("discount_total", { precision: 18, scale: 2 })
      .notNull()
      .default("0"),
    taxTotal: numeric("tax_total", { precision: 18, scale: 2 })
      .notNull()
      .default("0"),
    creditTotal: numeric("credit_total", { precision: 18, scale: 2 })
      .notNull()
      .default("0"),
    issuedAt: timestamp("issued_at", { withTimezone: true }),
    issuedBy: text("issued_by"),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    voidReason: text("void_reason"),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("credit_notes_number_uq").on(t.companyId, t.creditNoteNumber),
    index("credit_notes_company_status_idx").on(t.companyId, t.status),
    index("credit_notes_invoice_idx").on(t.invoiceId),
    index("credit_notes_customer_idx").on(t.customerId),
    check("credit_notes_reason_ck", sql`length(${t.reason}) > 0`),
  ]
);

export const creditNoteItems = pgTable(
  "credit_note_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    creditNoteId: uuid("credit_note_id")
      .notNull()
      .references(() => creditNotes.id, { onDelete: "cascade" }),
    lineNo: integer("line_no").notNull(),
    productId: uuid("product_id").references(() => products.id, {
      onDelete: "set null",
    }),
    sku: text("sku"),
    name: text("name").notNull(),
    description: text("description"),
    unit: text("unit").notNull().default("unit"),
    quantity: numeric("quantity", { precision: 14, scale: 4 }).notNull().default("1"),
    unitPrice: numeric("unit_price", { precision: 18, scale: 4 })
      .notNull()
      .default("0"),
    discountType: text("discount_type", { enum: ["none", "percent", "amount"] })
      .notNull()
      .default("none"),
    discountValue: numeric("discount_value", { precision: 18, scale: 4 })
      .notNull()
      .default("0"),
    taxRate: numeric("tax_rate", { precision: 9, scale: 4 }).notNull().default("0"),
    taxInclusive: boolean("tax_inclusive").notNull().default(false),
    taxAmount: numeric("tax_amount", { precision: 18, scale: 4 })
      .notNull()
      .default("0"),
    lineSubtotal: numeric("line_subtotal", { precision: 18, scale: 4 })
      .notNull()
      .default("0"),
    lineTotal: numeric("line_total", { precision: 18, scale: 4 })
      .notNull()
      .default("0"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("credit_note_items_line_uq").on(t.creditNoteId, t.lineNo),
    check("credit_note_items_qty_ck", sql`${t.quantity} > 0`),
  ]
);

/**
 * Applying a credit note against a specific invoice's receivable.
 * Credits applied to invoices are distinct from cash refunds.
 */
export const creditNoteAllocations = pgTable(
  "credit_note_allocations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    creditNoteId: uuid("credit_note_id")
      .notNull()
      .references(() => creditNotes.id, { onDelete: "cascade" }),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "restrict" }),
    amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("credit_note_allocations_uq").on(t.creditNoteId, t.invoiceId),
    index("credit_note_allocations_invoice_idx").on(t.invoiceId),
    check("credit_note_allocations_amount_ck", sql`${t.amount} > 0`),
  ]
);
