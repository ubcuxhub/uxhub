"use client";

import type { ReactNode } from "react";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { directoryControlClassName } from "./AdminDirectoryControls";

interface AdminDirectoryToolbarProps {
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  searchLabel: string;
  placeholder: string;
  children: ReactNode;
}

export function AdminDirectoryToolbar({
  searchQuery,
  onSearchQueryChange,
  searchLabel,
  placeholder,
  children,
}: AdminDirectoryToolbarProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center [&_svg]:size-4! [&_svg]:stroke-2 [&_svg]:opacity-100!">
      <div className="relative min-w-0 flex-1">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          type="search"
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
          placeholder={placeholder}
          aria-label={searchLabel}
          className={cn(directoryControlClassName, "pl-9")}
        />
      </div>
      {children}
    </div>
  );
}
