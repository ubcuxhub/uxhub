"use client";

import { useState } from "react";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface PublicationPickerProps {
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}

// Calendar dates are wall-clock date parts, never instants converted via UTC.
export function PublicationPicker({ value, disabled, onChange }: PublicationPickerProps) {
  const [open, setOpen] = useState(false);
  const [date = "", time = ""] = value.split("T");
  const parts = date.split("-").map(Number);
  const selected = date ? new Date(parts[0], parts[1] - 1, parts[2]) : undefined;

  return (
    <Field>
      <FieldLabel htmlFor="publish_date">Publish Date &amp; Time (Pacific)</FieldLabel>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <Popover open={open && !disabled} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              id="publish_date"
              type="button"
              variant="outline"
              disabled={disabled}
              aria-describedby="publish_at_description"
              className={cn("justify-start font-normal", !date && "text-muted-foreground")}
            >
              <CalendarIcon data-icon="inline-start" />
              {selected ? selected.toLocaleDateString("en-CA", { dateStyle: "medium" }) : "Pick a date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={selected}
              defaultMonth={selected}
              onSelect={(day) => {
                if (!day) return;
                const next = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
                onChange(`${next}T${time}`);
                setOpen(false);
              }}
            />
          </PopoverContent>
        </Popover>
        <Input
          type="time"
          aria-label="Publish time (Pacific)"
          aria-describedby="publish_at_description"
          disabled={disabled}
          value={time}
          onChange={(event) => onChange(`${date}T${event.target.value}`)}
        />
      </div>
      {value && (
        <Button type="button" variant="ghost" className="w-fit" disabled={disabled} onClick={() => onChange("")}>
          Clear publish schedule
        </Button>
      )}
      <FieldDescription id="publish_at_description">
        Draft events become Active at this time. Leave empty to keep in Draft.
      </FieldDescription>
    </Field>
  );
}
