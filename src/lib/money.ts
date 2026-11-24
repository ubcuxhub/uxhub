/**
 * Money as every screen and email shows it: Canadian English, two decimals,
 * "$15.00". One place, so a price reads the same wherever it appears.
 */

const formatters = new Map<string, Intl.NumberFormat>();

function formatter(currency: string, narrow: boolean) {
  const key = `${currency}:${narrow}`;
  let format = formatters.get(key);
  if (!format) {
    format = new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency,
      ...(narrow ? { currencyDisplay: "narrowSymbol" } : {}),
    });
    formatters.set(key, format);
  }
  return format;
}

interface MoneyOptions {
  /** ISO 4217 code. Defaults to CAD, the only currency the club charges in. */
  currency?: string;
  /**
   * Spell the code out after a bare symbol: "$12.50 CAD". For receipts and
   * refunds, where the currency must be unambiguous.
   */
  withCode?: boolean;
}

/** "$15.00" for a dollar amount (as prices are stored on events and tiers). */
export function formatDollars(amount: number, { currency = "CAD", withCode = false }: MoneyOptions = {}): string {
  const text = formatter(currency, withCode).format(amount);
  return withCode ? `${text} ${currency}` : text;
}

/** "$15.00" for an amount in cents (as purchases and refunds are stored). */
export function formatCents(cents: number, options?: MoneyOptions): string {
  return formatDollars(cents / 100, options);
}

interface PriceOptions {
  /** What a zero price reads as. */
  free?: string;
}

/**
 * A ticket or tier price: "Free" for zero, "$15.00" otherwise. A missing price
 * (null, undefined or a blank string) gives `unset`, or null without one.
 */
export function formatPrice(value: number, options?: PriceOptions): string;
export function formatPrice(
  value: number | string | null | undefined,
  options: PriceOptions & { unset: string },
): string;
export function formatPrice(
  value: number | string | null | undefined,
  options?: PriceOptions & { unset?: null },
): string | null;
export function formatPrice(
  value: number | string | null | undefined,
  { free = "Free", unset = null }: PriceOptions & { unset?: string | null } = {},
): string | null {
  if (value === null || value === undefined || (typeof value === "string" && value.trim() === "")) {
    return unset;
  }
  const amount = Number(value);
  return amount === 0 ? free : formatDollars(amount);
}
