"use client";

import { useState } from "react";
import { CalendarIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { CheckInSessionDraft } from "../../types/checkInTypes";

interface CheckInEventsSectionProps {
  checkInEvents: CheckInSessionDraft[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onUpdate: (
    index: number,
    field: keyof CheckInSessionDraft,
    value: string
  ) => void;
}

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
});

const splitDateTimeLocal = (value: string) => {
  const [date = "", time = ""] = value.split("T");

  return {
    date,
    time,
  };
};

const dateStringToDate = (value: string) => {
  if (!value) return undefined;

  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) return undefined;

  return new Date(year, month - 1, day);
};

const dateToDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const combineDateTimeLocal = (date: string, time: string) => {
  if (!date && !time) return "";

  return `${date}T${time}`;
};

const CheckInDateTimeField = ({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) => {
  const [open, setOpen] = useState(false);
  const { date, time } = splitDateTimeLocal(value);
  const selectedDate = dateStringToDate(date);

  return (
    <Field>
      <FieldLabel htmlFor={`${id}_date`}>
        {label} <span className="text-red-500">*</span>
      </FieldLabel>
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              id={`${id}_date`}
              type="button"
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal",
                !selectedDate && "text-muted-foreground"
              )}
            >
              <CalendarIcon data-icon="inline-start" />
              {selectedDate ? dateFormatter.format(selectedDate) : "Pick a date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(newDate) => {
                if (!newDate) return;

                onChange(combineDateTimeLocal(dateToDateString(newDate), time));
                setOpen(false);
              }}
            />
          </PopoverContent>
        </Popover>
        <Input
          id={`${id}_time`}
          type="time"
          value={time}
          onChange={(event) =>
            onChange(combineDateTimeLocal(date, event.target.value))
          }
          aria-label={`${label} time`}
          className="sm:w-32"
          required
        />
      </div>
    </Field>
  );
};

export const CheckInEventsSection = ({
  checkInEvents,
  onAdd,
  onRemove,
  onUpdate,
}: CheckInEventsSectionProps) => {
  return (
    <FieldSet>
      <div className="flex items-center justify-between">
        <div>
          <FieldLegend>Check-In Sessions</FieldLegend>
          <FieldDescription>
            Provide the check-in session details for attendees. Each entry must include
            a name, start time, and end time.
          </FieldDescription>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={onAdd}
          className="shrink-0"
        >
          Add
        </Button>
      </div>
      <FieldGroup className="gap-4">
        {checkInEvents.map((item, index) => (
          <FieldGroup
            key={`check-in-${index}`}
            className="grid gap-3 rounded-lg border p-4"
          >
            <Field>
              <FieldLabel htmlFor={`check_name_${index}`}>
                Name <span className="text-red-500">*</span>
              </FieldLabel>
              <Input
                id={`check_name_${index}`}
                value={item.name}
                onChange={(e) => onUpdate(index, "name", e.target.value)}
                required
              />
            </Field>
            <div className="grid gap-3 md:grid-cols-2">
              <CheckInDateTimeField
                id={`check_start_time_${index}`}
                label="Start Time"
                value={item.start_time}
                onChange={(value) => onUpdate(index, "start_time", value)}
              />
              <CheckInDateTimeField
                id={`check_end_time_${index}`}
                label="End Time"
                value={item.end_time}
                onChange={(value) => onUpdate(index, "end_time", value)}
              />
            </div>
            <div className="flex justify-end">
              <Button
                type="button"
                variant="ghost"
                className="text-red-500 hover:text-red-600"
                onClick={() => onRemove(index)}
                disabled={checkInEvents.length === 1}
              >
                Remove
              </Button>
            </div>
          </FieldGroup>
        ))}
      </FieldGroup>
    </FieldSet>
  );
};
