"use client";

import type { ReactNode } from "react";

import { Field } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface UserDetailFieldProps {
  label: string;
  htmlFor?: string;
  children: ReactNode;
}

export function UserDetailField({ label, htmlFor, children }: UserDetailFieldProps) {
  return (
    <Field className="gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </Field>
  );
}

export function UserDetailValue({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-h-11 items-center rounded-full border border-input bg-background px-5 py-2 text-body sm:min-h-(--size-control)", className)}>
      {children}
    </div>
  );
}
