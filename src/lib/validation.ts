import { z } from "zod";

/**
 * Shared validation schemas.
 *
 * The same schema runs in the browser (instant feedback) and again in the
 * Server Action — the server copy is authoritative, the client copy is a
 * convenience. Money and quantities arrive as strings and are validated as
 * decimal text so nothing passes through float parsing.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DECIMAL_RE = /^\d+(\.\d{1,4})?$/;

/** Accepts "", "0", "1234.5678" — rejects negatives, NaN and exponent form. */
const decimalField = (max = "99999999999999.9999") =>
  z
    .string()
    .trim()
    .regex(DECIMAL_RE, "Must be a positive number")
    .refine((v) => v === "" || Number(v) <= Number(max), "Value is too large")
    .optional()
    .or(z.literal(""));

export const customerSchema = z.object({
  id: z.string().uuid().optional(),
  customerType: z.enum(["individual", "company"]),
  name: z.string().trim().min(1, "Name is required").max(200),
  legalName: z.string().trim().max(200).optional().or(z.literal("")),
  registrationNumber: z.string().trim().max(60).optional().or(z.literal("")),
  taxRegistrationNumber: z.string().trim().max(60).optional().or(z.literal("")),
  billingAddress: z.string().trim().max(2000).optional().or(z.literal("")),
  shippingAddress: z.string().trim().max(2000).optional().or(z.literal("")),
  contactPerson: z.string().trim().max(120).optional().or(z.literal("")),
  email: z
    .string()
    .trim()
    .max(200)
    .refine((v) => v === "" || EMAIL_RE.test(v), "Enter a valid email address")
    .optional()
    .or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  customerReference: z.string().trim().max(60).optional().or(z.literal("")),
  paymentTermsDays: z
    .string()
    .trim()
    .regex(/^\d{0,3}$/, "Days must be a number")
    .optional()
    .or(z.literal("")),
  defaultCurrency: z.string().trim().length(3).optional().or(z.literal("")),
  taxTreatment: z.enum(["exclusive", "inclusive"]).optional(),
  taxExempt: z.boolean(),
  taxExemptionReason: z.string().trim().max(300).optional().or(z.literal("")),
  notes: z.string().trim().max(5000).optional().or(z.literal("")),
});

export type CustomerInput = z.infer<typeof customerSchema>;

export const productSchema = z.object({
  id: z.string().uuid().optional(),
  kind: z.enum([
    "product",
    "service",
    "labour",
    "consultancy",
    "subscription",
    "delivery",
    "misc",
  ]),
  sku: z.string().trim().max(60).optional().or(z.literal("")),
  name: z.string().trim().min(1, "Name is required").max(200),
  description: z.string().trim().max(5000).optional().or(z.literal("")),
  categoryId: z.string().uuid().optional().or(z.literal("")),
  unit: z.string().trim().min(1).max(30),
  unitPrice: decimalField(),
  costPrice: decimalField(),
  discountType: z.enum(["none", "percent", "amount"]),
  discountValue: decimalField(),
  taxRateId: z.string().uuid().optional().or(z.literal("")),
  notes: z.string().trim().max(5000).optional().or(z.literal("")),
});

export type ProductInput = z.infer<typeof productSchema>;

/* ------------------------------------------------------------------ */
/* Documents (quotations and invoices share the line model)            */
/* ------------------------------------------------------------------ */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const dateField = z
  .string()
  .trim()
  .regex(DATE_RE, "Use YYYY-MM-DD")
  .optional()
  .or(z.literal(""));

export const documentLineSchema = z.object({
  /** Empty for custom lines that are not in the catalogue. */
  productId: z.string().uuid().optional().or(z.literal("")),
  name: z.string().trim().min(1, "Line name is required").max(300),
  description: z.string().trim().max(5000).optional().or(z.literal("")),
  unit: z.string().trim().min(1).max(30),
  quantity: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,4})?$/, "Quantity must be a positive number")
    .refine((v) => Number(v) > 0, "Quantity must be greater than zero"),
  unitPrice: z.string().trim().regex(/^\d+(\.\d{1,4})?$/, "Invalid unit price").or(z.literal("0")),
  discountType: z.enum(["none", "percent", "amount"]),
  discountValue: decimalField(),
  /** Empty = no tax on this line. */
  taxRateId: z.string().uuid().optional().or(z.literal("")),
});

export type DocumentLineInput = z.infer<typeof documentLineSchema>;

export const documentChargeSchema = z.object({
  label: z.string().trim().min(1, "Charge label is required").max(120),
  amount: z.string().trim().regex(/^\d+(\.\d{1,4})?$/, "Invalid amount").or(z.literal("0")),
  taxable: z.boolean(),
});

export type DocumentChargeInput = z.infer<typeof documentChargeSchema>;

export const milestoneSchema = z.object({
  label: z.string().trim().min(1, "Milestone label is required").max(120),
  percent: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,4})?$/, "Invalid percentage")
    .refine((v) => Number(v) > 0 && Number(v) <= 100, "Percent must be between 0 and 100"),
  dueOn: dateField,
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

export type MilestoneInput = z.infer<typeof milestoneSchema>;

export const quotationSchema = z.object({
  id: z.string().uuid().optional(),
  customerId: z.string().uuid("Select a customer"),
  issueDate: z.string().trim().regex(DATE_RE, "Use YYYY-MM-DD"),
  expiryDate: dateField,
  currency: z.string().trim().length(3),
  customerPo: z.string().trim().max(60).optional().or(z.literal("")),
  notes: z.string().trim().max(5000).optional().or(z.literal("")),
  terms: z.string().trim().max(10000).optional().or(z.literal("")),
  internalNotes: z.string().trim().max(5000).optional().or(z.literal("")),
  documentDiscountType: z.enum(["none", "percent", "amount"]),
  documentDiscountValue: decimalField(),
  lines: z.array(documentLineSchema).min(1, "Add at least one line item"),
  charges: z.array(documentChargeSchema).default([]),
  milestones: z.array(milestoneSchema).default([]),
});

export type QuotationInput = z.infer<typeof quotationSchema>;

export const invoiceSchema = z.object({
  id: z.string().uuid().optional(),
  customerId: z.string().uuid("Select a customer"),
  issueDate: z.string().trim().regex(DATE_RE, "Use YYYY-MM-DD"),
  dueDate: dateField,
  currency: z.string().trim().length(3),
  customerPo: z.string().trim().max(60).optional().or(z.literal("")),
  projectReference: z.string().trim().max(120).optional().or(z.literal("")),
  notes: z.string().trim().max(5000).optional().or(z.literal("")),
  terms: z.string().trim().max(10000).optional().or(z.literal("")),
  internalNotes: z.string().trim().max(5000).optional().or(z.literal("")),
  paymentInstructions: z.string().trim().max(5000).optional().or(z.literal("")),
  documentDiscountType: z.enum(["none", "percent", "amount"]),
  documentDiscountValue: decimalField(),
  depositAmount: decimalField(),
  lines: z.array(documentLineSchema).min(1, "Add at least one line item"),
  charges: z.array(documentChargeSchema).default([]),
});

export type InvoiceInput = z.infer<typeof invoiceSchema>;

/** Payment recording: amount must be positive and allocations balanced. */
export const paymentSchema = z.object({
  customerId: z.string().uuid("Select a customer"),
  paymentDate: z.string().trim().regex(DATE_RE, "Use YYYY-MM-DD"),
  methodCode: z.string().trim().min(1, "Select a payment method"),
  amount: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/, "Invalid amount")
    .refine((v) => Number(v) > 0, "Amount must be greater than zero"),
  currency: z.string().trim().length(3),
  externalReference: z.string().trim().max(120).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  /** [{ invoiceId, amount }] — must not exceed the payment amount. */
  allocations: z
    .array(
      z.object({
        invoiceId: z.string().uuid(),
        amount: z.string().trim().regex(/^\d+(\.\d{1,2})?$/),
      })
    )
    .default([]),
});

export type PaymentInput = z.infer<typeof paymentSchema>;

export const creditNoteSchema = z.object({
  id: z.string().uuid().optional(),
  invoiceId: z.string().uuid("Select the invoice being credited"),
  issueDate: z.string().trim().regex(DATE_RE, "Use YYYY-MM-DD"),
  reason: z.string().trim().min(1, "A reason is required").max(500),
  notes: z.string().trim().max(5000).optional().or(z.literal("")),
  lines: z.array(documentLineSchema).min(1, "Add at least one line item"),
});

export type CreditNoteInput = z.infer<typeof creditNoteSchema>;


/** CSV import expectations — column name → validator. */
export const CSV_CONFIG = {
  customers: {
    required: ["name"],
    optional: [
      "customerType",
      "legalName",
      "registrationNumber",
      "taxRegistrationNumber",
      "billingAddress",
      "shippingAddress",
      "contactPerson",
      "email",
      "phone",
      "customerReference",
      "paymentTermsDays",
      "defaultCurrency",
      "taxExempt",
      "notes",
    ],
  },
  products: {
    required: ["name", "unitPrice"],
    optional: [
      "kind",
      "sku",
      "description",
      "unit",
      "discountType",
      "discountValue",
      "costPrice",
      "notes",
    ],
  },
} as const;

export function formatZodErrors(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.join(".");
    return path ? `${path}: ${issue.message}` : issue.message;
  });
}
