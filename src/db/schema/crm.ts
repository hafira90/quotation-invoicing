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

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    customerType: text("customer_type", { enum: ["individual", "company"] })
      .notNull()
      .default("company"),
    name: text("name").notNull(),
    /** Legal entity name for companies / registered name. */
    legalName: text("legal_name"),
    registrationNumber: text("registration_number"),
    taxRegistrationNumber: text("tax_registration_number"),
    billingAddress: text("billing_address"),
    shippingAddress: text("shipping_address"),
    contactPerson: text("contact_person"),
    email: text("email"),
    phone: text("phone"),
    /** Customer's own PO reference shown on documents. */
    customerReference: text("customer_reference"),
    paymentTermsDays: integer("payment_terms_days"),
    defaultCurrency: text("default_currency"),
    /** Overrides the company default tax treatment for this customer. */
    taxTreatment: text("tax_treatment", { enum: ["exclusive", "inclusive"] }),
    taxExempt: boolean("tax_exempt"),
    taxExemptionReason: text("tax_exemption_reason"),
    notes: text("notes"),
    status: text("status", { enum: ["active", "archived"] })
      .notNull()
      .default("active"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("customers_company_status_idx").on(t.companyId, t.status),
    // Case-insensitive search support for the customer list page.
    index("customers_company_name_idx").on(
      t.companyId,
      sql`lower(${t.name})`
    ),
    index("customers_email_idx").on(sql`lower(${t.email})`),
    index("customers_phone_idx").on(t.phone),
    check("customers_status_ck", sql`${t.status} in ('active', 'archived')`),
    check(
      "customers_type_ck",
      sql`${t.customerType} in ('individual', 'company')`
    ),
  ]
);

export const customerAddresses = pgTable(
  "customer_addresses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["billing", "shipping"] }).notNull(),
    label: text("label"),
    line1: text("line1"),
    line2: text("line2"),
    city: text("city"),
    state: text("state"),
    postcode: text("postcode"),
    country: text("country").notNull().default("MY"),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("customer_addresses_customer_idx").on(t.customerId),
    check(
      "customer_addresses_kind_ck",
      sql`${t.kind} in ('billing', 'shipping')`
    ),
  ]
);

/* ------------------------------------------------------------------ */
/* Catalogue                                                           */
/* ------------------------------------------------------------------ */

export const productCategories = pgTable(
  "product_categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    parentId: uuid("parent_id"),
    description: text("description"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("product_categories_company_idx").on(t.companyId),
    uniqueIndex("product_categories_name_uq").on(
      t.companyId,
      sql`lower(${t.name})`
    ),
  ]
);

/**
 * Configurable tax rates. SST is never assumed: the administrator creates
 * rates (e.g. "SST 6%", "SST 10%", "Exempt") and assigns them per product or
 * per document line.
 */
export const taxRates = pgTable(
  "tax_rates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    name: text("name").notNull(),
    /** Percentage value, e.g. 6.00 for 6%. */
    rate: numeric("rate", { precision: 9, scale: 4 }).notNull().default("0"),
    isInclusive: boolean("is_inclusive").notNull().default(false),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("tax_rates_company_code_uq").on(t.companyId, t.code),
    check("tax_rates_rate_ck", sql`${t.rate} >= 0`),
  ]
);

export const products = pgTable(
  "products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    kind: text("kind", {
      enum: [
        "product",
        "service",
        "labour",
        "consultancy",
        "subscription",
        "delivery",
        "misc",
      ],
    })
      .notNull()
      .default("product"),
    sku: text("sku"),
    name: text("name").notNull(),
    description: text("description"),
    categoryId: uuid("category_id").references(() => productCategories.id, {
      onDelete: "set null",
    }),
    unit: text("unit").notNull().default("unit"),
    unitPrice: numeric("unit_price", { precision: 18, scale: 4 })
      .notNull()
      .default("0"),
    costPrice: numeric("cost_price", { precision: 18, scale: 4 }),
    discountType: text("discount_type", { enum: ["none", "percent", "amount"] })
      .notNull()
      .default("none"),
    discountValue: numeric("discount_value", { precision: 18, scale: 4 })
      .notNull()
      .default("0"),
    taxRateId: uuid("tax_rate_id").references(() => taxRates.id, {
      onDelete: "set null",
    }),
    imageFileId: uuid("image_file_id"),
    notes: text("notes"),
    status: text("status", { enum: ["active", "archived"] })
      .notNull()
      .default("active"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("products_company_status_idx").on(t.companyId, t.status),
    index("products_company_name_idx").on(t.companyId, sql`lower(${t.name})`),
    index("products_category_idx").on(t.categoryId),
    // SKU uniqueness is enforced case-insensitively per company when present.
    uniqueIndex("products_sku_uq")
      .on(t.companyId, sql`lower(${t.sku})`)
      .where(sql`${t.sku} is not null`),
    check("products_price_ck", sql`${t.unitPrice} >= 0`),
    check("products_status_ck", sql`${t.status} in ('active', 'archived')`),
    check(
      "products_discount_ck",
      sql`${t.discountType} in ('none', 'percent', 'amount')`
    ),
  ]
);
