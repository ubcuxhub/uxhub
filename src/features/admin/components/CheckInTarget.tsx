"use client";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import type { CheckInItem } from "@/features/admin/lib/item-check-in";
import { formatEventDate, formatEventTime } from "@/lib/date";

export function checkInItemContext(item: CheckInItem) {
  if (!item.starts_at || !item.ends_at)
    return "Time not set";
  const startDate = formatEventDate(item.starts_at, { month: "short" });
  const endDate = formatEventDate(item.ends_at, { month: "short" });
  return `${startDate} · ${formatEventTime(item.starts_at)} – ${endDate !== startDate ? `${endDate} · ` : ""}${formatEventTime(item.ends_at)} PT`;
}
export function CheckInTarget({ items, itemId, onChange, disabled = false }: { items: CheckInItem[]; itemId: string | null; onChange: (id: string) => void; disabled?: boolean }) {
  return <Select value={itemId ?? ""} onValueChange={onChange} disabled={disabled}>
    <SelectTrigger multiline aria-label="Check-in item">
      <SelectValue placeholder="Select a check-in item" />
    </SelectTrigger>
    <SelectContent>{items.map(item => <SelectItem key={item.id} value={item.id} textValue={item.label} description={checkInItemContext(item)}>{item.label}</SelectItem>)}</SelectContent>
  </Select>;
}
