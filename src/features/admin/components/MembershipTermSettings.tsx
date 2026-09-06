"use client";

import { useState } from "react";
import { CalendarIcon, TriangleAlert } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatEventDate, timestamptzToDatetimeLocal } from "@/lib/date";
import { cn } from "@/lib/utils";
import { setMembershipTermEndsAtAction } from "@/features/admin/actions";

/** `YYYY-MM-DD` in Pacific time, the shape the server action expects. */
function toDateInputValue(value: string | null) {
  if (!value) return "";
  return timestamptzToDatetimeLocal(value).slice(0, 10);
}

// Same local-date conversions the admin event form uses, so the calendar never
// round-trips through UTC and lands a day off.
function dateStringToDate(value: string) {
  if (!value) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day);
}

function dateToDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function MembershipTermSettings({
  termEndsAt,
}: {
  termEndsAt: string | null;
}) {
  const [saved, setSaved] = useState(termEndsAt);
  const [draft, setDraft] = useState(() => toDateInputValue(termEndsAt));
  const [confirming, setConfirming] = useState<"save" | "clear" | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const savedDate = toDateInputValue(saved);
  const dirty = draft !== savedDate;

  const commit = async (value: string | null) => {
    setPending(true);
    setError(null);
    try {
      const next = await setMembershipTermEndsAtAction(value);
      setSaved(next);
      setDraft(toDateInputValue(next));
      setConfirming(null);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not save the date.",
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Membership term end</CardTitle>
        <CardDescription>
          Every membership expires on this date, no matter when it was bought.
          New memberships are cut short to match it, and once the date passes no
          new memberships can be purchased. Leave it empty to give each
          membership a full year from its purchase date.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        <Alert icon={<TriangleAlert className="size-4" />}>
          <AlertTitle>This applies to every account.</AlertTitle>
          <AlertDescription>
            Setting a date in the past ends every active membership immediately,
            including admin accounts. Clearing the date restores them.
          </AlertDescription>
        </Alert>

        <div className="max-w-xs space-y-2">
          <Label htmlFor="membership-term-end">Term ends</Label>
          <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
            <PopoverTrigger asChild>
              <Button
                id="membership-term-end"
                type="button"
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !draft && "text-muted-foreground",
                )}
              >
                <CalendarIcon data-icon="inline-start" />
                {formatEventDate(draft) ?? "Pick a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateStringToDate(draft)}
                onSelect={(date) => {
                  if (!date) return;
                  setDraft(dateToDateString(date));
                  setPickerOpen(false);
                }}
              />
            </PopoverContent>
          </Popover>
          <p className="text-small text-muted-foreground">
            {saved
              ? `Currently ending ${formatEventDate(saved, { month: "short" })}, end of day Pacific.`
              : "No term end is set. Memberships last one year from purchase."}
          </p>
        </div>

        <div className="flex gap-3">
          <Button
            disabled={!draft || !dirty || pending}
            onClick={() => setConfirming("save")}
          >
            Save date
          </Button>
          <Button
            variant="outline"
            disabled={!saved || pending}
            onClick={() => setConfirming("clear")}
          >
            Clear
          </Button>
        </div>
      </CardContent>

      <ConfirmDialog
        open={confirming !== null}
        onOpenChange={(next) => {
          if (next) return;
          setConfirming(null);
          setError(null);
        }}
        icon={<TriangleAlert className="size-4" />}
        title={
          confirming === "clear"
            ? "Clear the membership term end?"
            : "End every membership on this date?"
        }
        description={
          confirming === "clear"
            ? "Every membership goes back to expiring one year after it was purchased, and memberships go back on sale."
            : `Every membership will expire on ${formatEventDate(draft)}, including admin accounts. Members whose access ends on that date lose it as soon as it passes.`
        }
        // Clearing the date only ever restores access, so it needs no challenge.
        confirmation={
          confirming === "save"
            ? {
                label: "Confirm the date",
                hint: (
                  <>
                    Type{" "}
                    <span className="font-medium text-foreground">{draft}</span>{" "}
                    to confirm.
                  </>
                ),
                placeholder: "YYYY-MM-DD",
                matches: (value) => value.trim() === draft,
                mismatchMessage: "The date does not match.",
              }
            : undefined
        }
        confirmLabel={confirming === "clear" ? "Clear date" : "Confirm"}
        pendingLabel="Saving…"
        confirmVariant={confirming === "clear" ? "default" : "destructive"}
        error={error}
        pending={pending}
        onConfirm={() => commit(confirming === "clear" ? null : draft)}
      />

    </Card>
  );
}
