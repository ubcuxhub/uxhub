"use client";

import * as React from "react";
import { Search, X } from "lucide-react";

import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface SearchFieldProps
  extends Omit<
    React.ComponentProps<"input">,
    "type" | "value" | "defaultValue" | "onChange"
  > {
  /** Accessible name ("Search users"); becomes `aria-label`. */
  label: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Announced politely after filtering: "3 results" or "No results". */
  resultCount?: number;
  /** Default "Clear search". */
  clearLabel?: string;
}

/**
 * A pill search box (§3.16). Fills its container. A clear button appears once
 * there is text; Esc clears too, and only when there is text, so on an empty
 * field Esc still closes an enclosing dialog.
 */
function SearchField({
  label,
  value: valueProp,
  defaultValue = "",
  onValueChange,
  resultCount,
  clearLabel = "Clear search",
  className,
  disabled,
  onKeyDown,
  ref,
  ...props
}: SearchFieldProps) {
  const [inner, setInner] = React.useState(defaultValue);
  const value = valueProp ?? inner;
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const change = (next: string) => {
    if (valueProp === undefined) setInner(next);
    onValueChange?.(next);
  };

  const setRefs = (node: HTMLInputElement | null) => {
    inputRef.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref) ref.current = node;
  };

  return (
    <div
      data-slot="search-field"
      className={cn("relative w-full", className)}
    >
      <Search
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        {...props}
        ref={setRefs}
        type="search"
        aria-label={label}
        value={value}
        disabled={disabled}
        data-escape-clears=""
        enterKeyHint="search"
        autoComplete="off"
        spellCheck={false}
        className="pr-11 pl-11 [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none"
        onChange={(event) => change(event.target.value)}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (event.defaultPrevented || event.key !== "Escape" || !value) return;
          event.preventDefault();
          event.stopPropagation();
          change("");
        }}
      />
      {value && !disabled ? (
        <IconButton
          variant="ghost"
          size="icon-sm"
          label={clearLabel}
          className="absolute top-1/2 right-1.5 -translate-y-1/2"
          onClick={() => {
            change("");
            inputRef.current?.focus();
          }}
        >
          <X aria-hidden />
        </IconButton>
      ) : null}
      {resultCount === undefined ? null : (
        <span role="status" aria-live="polite" className="sr-only">
          {resultCount === 0
            ? "No results"
            : `${resultCount} ${resultCount === 1 ? "result" : "results"}`}
        </span>
      )}
    </div>
  );
}

export { SearchField };
