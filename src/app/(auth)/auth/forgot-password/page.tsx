import {
  ForgotPasswordForm,
} from "@/features/auth/components/ForgotPasswordForm";
import { redirectIfAuthenticated } from "@/lib/auth/guards";

export default async function Page() {
  await redirectIfAuthenticated();

  return (
    <ForgotPasswordForm />
  );
}
