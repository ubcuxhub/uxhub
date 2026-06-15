"use client";

import { useState } from "react";
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

interface RegistrationTimesProps {
  registration_start_time: string;
  registration_end_time: string;
  onFieldChange: <K extends keyof RegistrationTimesState>(
    field: K,
    value: RegistrationTimesState[K]
  ) => void;
}

export interface RegistrationTimesState {
  registration_start_time: string;
  registration_end_time: string;
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

const isSameDate = (left: string, right: string) =>
  Boolean(left && right && left === right);

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

const isDateTimeRangeInvalid = (start: string, end: string) => {
  if (!start || !end) return false;

  return new Date(start) >= new Date(end);
};

const RegistrationDateTimeField = ({
  id,
  label,
  value,
  minDate,
  minTime,
  onChange,
}: {
  id: keyof RegistrationTimesState;
  label: string;
  value: string;
  minDate?: Date;
  minTime?: string;
  onChange: (value: string) => void;
}) => {
  const [open, setOpen] = useState(false);
  const { date, time } = splitDateTimeLocal(value);
  const selectedDate = dateStringToDate(date);

  return (
    <Field>
      <FieldLabel htmlFor={`${id}_date`}>{label}</FieldLabel>
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
              disabled={minDate ? { before: minDate } : undefined}
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
          min={minTime}
          onChange={(event) =>
            onChange(combineDateTimeLocal(date, event.target.value))
          }
          aria-label={`${label} time`}
          className="sm:w-32"
        />
      </div>
    </Field>
  );
};

export const RegistrationTimes = ({
  registration_start_time,
  registration_end_time,
  onFieldChange,
}: RegistrationTimesProps) => {
  const { date: startDateString } = splitDateTimeLocal(
    registration_start_time
  );
  const { date: endDateString } = splitDateTimeLocal(registration_end_time);
  const startDate = dateStringToDate(startDateString);
  const minEndTime = isSameDate(startDateString, endDateString)
    ? splitDateTimeLocal(registration_start_time).time
    : undefined;
  const hasInvalidRange = isDateTimeRangeInvalid(
    registration_start_time,
    registration_end_time
  );

  return (
    <FieldGroup className="grid gap-4 md:grid-cols-2">
      <RegistrationDateTimeField
        id="registration_start_time"
        label="Registration Start Time"
        value={registration_start_time}
        onChange={(value) => onFieldChange("registration_start_time", value)}
      />
      <RegistrationDateTimeField
        id="registration_end_time"
        label="Registration End Time"
        value={registration_end_time}
        minDate={startDate}
        minTime={minEndTime}
        onChange={(value) => onFieldChange("registration_end_time", value)}
      />
      {hasInvalidRange && (
        <FieldError className="md:col-span-2">
          Registration end time must be after the start time.
        </FieldError>
      )}
    </FieldGroup>
  );
};

