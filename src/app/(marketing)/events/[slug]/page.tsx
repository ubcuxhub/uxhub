import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { fetchEventBySlug } from "@/lib/supabase-helpers/events";
import { fetchUserRegistration } from "@/lib/supabase-helpers/event-registrations";
import { fetchUserInfoByAuthId } from "@/lib/supabase-helpers/users";

interface MarketingEventPageProps {
  params: Promise<{ slug: string }>;
}

export default async function MarketingEventPage({
  params,
}: MarketingEventPageProps) {
  const { slug } = await params;
  const supabase = await createClient();
  const event = await fetchEventBySlug(supabase, slug);

  if (!event) {
    notFound();
  }

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  let isRegistered = false;
  if (authUser) {
    const userInfo = await fetchUserInfoByAuthId(supabase, authUser.id).catch(
      () => null
    );
    if (userInfo) {
      const registration = await fetchUserRegistration(
        supabase,
        event.id,
        userInfo.id
      );
      isRegistered = registration !== null;
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white px-6 text-center">
      <h1 className="text-3xl font-bold text-black">{event.name}</h1>
      <p className="text-gray-500">under construction</p>

      {isRegistered ? (
        <Button disabled>Already registered</Button>
      ) : (
        <Button asChild>
          <Link href={`/portal/events/${event.slug}/checkout`}>Register</Link>
        </Button>
      )}
    </main>
  );
}
