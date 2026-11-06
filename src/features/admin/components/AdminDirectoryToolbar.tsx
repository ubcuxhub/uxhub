"use client";

import { useRef, type ReactNode } from "react";
import { Search } from "lucide-react";

import { TableRowCount, type TableRowCountValue } from "@/components/shared/TableToolbar";
import { Input } from "@/components/ui/input";

interface AdminDirectoryToolbarProps {
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  searchLabel: string;
  placeholder: string;
  children: ReactNode;
  /**
   * How many rows are listed, on a line under the toolbar: "142 users", or
   * "38 of 142 users" while searching or filtering.
   */
  count?: TableRowCountValue;
  /** With `count`, a "Show all" button while filtering. Clear the search too. */
  onClearFilters?: () => void;
}

export function AdminDirectoryToolbar({
  searchQuery,
  onSearchQueryChange,
  searchLabel,
  placeholder,
  children,
  count,
  onClearFilters,
}: AdminDirectoryToolbarProps) {
  const searchRef = useRef<HTMLInputElement>(null);
  const toolbar = (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative min-w-0 flex-1">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          ref={searchRef}
          type="search"
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
          placeholder={placeholder}
          aria-label={searchLabel}
          className="pl-9"
        />
      </div>
      {children}
    </div>
  );

  if (!count) return toolbar;
  return (
    <div className="flex flex-col gap-3">
      {toolbar}
      <TableRowCount
        count={count}
        onClearFilters={
          onClearFilters
            ? () => {
                onClearFilters();
                // The button goes with the filters; keep focus nearby.
                searchRef.current?.focus();
              }
            : undefined
        }
      />
    </div>
  );
}
