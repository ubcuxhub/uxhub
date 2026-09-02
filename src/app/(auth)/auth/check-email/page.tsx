import { CheckEmailMessage } from "@/features/auth/components/check-email-message";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const params = await searchParams;

  return <CheckEmailMessage email={params.email ?? ""} />;
}