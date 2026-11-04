import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";

export function formatSignedAmount(cents: number, currency = "CAD") {
  const tone = cents < 0 ? "negative" : "positive";
  const amount = new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
  }).format(Math.abs(cents) / 100);
  return {
    text: `${tone === "negative" ? "−" : "+"}${amount}`,
    tone,
    spoken: `${tone === "negative" ? "Charge" : "Credit"} ${amount} ${currency}`,
  } as const;
}

interface TransactionRowProps extends ComponentProps<"div"> {
  title: string;
  description?: string;
  amountCents: number;
  currency?: string;
  date: string;
  media?: ReactNode;
}

/** One signed money movement, with a text cue alongside its colour. */
function TransactionRow({
  title,
  description,
  amountCents,
  currency = "CAD",
  date,
  media,
  className,
  ...props
}: TransactionRowProps) {
  const amount = formatSignedAmount(amountCents, currency);
  return (
    <div data-slot="transaction-row" className={cn("flex min-w-0 items-center gap-4 rounded-xl bg-section p-4", className)} {...props}>
      <div aria-hidden className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-muted">
        {media}
      </div>
      <div className="min-w-0 flex-1 break-words">
        <p className="text-body-medium text-foreground">{title}</p>
        {description ? <p className="text-small text-muted-foreground">{description}</p> : null}
      </div>
      <div className="shrink-0 text-right">
        <p className={cn("text-body-medium tabular-nums", amount.tone === "negative" ? "text-transaction-negative" : "text-success-foreground")}>
          <span className="sr-only">{amount.tone === "negative" ? "Charge" : "Credit"} </span>
          {amount.text}
        </p>
        <p className="text-small whitespace-nowrap text-muted-foreground">{date}</p>
      </div>
    </div>
  );
}

export { TransactionRow };
export type { TransactionRowProps };
