/**
 * Formatting helpers shared by the UI, PDFs and CSV exports.
 *
 * Money arrives from Postgres as a string (NUMERIC), so everything here
 * accepts strings or numbers and never converts through JS float math for
 * arithmetic — only for display.
 */

const CURRENCY_SYMBOLS: Record<string, string> = {
  MYR: "RM",
  USD: "$",
  EUR: "€",
  GBP: "£",
  SGD: "S$",
  AUD: "A$",
};

export function currencySymbol(currency: string): string {
  return CURRENCY_SYMBOLS[currency.toUpperCase()] ?? currency.toUpperCase();
}

export function formatMoney(
  value: string | number,
  currency = "MYR",
  locale = "en-MY"
): string {
  const amount = typeof value === "string" ? Number.parseFloat(value || "0") : value;
  const safe = Number.isFinite(amount) ? amount : 0;

  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safe);

  const symbol = currencySymbol(currency);
  return symbol === currency.toUpperCase()
    ? `${formatted} ${currency.toUpperCase()}`
    : `${symbol}${formatted}`;
}

/** Compact label for charts/axis: RM1.2k etc. */
export function formatMoneyCompact(value: number, currency = "MYR"): string {
  const symbol = currencySymbol(currency);
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${symbol}${(value / 1_000_000).toFixed(1)}m`;
  if (abs >= 1_000) return `${symbol}${(value / 1_000).toFixed(1)}k`;
  return `${symbol}${value.toFixed(0)}`;
}

/** Dates are stored as YYYY-MM-DD; render them without timezone drift. */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(`${value}T00:00:00Z`) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kuala_Lumpur",
  }).format(d);
}

export function formatPercent(value: number, fractionDigits = 1): string {
  return `${value.toFixed(fractionDigits)}%`;
}

/** Today's date in the configured timezone as YYYY-MM-DD. */
export function todayInTimezone(timezone = "Asia/Kuala_Lumpur"): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
