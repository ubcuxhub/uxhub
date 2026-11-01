import { CopyCode } from "@/components/shared/CopyCode";
import { Separator } from "@/components/ui/separator";
import {
  DISCOUNT_CODES,
  getActiveDiscountCodes,
} from "@/features/memberships/lib/discount-codes";
import { formatEventDate } from "@/lib/date";

/**
 * Members' partner discount codes. A server component, so the codes are only
 * sent to the members it renders for. Renders nothing once every code has
 * expired.
 */
export function DiscountCodes() {
  const codes = getActiveDiscountCodes(DISCOUNT_CODES);
  if (codes.length === 0) return null;

  return (
    <section className="mt-8 flex max-w-[490px] flex-col gap-3 rounded-2xl border border-border-subtle p-6">
      <h2 className="text-subheading">Discount Codes</h2>
      <Separator />

      <ul className="flex flex-col gap-6">
        {codes.map((discount) => (
          <li key={discount.code} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-4">
              <p className="font-medium">{discount.businessName}</p>
              <a
                href={discount.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Visit ${discount.businessName} (opens in a new tab)`}
                className="text-small text-muted-foreground underline underline-offset-2 hover:text-primary-hover"
              >
                Visit
              </a>
            </div>
            <p className="text-small text-muted-foreground">
              {discount.description} | Expires {formatEventDate(discount.expiresAt)}
            </p>

            <div className="flex flex-col gap-1 mt-2">
              <CopyCode code={discount.code} label="Copy discount code" />
              {/* <p className="text-small text-muted-foreground">
                Expires {formatEventDate(discount.expiresAt)}
              </p> */}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
