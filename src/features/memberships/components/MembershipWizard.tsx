"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { updateUserInfoById } from "@/lib/supabase-helpers/users";
import { useUser } from "@/context/UserContext";
import { FACULTIES } from "@/lib/constants";
import type { UserInfoUpdate, UserType } from "@/types/models";
import {
  validateFacultyEmail,
  validateStudentNumber,
} from "../lib/validation";

const supabase = createClient();

const OPTIONS: Array<{
  value: UserType;
  title: string;
  description: string;
}> = [
  {
    value: "ubcStudent",
    title: "I'm a UBC student",
    description: "Currently enrolled at UBC.",
  },
  {
    value: "faculty",
    title: "I'm UBC faculty",
    description: "Faculty or staff at UBC.",
  },
  {
    value: "nonUbc",
    title: "I'm not from UBC",
    description: "Joining from outside UBC.",
  },
];

interface MembershipWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function MembershipWizard({
  open,
  onOpenChange,
}: MembershipWizardProps) {
  const { user, refreshUser } = useUser();
  const router = useRouter();

  const [step, setStep] = useState<1 | 2>(1);
  const [selection, setSelection] = useState<UserType | null>(null);
  const [identifier, setIdentifier] = useState("");
  const [faculty, setFaculty] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Reset to a clean state every time the wizard opens.
  useEffect(() => {
    if (open) {
      setStep(1);
      setSelection(null);
      setIdentifier("");
      setFaculty("");
      setError(null);
      setSaving(false);
    }
  }, [open]);

  const handleSelect = (value: UserType) => {
    setSelection(value);
    setError(null);
  };

  const handleContinue = () => {
    if (!selection) {
      setError("Please choose an option to continue.");
      return;
    }
    // Non-UBC needs no identifier, so finish straight away.
    if (selection === "nonUbc") {
      void handleFinish();
      return;
    }
    setError(null);
    setStep(2);
  };

  const handleFinish = async () => {
    if (!user || !selection) return;

    if (selection === "ubcStudent") {
      const validationError = validateStudentNumber(identifier);
      if (validationError) {
        setError(validationError);
        return;
      }
    } else if (selection === "faculty") {
      const validationError = validateFacultyEmail(identifier);
      if (validationError) {
        setError(validationError);
        return;
      }
    }

    setError(null);
    setSaving(true);
    try {
      const payload: UserInfoUpdate = {
        user_type: selection,
        student_number:
          selection === "ubcStudent" ? parseInt(identifier.trim(), 10) : null,
        faculty: selection === "faculty" ? faculty || null : null,
      };

      await updateUserInfoById(supabase, user.id, payload);
      await refreshUser();
      onOpenChange(false);
      router.push("/portal/membership");
    } catch (err) {
      console.error("Error saving membership details:", err);
      setError("Something went wrong saving your details. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const isFaculty = selection === "faculty";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {step === 1 ? (
          <>
            <DialogHeader>
              <DialogTitle>What best describes you?</DialogTitle>
              <DialogDescription>
                This helps us show you the right membership options.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-3 py-2">
              {OPTIONS.map((option) => {
                const isSelected = selection === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleSelect(option.value)}
                    className={cn(
                      "rounded-lg border p-4 text-left transition-colors hover:bg-accent",
                      isSelected &&
                        "border-primary ring-1 ring-primary bg-primary/5",
                    )}
                  >
                    <div className="font-medium">{option.title}</div>
                    <div className="text-sm text-muted-foreground">
                      {option.description}
                    </div>
                  </button>
                );
              })}
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <DialogFooter>
              <Button onClick={handleContinue} disabled={saving}>
                {selection === "nonUbc" ? "Finish" : "Next"}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>
                {isFaculty ? "Verify your faculty email" : "Verify your student number"}
              </DialogTitle>
              <DialogDescription>
                {isFaculty
                  ? "Enter your UBC faculty email to confirm your identity."
                  : "Enter your 8-digit UBC student number to confirm your identity."}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="membership-identifier">
                  {isFaculty ? "UBC faculty email" : "UBC student number"}
                </Label>
                <Input
                  id="membership-identifier"
                  type={isFaculty ? "email" : "text"}
                  inputMode={isFaculty ? "email" : "numeric"}
                  value={identifier}
                  onChange={(e) => {
                    setIdentifier(e.target.value);
                    setError(null);
                  }}
                  placeholder={isFaculty ? "name@ubc.ca" : "12345678"}
                  autoFocus
                />
              </div>

              {isFaculty && (
                <div className="space-y-2">
                  <Label>Faculty (optional)</Label>
                  <Select value={faculty} onValueChange={setFaculty}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a faculty" />
                    </SelectTrigger>
                    <SelectContent>
                      {FACULTIES.map((item) => (
                        <SelectItem key={item} value={item}>
                          {item}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>

            <DialogFooter className="sm:justify-between">
              <Button
                variant="outline"
                onClick={() => {
                  setError(null);
                  setStep(1);
                }}
                disabled={saving}
              >
                Back
              </Button>
              <Button onClick={handleFinish} disabled={saving}>
                {saving ? "Saving..." : "Finish"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
