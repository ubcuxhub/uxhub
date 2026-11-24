import { AuthMessage } from "@/features/auth/components/AuthMessage";
import { authErrorMessage } from "@/lib/auth/auth-error";
import { getSafeInternalPath } from "@/lib/auth/paths";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; next?: string }>;
}) {
  const params = await searchParams;
  const nextPath = getSafeInternalPath(params.next);
  const isPasswordRecovery = nextPath === "/auth/update-password";
  const backLink = isPasswordRecovery
    ? { href: "/auth/forgot-password", label: "Request another reset link" }
    : {
        href: `/auth/login?next=${encodeURIComponent(nextPath)}`,
        label: "Try signing in again",
      };

  return (
    <AuthMessage
      title="Sorry, something went wrong."
      // Fixed copy chosen by code, never URL text (see auth-error.ts).
      description={authErrorMessage(params.code)}
      backLink={backLink}
    />
  );
}
