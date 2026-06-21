import { ForgotPasswordForm } from "@/features/auth";
import { redirectIfAuthenticated } from "@/lib/auth/guards";

export default async function Page() {
  await redirectIfAuthenticated();

  return (
    <ForgotPasswordForm />
  );
}
