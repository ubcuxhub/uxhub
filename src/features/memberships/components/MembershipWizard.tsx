"use client";

import { useReducer } from "react";
import { useRouter } from "next/navigation";
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
import { useUser } from "@/context/UserContext";
import { FACULTIES } from "@/lib/constants";
import type { UserType } from "@/types/models";
import { updateEligibilityProfileAction } from "@/features/memberships/actions";
import {
  validateFacultyEmail,
  validateStudentNumber,
} from "../lib/validation";

type WizardStep = 1 | 2;

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

// Format-validators keyed by user type; types with no identifier (e.g. nonUbc)
// have no entry and are treated as always valid.
const VALIDATORS: Partial<Record<UserType, (value: string) => string | null>> = {
  ubcStudent: validateStudentNumber,
  faculty: validateFacultyEmail,
};

interface WizardState {
  step: WizardStep;
  selection: UserType | null;
  identifier: string;
  faculty: string;
  error: string | null;
  saving: boolean;
}

const initialState: WizardState = {
  step: 1,
  selection: null,
  identifier: "",
  faculty: "",
  error: null,
  saving: false,
};

type WizardAction =
  | { type: "reset" }
  | { type: "select"; value: UserType }
  | { type: "goToStep"; step: WizardStep }
  | { type: "setIdentifier"; value: string }
  | { type: "setFaculty"; value: string }
  | { type: "setError"; value: string | null }
  | { type: "setSaving"; value: boolean };

function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case "reset":
      return initialState;
    case "select":
      return { ...state, selection: action.value, error: null };
    case "goToStep":
      return { ...state, step: action.step, error: null };
    case "setIdentifier":
      return { ...state, identifier: action.value, error: null };
    case "setFaculty":
      return { ...state, faculty: action.value };
    case "setError":
      return { ...state, error: action.value };
    case "setSaving":
      return { ...state, saving: action.value };
  }
}

export default function MembershipWizard() {
  const { user, refreshUser } = useUser();
  const router = useRouter();
  const [state, dispatch] = useReducer(wizardReducer, initialState);
  const { step, selection, identifier, faculty, error, saving } = state;

  const handleContinue = () => {
    if (!selection) {
      dispatch({ type: "setError", value: "Please choose an option to continue." });
      return;
    }
    // Non-UBC needs no identifier, so finish straight away.
    if (selection === "nonUbc") {
      void handleFinish();
      return;
    }
    dispatch({ type: "goToStep", step: 2 });
  };

  const handleFinish = async () => {
    if (!user || !selection) return;

    const validationError = VALIDATORS[selection]?.(identifier) ?? null;
    if (validationError) {
      dispatch({ type: "setError", value: validationError });
      return;
    }

    dispatch({ type: "setSaving", value: true });
    try {
      await updateEligibilityProfileAction({
        userType: selection,
        studentNumber: selection === "ubcStudent" ? identifier : null,
        faculty: selection === "faculty" ? faculty || null : null,
        facultyEmail: selection === "faculty" ? identifier : null,
      });
      await refreshUser();
      router.push("/portal/membership");
    } catch (err) {
      console.error("Error saving membership details:", err);
      dispatch({
        type: "setError",
        value: "Something went wrong saving your details. Please try again.",
      });
    } finally {
      dispatch({ type: "setSaving", value: false });
    }
  };

  const isFaculty = selection === "faculty";

  return step === 1 ? (
    <UserTypeStep
      selection={selection}
      error={error}
      saving={saving}
      onSelect={(value) => dispatch({ type: "select", value })}
      onContinue={handleContinue}
    />
  ) : (
    <VerifyIdentifierStep
      isFaculty={isFaculty}
      identifier={identifier}
      faculty={faculty}
      error={error}
      saving={saving}
      onIdentifierChange={(value) => dispatch({ type: "setIdentifier", value })}
      onFacultyChange={(value) => dispatch({ type: "setFaculty", value })}
      onBack={() => dispatch({ type: "goToStep", step: 1 })}
      onFinish={handleFinish}
    />
  );
}

function OptionCard({
  title,
  description,
  selected,
  onClick,
}: {
  title: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-lg border p-4 text-left transition-colors hover:bg-accent",
        selected && "border-primary ring-1 ring-primary bg-primary/5",
      )}
    >
      <div className="font-medium">{title}</div>
      <div className="text-sm text-muted-foreground">{description}</div>
    </button>
  );
}

function UserTypeStep({
  selection,
  error,
  saving,
  onSelect,
  onContinue,
}: {
  selection: UserType | null;
  error: string | null;
  saving: boolean;
  onSelect: (value: UserType) => void;
  onContinue: () => void;
}) {
  return (
    <div className="grid gap-4">
      <div className="flex flex-col space-y-1.5">
        <h1 className="text-lg font-semibold leading-none tracking-tight">
          What best describes you?
        </h1>
        <p className="text-sm text-muted-foreground">
          This helps us show you the right membership options.
        </p>
      </div>

      <div className="grid gap-3 py-2">
        {OPTIONS.map((option) => (
          <OptionCard
            key={option.value}
            title={option.title}
            description={option.description}
            selected={selection === option.value}
            onClick={() => onSelect(option.value)}
          />
        ))}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2">
        <Button onClick={onContinue} disabled={saving}>
          {selection === "nonUbc" ? "Finish" : "Next"}
        </Button>
      </div>
    </div>
  );
}

function VerifyIdentifierStep({
  isFaculty,
  identifier,
  faculty,
  error,
  saving,
  onIdentifierChange,
  onFacultyChange,
  onBack,
  onFinish,
}: {
  isFaculty: boolean;
  identifier: string;
  faculty: string;
  error: string | null;
  saving: boolean;
  onIdentifierChange: (value: string) => void;
  onFacultyChange: (value: string) => void;
  onBack: () => void;
  onFinish: () => void;
}) {
  return (
    <div className="grid gap-4">
      <div className="flex flex-col space-y-1.5">
        <h1 className="text-lg font-semibold leading-none tracking-tight">
          {isFaculty ? "Verify your faculty email" : "Verify your student number"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isFaculty
            ? "Enter your UBC faculty email to confirm your identity."
            : "Enter your 8-digit UBC student number to confirm your identity."}
        </p>
      </div>

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
            onChange={(e) => onIdentifierChange(e.target.value)}
            placeholder={isFaculty ? "name@ubc.ca" : "12345678"}
            autoFocus
          />
        </div>

        {isFaculty && (
          <div className="space-y-2">
            <Label>Faculty (optional)</Label>
            <Select value={faculty} onValueChange={onFacultyChange}>
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

      <div className="flex flex-col-reverse sm:flex-row sm:justify-between sm:space-x-2">
        <Button variant="outline" onClick={onBack} disabled={saving}>
          Back
        </Button>
        <Button onClick={onFinish} disabled={saving}>
          {saving ? "Saving..." : "Finish"}
        </Button>
      </div>
    </div>
  );
}
