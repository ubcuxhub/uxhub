"use client";

import { CircleAlert } from "lucide-react";
import { useId } from "react";
import { DateField, DateTimeFieldPair, TimeField } from "@/components/ui/date-time-field";
import { Field, FieldLabel, FieldError } from "@/components/ui/field";
import type { IsoDate, WallTime } from "@/lib/date-input";

/** Pacific wall-clock parts, validated as a complete instant by the caller. */
export function PublicationPicker({ value, disabled, onChange, error }: { value: string; disabled: boolean; error?: string | null; onChange: (value: string) => void }) {
  const uid = useId();
  const [date = "", time = ""] = value.split("T");
  const errorId = error ? `${uid}-error` : undefined;
  return <><DateTimeFieldPair timeWidth="wide" date={<Field><FieldLabel htmlFor={`${uid}-date`}>Date</FieldLabel><DateField aria-invalid={error ? true : undefined} aria-describedby={errorId} id={`${uid}-date`} disabled={disabled} value={(date || null) as IsoDate | null} onValueChange={next => onChange(`${next ?? ""}T${time}`)} /></Field>} time={<Field><FieldLabel htmlFor={`${uid}-time`}>Time (PT)</FieldLabel><TimeField aria-invalid={error ? true : undefined} aria-describedby={errorId} id={`${uid}-time`} disabled={disabled} ambiguousStart="daytime" value={(time || null) as WallTime | null} onValueChange={next => onChange(`${date}T${next ?? ""}`)} /></Field>} />{error && <FieldError id={errorId}><span className="flex items-start gap-1.5"><CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />{error}</span></FieldError>}</>;
}
