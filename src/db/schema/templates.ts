import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { companies, storedFiles } from "./core";

export const documentTemplateDocTypes = [
  "quotation",
  "invoice",
  "receipt",
  "credit_note",
] as const;

/**
 * A template is a named design for one document type. Its visual
 * configuration (page, theme, section order, labels) is stored as JSON on
 * each immutable version, so a document issued last month still renders with
 * the design that existed then.
 */
export const documentTemplates = pgTable(
  "document_templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    docType: text("doc_type", { enum: documentTemplateDocTypes }).notNull(),
    name: text("name").notNull(),
    description: text("description"),
    isDefault: boolean("is_default").notNull().default(false),
    active: boolean("active").notNull().default(true),
    currentVersion: integer("current_version").notNull().default(1),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("document_templates_name_uq").on(t.companyId, t.docType, t.name),
    // Exactly one default template per document type.
    uniqueIndex("document_templates_default_uq")
      .on(t.companyId, t.docType)
      .where(sql`${t.isDefault} = true`),
    index("document_templates_company_type_idx").on(t.companyId, t.docType),
  ]
);

export const documentTemplateVersions = pgTable(
  "document_template_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    templateId: uuid("template_id")
      .notNull()
      .references(() => documentTemplates.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    /** Full design configuration (page, theme, sections, labels, i18n). */
    config: jsonb("config").notNull(),
    note: text("note"),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("template_versions_uq").on(t.templateId, t.version),
    index("template_versions_template_idx").on(t.templateId),
  ]
);

/**
 * Immutable record of an issued document: business fields, line items,
 * totals, tax figures, label overrides and the template version used.
 * Historical documents are re-rendered from this row, never from current
 * settings.
 */
export const documentSnapshots = pgTable(
  "document_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    documentType: text("document_type", {
      enum: documentTemplateDocTypes,
    }).notNull(),
    documentId: uuid("document_id").notNull(),
    /** Increments when a document is reissued under a controlled process. */
    revision: integer("revision").notNull().default(1),
    templateId: uuid("template_id"),
    templateVersionId: uuid("template_version_id"),
    /** Frozen business + design data used to rebuild the document. */
    snapshot: jsonb("snapshot").notNull(),
    /** Generated PDF kept for this exact revision (content-versioned key). */
    pdfFileId: uuid("pdf_file_id").references(() => storedFiles.id, {
      onDelete: "set null",
    }),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("document_snapshots_revision_uq").on(
      t.documentType,
      t.documentId,
      t.revision
    ),
    index("document_snapshots_document_idx").on(t.documentType, t.documentId),
    index("document_snapshots_company_idx").on(t.companyId),
  ]
);
