"use client";

import { ListFilter } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverTrigger,
} from "@/components/ui/popover";

import { AdminDirectoryButton, AdminDirectoryPopoverContent } from "./AdminDirectoryControls";

interface DirectoryFilterGroup {
  id: string;
  label: string;
  options: { value: string; label: string }[];
  selectedValues: ReadonlySet<string>;
  onToggle: (value: string) => void;
}

export function AdminDirectoryFilters({
  groups,
  onClear,
}: {
  groups: DirectoryFilterGroup[];
  onClear: () => void;
}) {
  const activeFilterCount = groups.reduce(
    (count, group) => count + group.selectedValues.size,
    0
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <AdminDirectoryButton type="button">
          <ListFilter aria-hidden="true" />
          Filters
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="min-w-5 justify-center px-1.5 font-normal">
              {activeFilterCount}
            </Badge>
          )}
        </AdminDirectoryButton>
      </PopoverTrigger>
      <AdminDirectoryPopoverContent align="end" className="w-64 p-0">
        {groups.map((group, index) => (
          <div
            key={group.id}
            role="group"
            aria-labelledby={group.id}
            className={index === 0 ? "p-4 pt-5" : "border-t p-4 pt-5"}
          >
            <h3 id={group.id} className="mb-3 text-sm font-normal">
              {group.label}
            </h3>
            <div className="space-y-2">
              {group.options.map((option) => (
                <label
                  key={option.value}
                  className="flex cursor-pointer items-center gap-2 text-sm"
                >
                  <Checkbox
                    checked={group.selectedValues.has(option.value)}
                    onCheckedChange={() => group.onToggle(option.value)}
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </div>
        ))}
        {activeFilterCount > 0 && (
          <div className="border-t p-2">
            <Button
              type="button"
              variant="ghost"
              className="w-full font-normal"
              onClick={onClear}
            >
              Clear filters
            </Button>
          </div>
        )}
      </AdminDirectoryPopoverContent>
    </Popover>
  );
}
