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
  /**
   * Read from an env var, since the repo is public. Unset, the code is not
   * shown.
   */
  code: string | undefined;
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
    code: process.env.DISCOUNT_CODE_HAKUMORI,
    expiresAt: "2027-03-31T23:59:59.999-07:00",
  },
];

export type ActiveDiscountCode = DiscountCode & { code: string };

/**
 * The codes still usable at `now`. A code whose expiry cannot be read is
 * dropped rather than shown forever, and one whose env var is unset is dropped.
 */
export function getActiveDiscountCodes(
  codes: DiscountCode[],
  now = new Date()
): ActiveDiscountCode[] {
  return codes.filter(
    (code): code is ActiveDiscountCode =>
      Boolean(code.code) && now <= new Date(code.expiresAt)
  );
}
