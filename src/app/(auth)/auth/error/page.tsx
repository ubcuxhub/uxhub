import { AuthMessage } from "@/features/auth/components/auth-message";
import { getSafeInternalPath } from "@/lib/auth/paths";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
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
      backLink={backLink}
    >
      {params.error ||
        "We couldn't complete authentication. Please try signing in again."}
    </AuthMessage>
  );
}
