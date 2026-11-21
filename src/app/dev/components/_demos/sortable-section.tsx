"use client";
import { useState } from "react";
import { SortableSection } from "@/components/shared/SortableSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
export default function SortableSectionDemo() {
  const [items, setItems] = useState(["Judges", "Mentors", "Sponsors"]);
  const [open, setOpen] = useState<string[]>(["Judges"]);
  const [message, setMessage] = useState("");
  const move = (from: number, to: number) => { const next = [...items]; const [item] = next.splice(from, 1); next.splice(to, 0, item); setItems(next); setMessage(`${item} moved to ${to + 1} of ${items.length}`); };
  return <div className="w-full space-y-4"><p>Drag over the upper or lower half of any card to insert before or after it. The horizontal bar previews the drop. Focus a drag handle and use the Up and Down arrow keys for keyboard reordering.</p><Button variant="outline" onClick={() => setOpen([])}>Collapse all</Button><p role="status">{message}</p>{items.map((title, index) => <SortableSection key={title} dragType="text/plain" title={title} countLabel="1 item" index={index} count={items.length} open={open.includes(title)} onOpenChange={expanded => setOpen(current => expanded ? [...current, title] : current.filter(item => item !== title))} onMove={to => move(index, to)} onDragStart={event => event.dataTransfer.setData("text/plain", title)} onDrop={(event, placement) => { const from = items.indexOf(event.dataTransfer.getData("text/plain")); const insertion = index + (placement === "after" ? 1 : 0); if (from >= 0) move(from, insertion - (from < insertion ? 1 : 0)); }}><Field><FieldLabel htmlFor={`demo-${title}`}>Name</FieldLabel><Input id={`demo-${title}`} defaultValue="Alex Chen" /></Field></SortableSection>)}</div>;
}
