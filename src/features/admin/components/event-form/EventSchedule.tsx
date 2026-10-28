"use client";

import { useState, type ComponentProps } from "react";
import { CalendarIcon } from "lucide-react";

import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface EventScheduleProps {
  starts_at: string;
  ends_at: string;
  onFieldChange: <K extends keyof EventScheduleState>(
    field: K,
    value: EventScheduleState[K]
  ) => void;
}

/** Pacific wall-clock `YYYY-MM-DDTHH:mm` values, edited as a date and a time. */
export interface EventScheduleState {
  starts_at: string;
  ends_at: string;
}

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
});

const dateStringToDate = (value: string) => {
  if (!value) return undefined;

  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) return undefined;

  return new Date(year, month - 1, day);
};

const splitDateTimeLocal = (value: string) => {
  const [date = "", time = ""] = value.split("T");

  return { date, time };
};

const combineDateTimeLocal = (date: string, time: string) => {
  if (!date && !time) return "";

  return `${date}T${time}`;
};

const isSameDate = (left: string, right: string) =>
  Boolean(left && right && left === right);

const dateToDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const DatePickerButton = ({
  id,
  value,
  placeholder,
  disabled,
  onChange,
}: {
  id: string;
  value: string;
  placeholder: string;
  disabled?: ComponentProps<typeof Calendar>["disabled"];
  onChange: (value: string) => void;
}) => {
  const [open, setOpen] = useState(false);
  const selectedDate = dateStringToDate(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !selectedDate && "text-muted-foreground"
          )}
        >
          <CalendarIcon data-icon="inline-start" />
          {selectedDate ? dateFormatter.format(selectedDate) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          defaultMonth={selectedDate}
          disabled={disabled}
          onSelect={(date) => {
            if (!date) return;

            onChange(dateToDateString(date));
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
};

export const EventSchedule = ({
  starts_at,
  ends_at,
  onFieldChange,
}: EventScheduleProps) => {
  const start = splitDateTimeLocal(starts_at);
  const end = splitDateTimeLocal(ends_at);
  const startDate = dateStringToDate(start.date);
  const endTimeMin = isSameDate(start.date, end.date) ? start.time : undefined;
  const hasInvalidRange = Boolean(
    start.date &&
      start.time &&
      end.date &&
      end.time &&
      new Date(starts_at) >= new Date(ends_at)
  );

  return (
    <FieldGroup className="grid gap-4 md:grid-cols-2">
      <Field>
        <FieldLabel htmlFor="starts_at_date">Start Date <span className="text-destructive">*</span></FieldLabel>
        <DatePickerButton
          id="starts_at_date"
          value={start.date}
          placeholder="Pick a start date"
          onChange={(value) =>
            onFieldChange("starts_at", combineDateTimeLocal(value, start.time))
          }
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="starts_at_time">Start Time <span className="text-destructive">*</span></FieldLabel>
        <Input
          id="starts_at_time"
          type="time"
          required
          value={start.time}
          onChange={(e) =>
            onFieldChange(
              "starts_at",
              combineDateTimeLocal(start.date, e.target.value)
            )
          }
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="ends_at_date">End Date <span className="text-destructive">*</span></FieldLabel>
        <DatePickerButton
          id="ends_at_date"
          value={end.date}
          placeholder="Pick an end date"
          disabled={startDate ? { before: startDate } : undefined}
          onChange={(value) =>
            onFieldChange("ends_at", combineDateTimeLocal(value, end.time))
          }
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="ends_at_time">End Time <span className="text-destructive">*</span></FieldLabel>
        <Input
          id="ends_at_time"
          type="time"
          required
          value={end.time}
          min={endTimeMin}
          onChange={(e) =>
            onFieldChange(
              "ends_at",
              combineDateTimeLocal(end.date, e.target.value)
            )
          }
        />
        {hasInvalidRange && (
          <FieldError>Event end time must be after the start time.</FieldError>
        )}
      </Field>
    </FieldGroup>
  );
};
