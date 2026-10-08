"use client";

import type { ComponentProps } from "react";

import { Button } from "@/components/ui/button";
import { SelectContent, SelectTrigger } from "@/components/ui/select";
import { PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export const directoryControlClassName =
  "rounded-md shadow-sm text-body font-normal";

const directoryDropdownClassName =
  "rounded-md shadow-md text-body font-normal [&_svg]:stroke-2";

export function AdminDirectoryButton({
  className,
  ...props
}: ComponentProps<typeof Button>) {
  return (
    <Button
      variant="outline"
      {...props}
      className={cn(directoryControlClassName, "justify-between sm:justify-center", className)}
    />
  );
}

export function AdminDirectorySelectTrigger({
  className,
  ...props
}: ComponentProps<typeof SelectTrigger>) {
  return (
    <SelectTrigger {...props} className={cn(directoryControlClassName, className)} />
  );
}

export function AdminDirectorySelectContent({
  className,
  ...props
}: ComponentProps<typeof SelectContent>) {
  return (
    <SelectContent {...props} className={cn(directoryDropdownClassName, className)} />
  );
}

export function AdminDirectoryPopoverContent({
  className,
  ...props
}: ComponentProps<typeof PopoverContent>) {
  return (
    <PopoverContent {...props} className={cn(directoryDropdownClassName, className)} />
  );
}
