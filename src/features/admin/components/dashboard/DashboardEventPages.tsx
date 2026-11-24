"use client";

import Link from "next/link";
import { ChevronDown, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export function DashboardEventPages({ marketingHref, signupHref }: { marketingHref: string | null; signupHref: string | null }) {
  if (!marketingHref && !signupHref) return null;
  return <DropdownMenu><DropdownMenuTrigger asChild><Button variant="secondary" className="h-auto min-h-11 whitespace-normal py-2 sm:min-h-10">View full page<ChevronDown aria-hidden="true" /></Button></DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-72 max-w-[calc(100vw-2.5rem)]">
      {marketingHref && <DropdownMenuItem asChild><Link href={marketingHref}>Marketing page<ExternalLink aria-hidden="true" className="ml-auto" /></Link></DropdownMenuItem>}
      {signupHref && <DropdownMenuItem asChild><Link href={signupHref}>Sign-up page<ExternalLink aria-hidden="true" className="ml-auto" /></Link></DropdownMenuItem>}
    </DropdownMenuContent>
  </DropdownMenu>;
}
