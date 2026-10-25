/**
 * RFC 4180 CSV helpers, shared by customer/product export and reports.
 *
 * Formula-injection defence: values starting with = + - @ (or tab/CR) are
 * prefixed with an apostrophe so Excel/Sheets cannot execute them.
 */

const NEEDS_QUOTING = /[",\n\r]/;
const RISKY_PREFIX = /^[=+\-@\t\r]/;

export function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return "";

  let s: string;
  if (value instanceof Date) s = value.toISOString().slice(0, 10);
  else if (typeof value === "boolean") s = value ? "true" : "false";
  else s = String(value);

  if (RISKY_PREFIX.test(s)) s = `'${s}`;
  if (NEEDS_QUOTING.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(escapeCsvValue).join(",")];
  for (const row of rows) lines.push(row.map(escapeCsvValue).join(","));
  // Trailing newline so appenders and Excel agree.
  return `${lines.join("\r\n")}\r\n`;
}

/**
 * RFC 4180 parser for imports. Handles quoted fields, embedded commas,
 * escaped quotes ("") and CRLF/LF line endings. Returns rows of raw strings.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  // Strip a UTF-8 BOM if present.
  if (text.charCodeAt(0) === 0xfeff) i = 1;

  while (i < text.length) {
    const ch = text[i]!;

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }

    if (ch === '"' && field === "") {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      i += 1;
      continue;
    }
    if (ch === "\r") {
      i += 1;
      continue;
    }
    if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  // Drop fully empty trailing rows.
  return rows.filter((r) => r.some((v) => v.trim() !== ""));
}

/** Safe download filename: letters, digits, dash, dot only. */
export function safeFilename(base: string, extension = "csv"): string {
  const cleaned = base.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/-+/g, "-");
  return `${cleaned || "export"}.${extension}`;
}
