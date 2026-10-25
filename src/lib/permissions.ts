/**
 * Permission catalogue and role → permission mapping.
 *
 * `code` values are checked by requirePermission() on every server action,
 * route handler and page. The sidebar renders from this same list, so the UI
 * and the server can never disagree about what a role may do.
 *
 * The `permissions` table is seeded from PERMISSIONS by scripts/bootstrap-admin.ts
 * so role_permissions rows always reference valid codes.
 */

export const PERMISSIONS = {
  DASHBOARD_VIEW: "dashboard.view",

  CUSTOMER_VIEW: "customer.view",
  CUSTOMER_CREATE: "customer.create",
  CUSTOMER_EDIT: "customer.edit",
  CUSTOMER_ARCHIVE: "customer.archive",
  CUSTOMER_IMPORT: "customer.import",
  CUSTOMER_EXPORT: "customer.export",

  PRODUCT_VIEW: "product.view",
  PRODUCT_CREATE: "product.create",
  PRODUCT_EDIT: "product.edit",
  PRODUCT_ARCHIVE: "product.archive",
  PRODUCT_IMPORT: "product.import",
  PRODUCT_EXPORT: "product.export",
  /** Seeing cost price / margin figures. */
  PRODUCT_COST: "product.cost",

  QUOTATION_VIEW: "quotation.view",
  QUOTATION_CREATE: "quotation.create",
  QUOTATION_EDIT: "quotation.edit",
  QUOTATION_ISSUE: "quotation.issue",
  QUOTATION_DECIDE: "quotation.decide",
  QUOTATION_CONVERT: "quotation.convert",
  QUOTATION_ARCHIVE: "quotation.archive",

  INVOICE_VIEW: "invoice.view",
  INVOICE_CREATE: "invoice.create",
  INVOICE_EDIT: "invoice.edit",
  INVOICE_ISSUE: "invoice.issue",
  INVOICE_SEND: "invoice.send",
  INVOICE_VOID: "invoice.void",

  PAYMENT_VIEW: "payment.view",
  PAYMENT_CREATE: "payment.create",
  PAYMENT_REVERSE: "payment.reverse",
  PAYMENT_EXPORT: "payment.export",

  CREDIT_NOTE_VIEW: "credit_note.view",
  CREDIT_NOTE_CREATE: "credit_note.create",
  CREDIT_NOTE_ISSUE: "credit_note.issue",
  CREDIT_NOTE_APPLY: "credit_note.apply",

  DOCUMENT_DOWNLOAD: "document.download",
  DOCUMENT_PRINT: "document.print",

  REPORT_VIEW: "report.view",
  REPORT_EXPORT: "report.export",

  TEMPLATE_VIEW: "template.view",
  TEMPLATE_EDIT: "template.edit",

  SETTINGS_VIEW: "settings.view",
  SETTINGS_EDIT: "settings.edit",

  USER_VIEW: "user.view",
  USER_CREATE: "user.create",
  USER_EDIT: "user.edit",
  /** Assigning/revoking roles — Super Admin only. */
  USER_MANAGE_ROLES: "user.manage_roles",

  AUDIT_VIEW: "audit.view",
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const PERMISSION_LIST: {
  code: PermissionCode;
  category: string;
  description: string;
}[] = [
  { code: PERMISSIONS.DASHBOARD_VIEW, category: "Dashboard", description: "View the dashboard and its metrics" },

  { code: PERMISSIONS.CUSTOMER_VIEW, category: "Customers", description: "View customers" },
  { code: PERMISSIONS.CUSTOMER_CREATE, category: "Customers", description: "Create customers" },
  { code: PERMISSIONS.CUSTOMER_EDIT, category: "Customers", description: "Edit customers" },
  { code: PERMISSIONS.CUSTOMER_ARCHIVE, category: "Customers", description: "Archive and restore customers" },
  { code: PERMISSIONS.CUSTOMER_IMPORT, category: "Customers", description: "Import customers from CSV" },
  { code: PERMISSIONS.CUSTOMER_EXPORT, category: "Customers", description: "Export customers to CSV" },

  { code: PERMISSIONS.PRODUCT_VIEW, category: "Catalogue", description: "View products and services" },
  { code: PERMISSIONS.PRODUCT_CREATE, category: "Catalogue", description: "Create products and services" },
  { code: PERMISSIONS.PRODUCT_EDIT, category: "Catalogue", description: "Edit products and services" },
  { code: PERMISSIONS.PRODUCT_ARCHIVE, category: "Catalogue", description: "Archive and restore products" },
  { code: PERMISSIONS.PRODUCT_IMPORT, category: "Catalogue", description: "Import the catalogue from CSV" },
  { code: PERMISSIONS.PRODUCT_EXPORT, category: "Catalogue", description: "Export the catalogue to CSV" },
  { code: PERMISSIONS.PRODUCT_COST, category: "Catalogue", description: "See cost price and margin" },

  { code: PERMISSIONS.QUOTATION_VIEW, category: "Quotations", description: "View quotations" },
  { code: PERMISSIONS.QUOTATION_CREATE, category: "Quotations", description: "Create quotations" },
  { code: PERMISSIONS.QUOTATION_EDIT, category: "Quotations", description: "Edit draft quotations" },
  { code: PERMISSIONS.QUOTATION_ISSUE, category: "Quotations", description: "Issue and send quotations" },
  { code: PERMISSIONS.QUOTATION_DECIDE, category: "Quotations", description: "Record acceptance or rejection" },
  { code: PERMISSIONS.QUOTATION_CONVERT, category: "Quotations", description: "Convert quotations to invoices" },
  { code: PERMISSIONS.QUOTATION_ARCHIVE, category: "Quotations", description: "Cancel and archive quotations" },

  { code: PERMISSIONS.INVOICE_VIEW, category: "Invoices", description: "View invoices" },
  { code: PERMISSIONS.INVOICE_CREATE, category: "Invoices", description: "Create draft invoices" },
  { code: PERMISSIONS.INVOICE_EDIT, category: "Invoices", description: "Edit draft invoices" },
  { code: PERMISSIONS.INVOICE_ISSUE, category: "Invoices", description: "Issue invoices" },
  { code: PERMISSIONS.INVOICE_SEND, category: "Invoices", description: "Email invoices" },
  { code: PERMISSIONS.INVOICE_VOID, category: "Invoices", description: "Void invoices with a reason" },

  { code: PERMISSIONS.PAYMENT_VIEW, category: "Payments", description: "View payments and receipts" },
  { code: PERMISSIONS.PAYMENT_CREATE, category: "Payments", description: "Record payments" },
  { code: PERMISSIONS.PAYMENT_REVERSE, category: "Payments", description: "Reverse payments with a reason" },
  { code: PERMISSIONS.PAYMENT_EXPORT, category: "Payments", description: "Export payment records" },

  { code: PERMISSIONS.CREDIT_NOTE_VIEW, category: "Credit Notes", description: "View credit notes" },
  { code: PERMISSIONS.CREDIT_NOTE_CREATE, category: "Credit Notes", description: "Create credit notes" },
  { code: PERMISSIONS.CREDIT_NOTE_ISSUE, category: "Credit Notes", description: "Issue credit notes" },
  { code: PERMISSIONS.CREDIT_NOTE_APPLY, category: "Credit Notes", description: "Apply credit notes to invoices" },

  { code: PERMISSIONS.DOCUMENT_DOWNLOAD, category: "Documents", description: "Download document PDFs" },
  { code: PERMISSIONS.DOCUMENT_PRINT, category: "Documents", description: "Print documents" },

  { code: PERMISSIONS.REPORT_VIEW, category: "Reports", description: "View financial reports" },
  { code: PERMISSIONS.REPORT_EXPORT, category: "Reports", description: "Export reports to CSV" },

  { code: PERMISSIONS.TEMPLATE_VIEW, category: "Designer", description: "View document templates" },
  { code: PERMISSIONS.TEMPLATE_EDIT, category: "Designer", description: "Edit and version document templates" },

  { code: PERMISSIONS.SETTINGS_VIEW, category: "Settings", description: "View business settings" },
  { code: PERMISSIONS.SETTINGS_EDIT, category: "Settings", description: "Change business settings" },

  { code: PERMISSIONS.USER_VIEW, category: "Users", description: "View the user list" },
  { code: PERMISSIONS.USER_CREATE, category: "Users", description: "Create user accounts" },
  { code: PERMISSIONS.USER_EDIT, category: "Users", description: "Edit, disable and reactivate users" },
  { code: PERMISSIONS.USER_MANAGE_ROLES, category: "Users", description: "Assign and revoke roles" },

  { code: PERMISSIONS.AUDIT_VIEW, category: "Audit", description: "View audit logs" },
];

export const ROLE_KEYS = ["super_admin", "admin", "sales", "finance", "viewer"] as const;
export type RoleKey = (typeof ROLE_KEYS)[number];

export const ROLE_LABELS: Record<RoleKey, string> = {
  super_admin: "Super Admin",
  admin: "Administrator",
  sales: "Sales",
  finance: "Finance",
  viewer: "Viewer",
};

const ALL = PERMISSION_LIST.map((p) => p.code);

const VIEW_ONLY = [
  PERMISSIONS.DASHBOARD_VIEW,
  PERMISSIONS.CUSTOMER_VIEW,
  PERMISSIONS.PRODUCT_VIEW,
  PERMISSIONS.PRODUCT_COST,
  PERMISSIONS.QUOTATION_VIEW,
  PERMISSIONS.INVOICE_VIEW,
  PERMISSIONS.PAYMENT_VIEW,
  PERMISSIONS.CREDIT_NOTE_VIEW,
  PERMISSIONS.DOCUMENT_DOWNLOAD,
  PERMISSIONS.DOCUMENT_PRINT,
  PERMISSIONS.REPORT_VIEW,
  PERMISSIONS.TEMPLATE_VIEW,
  PERMISSIONS.SETTINGS_VIEW,
];

export const ROLE_PERMISSIONS: Record<RoleKey, PermissionCode[]> = {
  super_admin: ALL,
  admin: ALL.filter((code) => code !== PERMISSIONS.USER_MANAGE_ROLES),
  sales: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.CUSTOMER_VIEW,
    PERMISSIONS.CUSTOMER_CREATE,
    PERMISSIONS.CUSTOMER_EDIT,
    PERMISSIONS.CUSTOMER_ARCHIVE,
    PERMISSIONS.CUSTOMER_EXPORT,
    PERMISSIONS.PRODUCT_VIEW,
    PERMISSIONS.PRODUCT_EXPORT,
    PERMISSIONS.QUOTATION_VIEW,
    PERMISSIONS.QUOTATION_CREATE,
    PERMISSIONS.QUOTATION_EDIT,
    PERMISSIONS.QUOTATION_ISSUE,
    PERMISSIONS.QUOTATION_DECIDE,
    PERMISSIONS.QUOTATION_CONVERT,
    PERMISSIONS.QUOTATION_ARCHIVE,
    PERMISSIONS.INVOICE_VIEW,
    PERMISSIONS.INVOICE_CREATE,
    PERMISSIONS.INVOICE_EDIT,
    PERMISSIONS.INVOICE_ISSUE,
    PERMISSIONS.INVOICE_SEND,
    PERMISSIONS.DOCUMENT_DOWNLOAD,
    PERMISSIONS.DOCUMENT_PRINT,
    PERMISSIONS.REPORT_VIEW,
  ],
  finance: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.CUSTOMER_VIEW,
    PERMISSIONS.CUSTOMER_CREATE,
    PERMISSIONS.CUSTOMER_EDIT,
    PERMISSIONS.CUSTOMER_EXPORT,
    PERMISSIONS.PRODUCT_VIEW,
    PERMISSIONS.PRODUCT_COST,
    PERMISSIONS.QUOTATION_VIEW,
    PERMISSIONS.INVOICE_VIEW,
    PERMISSIONS.INVOICE_CREATE,
    PERMISSIONS.INVOICE_EDIT,
    PERMISSIONS.INVOICE_ISSUE,
    PERMISSIONS.INVOICE_SEND,
    PERMISSIONS.INVOICE_VOID,
    PERMISSIONS.PAYMENT_VIEW,
    PERMISSIONS.PAYMENT_CREATE,
    PERMISSIONS.PAYMENT_REVERSE,
    PERMISSIONS.PAYMENT_EXPORT,
    PERMISSIONS.CREDIT_NOTE_VIEW,
    PERMISSIONS.CREDIT_NOTE_CREATE,
    PERMISSIONS.CREDIT_NOTE_ISSUE,
    PERMISSIONS.CREDIT_NOTE_APPLY,
    PERMISSIONS.DOCUMENT_DOWNLOAD,
    PERMISSIONS.DOCUMENT_PRINT,
    PERMISSIONS.REPORT_VIEW,
    PERMISSIONS.REPORT_EXPORT,
    PERMISSIONS.AUDIT_VIEW,
  ],
  viewer: VIEW_ONLY,
};

export function hasPermission(
  granted: readonly string[],
  code: PermissionCode
): boolean {
  return granted.includes(code);
}
