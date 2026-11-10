"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { withReturnTo } from "@/lib/auth/paths";
import type { UserType } from "@/lib/supabase/models";
import {
  userTypeToAudience,
  type MembershipAudience,
} from "@/features/memberships/lib/policy";

const OPTIONS: Array<{
  audience: MembershipAudience;
  title: string;
  description: string;
}> = [
  {
    audience: "student",
    title: "I’m a UBC student",
    description: "Currently enrolled at The University of British Columbia.",
  },
  {
    audience: "faculty",
    title: "I’m a UBC faculty member",
    description: "Faculty or staff at The University of British Columbia.",
  },
  {
    audience: "non-ubc",
    title: "I’m not from UBC",
    description: "Joining from outside The University of British Columbia.",
  },
];

export function MembershipClassification({
  initialUserType,
  returnTo,
}: {
  initialUserType: UserType;
  returnTo?: string;
}) {
  const router = useRouter();
  const uid = useId();
  const headingId = `${uid}-heading`;
  const [selection, setSelection] = useState<MembershipAudience>(
    userTypeToAudience(initialUserType),
  );

  const continueToDetails = () => {
    router.replace(
      withReturnTo(
        `/portal/membership/join/${selection}`,
        returnTo ?? "/portal",
      ),
    );
  };

  return (
    <div className="flex min-h-full flex-col">
      <div>
        <h1 id={headingId} className="text-h2">
          What best describes you?
        </h1>
        <p className="mt-2 text-small text-muted-foreground">
          This helps us show you the right membership options.
        </p>
      </div>

      <RadioGroup
        aria-labelledby={headingId}
        value={selection}
        onValueChange={(value) => setSelection(value as MembershipAudience)}
        className="mt-8 gap-4"
      >
        {OPTIONS.map((option) => (
          <FieldLabel
            key={option.audience}
            htmlFor={`${uid}-${option.audience}`}
          >
            <Field orientation="horizontal">
              <FieldContent>
                <FieldTitle>{option.title}</FieldTitle>
                <FieldDescription>{option.description}</FieldDescription>
              </FieldContent>
              <RadioGroupItem
                value={option.audience}
                id={`${uid}-${option.audience}`}
              />
            </Field>
          </FieldLabel>
        ))}
      </RadioGroup>

      <div className="mt-auto flex justify-end pt-8">
        <Button onClick={continueToDetails}>Next</Button>
      </div>
    </div>
  );
}
