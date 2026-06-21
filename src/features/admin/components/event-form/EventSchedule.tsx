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
  start_date: string;
  start_time: string;
  end_date: string;
  end_time: string;
  onFieldChange: <K extends keyof EventScheduleState>(
    field: K,
    value: EventScheduleState[K]
  ) => void;
}

export interface EventScheduleState {
  start_date: string;
  start_time: string;
  end_date: string;
  end_time: string;
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

const isSameDate = (left: string, right: string) =>
  Boolean(left && right && left === right);

const dateToDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const isScheduleRangeInvalid = ({
  start_date,
  start_time,
  end_date,
  end_time,
}: EventScheduleState) => {
  if (!start_date || !start_time || !end_date || !end_time) return false;

  return (
    new Date(`${start_date}T${start_time}`) >=
    new Date(`${end_date}T${end_time}`)
  );
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
  start_date,
  start_time,
  end_date,
  end_time,
  onFieldChange,
}: EventScheduleProps) => {
  const startDate = dateStringToDate(start_date);
  const endTimeMin = isSameDate(start_date, end_date) ? start_time : undefined;
  const hasInvalidRange = isScheduleRangeInvalid({
    start_date,
    start_time,
    end_date,
    end_time,
  });

  return (
    <FieldGroup className="grid gap-4 md:grid-cols-2">
      <Field>
        <FieldLabel htmlFor="start_date">Start Date</FieldLabel>
        <DatePickerButton
          id="start_date"
          value={start_date}
          placeholder="Pick a start date"
          onChange={(value) => onFieldChange("start_date", value)}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="start_time">Start Time</FieldLabel>
        <Input
          id="start_time"
          type="time"
          value={start_time}
          onChange={(e) => onFieldChange("start_time", e.target.value)}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="end_date">End Date</FieldLabel>
        <DatePickerButton
          id="end_date"
          value={end_date}
          placeholder="Pick an end date"
          disabled={startDate ? { before: startDate } : undefined}
          onChange={(value) => onFieldChange("end_date", value)}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="end_time">End Time</FieldLabel>
        <Input
          id="end_time"
          type="time"
          value={end_time}
          min={endTimeMin}
          onChange={(e) => onFieldChange("end_time", e.target.value)}
        />
        {hasInvalidRange && (
          <FieldError>Event end time must be after the start time.</FieldError>
        )}
      </Field>
    </FieldGroup>
  );
};

