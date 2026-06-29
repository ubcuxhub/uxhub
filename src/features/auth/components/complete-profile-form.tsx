"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

import {
  AuthProfileFields,
  type AuthProfileFormData,
} from "./auth-profile-fields";

interface CompleteProfileFormProps
  extends React.ComponentPropsWithoutRef<"div"> {
  initialEmail: string;
  initialName: string;
}

export function CompleteProfileForm({
  className,
  initialEmail,
  initialName,
  ...props
}: CompleteProfileFormProps) {
  const [formData, setFormData] = useState<AuthProfileFormData>({
    email: initialEmail,
    name: initialName,
    phone: "",
    studentNumber: "",
    faculty: "",
    major: "",
    year: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleChange = (field: keyof AuthProfileFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/complete-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          phone: formData.phone,
          studentNumber: formData.studentNumber,
          faculty: formData.faculty,
          major: formData.major,
          year: formData.year,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to complete profile");
      }

      router.replace("/portal");
      router.refresh();
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Complete your profile</CardTitle>
          <CardDescription>
            Finish setting up your account before entering the portal.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <AuthProfileFields
              emailReadOnly
              formData={formData}
              onChange={handleChange}
            />

            {error ? <p className="text-sm text-red-500">{error}</p> : null}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Saving profile..." : "Continue to portal"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
