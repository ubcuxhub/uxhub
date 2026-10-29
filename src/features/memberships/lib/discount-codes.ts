import "server-only";

/**
 * Partner discount codes, a membership perk. Server-only so a code only ever
 * reaches the HTML of a member's page, never a client bundle. Edited by hand
 * until codes move to the database.
 */
export interface DiscountCode {
  businessName: string;
  url: string;
  description: string;
  code: string;
  /**
   * The last moment the code works, with its UTC offset written out so it
   * means the same instant on every server: the end of the expiry day in
   * Vancouver is `T23:59:59.999-07:00` in summer time, `-08:00` in winter.
   */
  expiresAt: string;
}

export const DISCOUNT_CODES: DiscountCode[] = [
  {
    businessName: "Hakumori",
    url: "https://www.instagram.com/hakumori.shop/?hl=en",
    description: "15% off all products",
    code: "UBCUXHUB",
    expiresAt: "2027-03-31T23:59:59.999-07:00",
  },
];

/**
 * The codes still usable at `now`. A code whose expiry cannot be read is
 * dropped rather than shown forever.
 */
export function getActiveDiscountCodes(
  codes: DiscountCode[],
  now = new Date()
): DiscountCode[] {
  return codes.filter((code) => now <= new Date(code.expiresAt));
}
