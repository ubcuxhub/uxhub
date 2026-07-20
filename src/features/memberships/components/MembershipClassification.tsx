"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { withReturnTo } from "@/lib/auth/paths";
import type { UserType } from "@/types/models";
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
        <h1 className="text-h2">What best describes you?</h1>
        <p className="mt-2 text-small text-muted-foreground">
          This helps us show you the right membership options.
        </p>
      </div>

      <div className="mt-8 grid gap-4">
        {OPTIONS.map((option) => (
          <button
            key={option.audience}
            type="button"
            onClick={() => setSelection(option.audience)}
            className={cn(
              "rounded-lg border p-5 text-left transition-colors hover:bg-accent",
              selection === option.audience &&
                "border-primary bg-primary/5 ring-1 ring-primary",
            )}
          >
            <span className="font-medium">{option.title}</span>
            <span className="mt-1 block text-small text-muted-foreground">
              {option.description}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-auto flex justify-end pt-8">
        <Button onClick={continueToDetails}>Next</Button>
      </div>
    </div>
  );
}
