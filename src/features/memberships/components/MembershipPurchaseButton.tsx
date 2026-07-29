"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface MembershipPurchaseButtonProps {
  checkoutHref: string;
  disabled: boolean;
  isCurrent: boolean;
  label: string;
}

export function MembershipPurchaseButton({
  checkoutHref,
  disabled,
  isCurrent,
  label,
}: MembershipPurchaseButtonProps) {
  const router = useRouter();

  return (
    <Button
      className="w-full"
      variant={isCurrent ? "outline" : "default"}
      disabled={disabled}
      onClick={() => router.push(checkoutHref)}
    >
      {label}
    </Button>
  );
}
