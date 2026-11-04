"use client";

import { useState } from "react";

import { DatePickerButton } from "../DatePickerButton";
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

interface RegistrationTimesProps {
  registration_opens_at: string;
  registration_closes_at: string;
  onFieldChange: <K extends keyof RegistrationTimesState>(
    field: K,
    value: RegistrationTimesState[K]
  ) => void;
}

export interface RegistrationTimesState {
  registration_opens_at: string;
  registration_closes_at: string;
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
            <DatePickerButton
              id={`${id}_date`}
              label={selectedDate ? dateFormatter.format(selectedDate) : undefined}
            />
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={selectedDate}
              defaultMonth={selectedDate}
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
      {value && (
        <Button type="button" variant="ghost" className="w-fit" onClick={() => onChange("")}>
          Clear {label.toLowerCase()}
        </Button>
      )}
    </Field>
  );
};

export const RegistrationTimes = ({
  registration_opens_at,
  registration_closes_at,
  onFieldChange,
}: RegistrationTimesProps) => {
  const { date: startDateString } = splitDateTimeLocal(
    registration_opens_at
  );
  const { date: endDateString } = splitDateTimeLocal(registration_closes_at);
  const startDate = dateStringToDate(startDateString);
  const minEndTime = isSameDate(startDateString, endDateString)
    ? splitDateTimeLocal(registration_opens_at).time
    : undefined;
  const hasInvalidRange = isDateTimeRangeInvalid(
    registration_opens_at,
    registration_closes_at
  );

  return (
    <FieldGroup className="grid gap-4 md:grid-cols-2">
      <RegistrationDateTimeField
        id="registration_opens_at"
        label="Registration Opens"
        value={registration_opens_at}
        onChange={(value) => onFieldChange("registration_opens_at", value)}
      />
      <RegistrationDateTimeField
        id="registration_closes_at"
        label="Registration Closes"
        value={registration_closes_at}
        minDate={startDate}
        minTime={minEndTime}
        onChange={(value) => onFieldChange("registration_closes_at", value)}
      />
      {hasInvalidRange && (
        <FieldError className="md:col-span-2">
          Registration end time must be after the start time.
        </FieldError>
      )}
    </FieldGroup>
  );
};

