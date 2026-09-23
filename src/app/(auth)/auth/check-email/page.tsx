import { CheckEmailMessage } from "@/features/auth/components/CheckEmailMessage";
import { redirectIfAuthenticated } from "@/lib/auth/guards";

export default async function Page() {
  await redirectIfAuthenticated();

  return <CheckEmailMessage />;
}
