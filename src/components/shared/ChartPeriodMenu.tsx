"use client";

import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

/** Year overview or monthly detail for a named reporting year. No calendar assumptions. */
export function ChartPeriodMenu({ period, years, selectedYear, onChange }: {
  period: "year" | "month"; years: { value: number; label: string }[]; selectedYear: number;
  onChange: (period: "year" | "month", year: number) => void;
}) {
  return <DropdownMenu>
    <DropdownMenuTrigger asChild><Button variant="secondary" size="sm" aria-label={`Chart period: ${period === "year" ? "Yearly" : "Monthly"}`}>{period === "year" ? "Yearly" : "Monthly"}<ChevronDown aria-hidden="true" /></Button></DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem onSelect={() => onChange("year", selectedYear)}>Yearly</DropdownMenuItem>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>Monthly</DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="max-h-72 max-w-[calc(100vw-2rem)] overflow-y-auto">
          {years.map((year) => <DropdownMenuItem key={year.value} onSelect={() => onChange("month", year.value)}>{year.label}</DropdownMenuItem>)}
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    </DropdownMenuContent>
  </DropdownMenu>;
}
