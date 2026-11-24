"use client";

import * as React from "react";
import { highlightMatch } from "@/components/ui/searchable-dropdown";
import { SearchField } from "@/components/ui/search-field";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useActiveDescendant } from "@/hooks/use-active-descendant";
import { cn } from "@/lib/utils";

export interface ActionSearchItem {
  id: string;
  label: string;
  description?: string;
  leading?: React.ReactNode;
  disabled?: boolean;
}
export interface ActionSearchGroup { label: string; items: readonly ActionSearchItem[] }
export interface ActionSearchProps {
  label: string;
  placeholder?: string;
  query: string;
  onQueryChange: (query: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: readonly ActionSearchGroup[];
  onSelect: (item: ActionSearchItem) => void;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  className?: string;
  contextAction?: { label: string; onSelect: () => void };
}

/** Navigation combobox: selection executes caller-owned actions, never a form value. */
export function ActionSearch({ label, placeholder, query, onQueryChange, open, onOpenChange, groups,
  onSelect, loading, error, onRetry, className, contextAction }: ActionSearchProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const listId = React.useId();
  const statusId = React.useId();
  const items = loading || error ? [] : groups.flatMap((group) => group.items);
  const enabled = items.filter((item) => !item.disabled);
  const active = useActiveDescendant(enabled.length, { homeEnd: false });
  const signature = enabled.map((item) => item.id).join("|");
  const [previous, setPrevious] = React.useState({ signature, query });
  if (previous.signature !== signature || previous.query !== query) {
    setPrevious({ signature, query });
    active.setActiveIndex(-1);
  }
  React.useEffect(() => {
    if (open && active.activeIndex >= 0) document.getElementById(active.getOptionId(active.activeIndex))?.scrollIntoView?.({ block: "nearest" });
  }, [open, active]);
  const close = () => onOpenChange(false);
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverAnchor asChild>
        <div className={cn("w-full min-w-0", className)} onKeyDownCapture={(event) => {
          if (event.key === "Escape" && open) { event.preventDefault(); event.stopPropagation(); close(); }
        }}>
          <SearchField ref={inputRef} label={label} placeholder={placeholder} role="combobox"
            aria-autocomplete="list" aria-expanded={open} aria-controls={open ? listId : undefined}
            aria-describedby={open ? statusId : undefined}
            aria-activedescendant={open && active.activeIndex >= 0 ? active.getOptionId(active.activeIndex) : undefined}
            value={query} maxLength={120}
            onValueChange={(value) => { active.setActiveIndex(-1); onQueryChange(value); onOpenChange(true); }}
            onFocus={() => onOpenChange(true)}
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing) return;
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                onOpenChange(true); active.onKeyDown(event);
              } else if (event.key === "Enter") {
                event.preventDefault();
                if (open && active.activeIndex >= 0) onSelect(enabled[active.activeIndex]);
              } else if (event.key === "Tab") {
                const control = open && !event.shiftKey ? contentRef.current?.querySelector<HTMLButtonElement>("button:not([disabled])") : null;
                if (control) { event.preventDefault(); control.focus(); }
                else close();
              }
            }} />
        </div>
      </PopoverAnchor>
      <PopoverContent ref={contentRef} role="presentation" align="start" sideOffset={4} collisionPadding={16}
        className="w-(--radix-popover-trigger-width) max-w-[calc(100vw-2rem)] max-h-(--radix-popover-content-available-height) overflow-y-auto rounded-lg p-1"
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
        onInteractOutside={(event) => { if (inputRef.current?.parentElement?.contains(event.target as Node)) event.preventDefault(); }}
        onEscapeKeyDown={(event) => { event.preventDefault(); inputRef.current?.focus(); close(); }}
        onKeyDownCapture={(event) => {
          if (event.key === "Tab") {
            event.preventDefault();
            event.stopPropagation();
            const controls = Array.from(contentRef.current?.querySelectorAll<HTMLButtonElement>("button:not([disabled])") ?? []);
            const index = controls.findIndex((control) => control === document.activeElement);
            const next = controls[index + (event.shiftKey ? -1 : 1)];
            if (next) { next.focus(); return; }
            inputRef.current?.focus();
            if (!event.shiftKey) close();
          }
        }}>
        {contextAction ? <div className="px-2 py-1"><Button size="sm" variant="ghost" onClick={() => { contextAction.onSelect(); inputRef.current?.focus(); }}>{contextAction.label}</Button></div> : null}
        <div id={listId} role="listbox" aria-label={label} aria-busy={Boolean(loading)} className="max-h-[min(24rem,var(--radix-popover-content-available-height))] overflow-y-auto">
          {loading || error ? null : groups.map((group) => group.items.length ? <div role="group" aria-label={group.label} key={group.label} className="border-border-subtle border-b pb-1 last:border-0">
            <div aria-hidden className="px-2.5 pt-2 pb-1 text-xs text-muted-foreground">{group.label}</div>
            {group.items.map((item) => {
              const index = enabled.findIndex((entry) => entry.id === item.id);
              const selected = index >= 0 && index === active.activeIndex;
              return <div key={item.id} id={index >= 0 ? active.getOptionId(index) : undefined} role="option"
                aria-selected={selected} aria-disabled={item.disabled || undefined}
                onPointerMove={() => active.setActiveIndex(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => { if (!item.disabled) onSelect(item); }}
                className={cn("flex min-h-11 cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-small outline-hidden sm:min-h-9 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground", selected && "bg-muted", item.disabled && "cursor-not-allowed text-disabled-foreground")}>
                {item.leading}<span className="min-w-0 break-words"><span>{highlightMatch(item.label, query)}</span>{item.description ? <span className="block text-xs text-muted-foreground">{highlightMatch(item.description, query)}</span> : null}</span>
              </div>;
            })}
          </div> : null)}
        </div>
        <div id={statusId} role="status" aria-live="polite">
          {loading ? <p className="px-2.5 py-3 text-small text-muted-foreground">Searching…</p> : error ?
            <EmptyState size="inline" titleAs="p" title="Couldn’t load results" description={error} actions={onRetry ? <Button size="sm" variant="secondary" onClick={() => { onRetry?.(); inputRef.current?.focus(); }}>Try again</Button> : undefined} /> :
            items.length === 0 ? <EmptyState size="inline" titleAs="p" title="No results" description="Try another name or search term." /> :
            <span className="sr-only">{enabled.length} results. Use arrow keys to browse and Enter to select.</span>}
        </div>
      </PopoverContent>
    </Popover>
  );
}
