"use client";

import { useEffect, useId, useState, type DragEvent, type ReactNode } from "react";
import { ChevronDown, ChevronRight, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

/** A drag handle with equivalent keyboard movement, without arrow buttons. */
export function ReorderControls({ label, index, count, onMove, onDragStart, disabled = false }: {
  label: string; index: number; count: number; onMove: (to: number) => void;
  onDragStart?: (event: DragEvent<HTMLButtonElement>) => void; disabled?: boolean;
}) {
  const instructionsId = useId();
  return <div className="flex shrink-0 items-center">
    {onDragStart && <Button type="button" variant="ghost" size="icon" draggable={!disabled && count > 1} disabled={disabled || count < 2} onDragStart={onDragStart} aria-label={`Drag ${label} to reorder`} aria-describedby={instructionsId} aria-keyshortcuts="ArrowUp ArrowDown"
      onKeyDown={event => {
        if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
        event.preventDefault(); event.stopPropagation();
        const to = index + (event.key === "ArrowUp" ? -1 : 1);
        if (to >= 0 && to < count) onMove(to);
      }} className="min-h-11 min-w-11 cursor-grab active:cursor-grabbing"><GripVertical aria-hidden /></Button>}
    <span id={instructionsId} className="sr-only">Drag to reorder, or use the Up and Down arrow keys while this handle is focused.</span>
  </div>;
}

/** Controlled disclosure: ordering/actions remain available while collapsed. */
export function SortableSection({ title, countLabel, index, count, open, onOpenChange, onMove, onDragStart, onDrop, dragType, sectionId, actions, invalid = false, children }: {
  title: string; countLabel: string; index: number; count: number; open: boolean;
  onOpenChange: (open: boolean) => void; onMove: (to: number) => void;
  onDragStart: (event: DragEvent<HTMLButtonElement>) => void;
  onDrop: (event: DragEvent<HTMLDivElement>, placement: "before" | "after") => void;
  /** Only matching drag payloads activate the full-card drop target. */
  dragType?: string; sectionId?: string;
  actions?: ReactNode; invalid?: boolean; children: ReactNode;
}) {
  const id = useId();
  const [placement, setPlacement] = useState<"before" | "after" | null>(null);
  useEffect(() => {
    const clear = () => setPlacement(null);
    document.addEventListener("dragend", clear);
    document.addEventListener("drop", clear);
    return () => { document.removeEventListener("dragend", clear); document.removeEventListener("drop", clear); };
  }, []);
  const accepts = (event: DragEvent<HTMLDivElement>) => !dragType || Array.from(event.dataTransfer.types).includes(dragType);
  const position = (event: DragEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return event.clientY < bounds.top + bounds.height / 2 ? "before" : "after";
  };
  return <Card id={sectionId} tabIndex={sectionId ? -1 : undefined} className="relative min-w-0 scroll-mt-24 gap-0 py-0 focus-visible:outline-2 focus-visible:outline-ring"
    onDragOver={event => { if (!accepts(event)) return; event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = "move"; setPlacement(position(event)); }}
    onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPlacement(null); }}
    onDrop={event => { setPlacement(null); if (!accepts(event)) return; event.preventDefault(); event.stopPropagation(); onDrop(event, position(event)); }}>
    {placement && <div aria-hidden data-drop-indicator={placement} className={`pointer-events-none absolute inset-x-0 z-20 h-1 rounded-full bg-primary ${placement === "before" ? "-top-3" : "-bottom-3"}`} />}
    <CardHeader className="flex flex-row flex-wrap items-center gap-2 p-4">
      <ReorderControls label={title} index={index} count={count} onMove={onMove} onDragStart={onDragStart} />
      <span className="text-small text-muted-foreground">{index + 1}</span>
      <Button id={`${id}-trigger`} type="button" variant="ghost" className="h-auto min-h-11 min-w-0 flex-1 justify-start whitespace-normal text-left" aria-expanded={open} aria-controls={id} onClick={() => onOpenChange(!open)}>
        {open ? <ChevronDown aria-hidden /> : <ChevronRight aria-hidden />}<span className="min-w-0 break-words">{title}<span className="block text-small font-normal text-muted-foreground">{countLabel}{invalid ? " · Needs attention" : ""}</span></span>
      </Button>
      {actions}
    </CardHeader>
    <CardContent id={id} role="region" aria-labelledby={`${id}-trigger`} hidden={!open} className="min-w-0 border-t p-4">{children}</CardContent>
  </Card>;
}
