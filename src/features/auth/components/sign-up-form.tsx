"use client";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  AuthProfileFields,
  type AuthProfileFormData,
} from "./auth-profile-fields";
import { GoogleOAuthButton } from "./google-oauth-button";

type SignUpFormData = AuthProfileFormData & {
  password: string;
  repeatPassword: string;
};

export function SignUpForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [formData, setFormData] = useState<SignUpFormData>({
    email: "",
    password: "",
    repeatPassword: "",
    name: "",
    phone: "",
    studentNumber: "",
    faculty: "",
    major: "",
    year: "",
  });

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    if (formData.password !== formData.repeatPassword) {
      setError("Passwords do not match");
      setIsLoading(false);
      return;
    }

    try {
      const normalizedEmail = formData.email.trim().toLowerCase();
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password: formData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/portal`,
          data: {
            full_name: formData.name,
          },
        },
      });

      if (authError) throw authError;

      const user = authData.user;
      if (!user) throw new Error("User not returned from Supabase");

      // Call the API route to create the user profile (bypasses RLS)
      const res = await fetch("/api/link-auth-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authUserId: user.id,
          email: normalizedEmail,
          name: formData.name,
          phone: formData.phone,
          studentNumber: formData.studentNumber,
          faculty: formData.faculty,
          major: formData.major,
          year: formData.year,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        console.error("Failed to create user profile:", result.error);
        throw new Error(result.error || "Failed to create user profile");
      }

      router.push("/auth/sign-up-success");
    } catch (error: unknown) {
      console.error("Sign up error:", error);
      setError(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (field: keyof SignUpFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="text-h2">Sign up</CardTitle>
          <CardDescription>Create a new account</CardDescription>
        </CardHeader>
        <CardContent>
          <GoogleOAuthButton />
          <form onSubmit={handleSignUp} className="space-y-6">
            <div className="space-y-4 pt-6">
              <AuthProfileFields formData={formData} onChange={handleChange} />

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="password">Password *</Label>
                  <Input
                    id="password"
                    type="password"
                    required
                    value={formData.password}
                    onChange={(e) => handleChange("password", e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="repeat-password">Confirm Password *</Label>
                  <Input
                    id="repeat-password"
                    type="password"
                    required
                    value={formData.repeatPassword}
                    onChange={(e) =>
                      handleChange("repeatPassword", e.target.value)
                    }
                  />
                </div>
              </div>
            </div>

            {error && <p className="text-small text-destructive">{error}</p>}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Creating account..." : "Sign up"}
            </Button>

            <div className="text-center text-small">
              Already have an account?{" "}
              <Link href="/auth/login" className="underline underline-offset-4">
                Login
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
