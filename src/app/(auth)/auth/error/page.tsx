import { AuthMessage } from "@/features/auth/components/auth-message";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <AuthMessage
      title="Sorry, something went wrong."
      backLink={{ href: "/auth/login", label: "Back to log in" }}
    >
      {params?.error ? `Code error: ${params.error}` : "An unspecified error occurred."}
    </AuthMessage>
  );
}
