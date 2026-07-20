"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface FlowLinkProps extends Omit<React.ComponentProps<typeof Link>, "href"> {
  href: string;
}

export function useFlowHref(href: string) {
  const pathname = usePathname();
  const target = new URL(href, "https://uxhub.local");

  if (!target.searchParams.has("returnTo")) {
    target.searchParams.set("returnTo", pathname);
  }

  return `${target.pathname}${target.search}${target.hash}`;
}

export function FlowLink({ href, ...props }: FlowLinkProps) {
  return <Link href={useFlowHref(href)} {...props} />;
}
