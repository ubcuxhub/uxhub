import { CheckEmailMessage } from "@/features/auth/components/check-email-message";
import { redirectIfAuthenticated } from "@/lib/auth/guards";

export default async function Page() {
  await redirectIfAuthenticated();

  return <CheckEmailMessage />;
}
