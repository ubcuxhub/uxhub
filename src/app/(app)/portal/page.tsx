"use client";

import Link from "next/link";
import { useUser } from "@/context/UserContext";
import { Button } from "@/components/ui/button";
import { ArrowRight, CalendarDays, Sparkles } from "lucide-react";

function BecomeMemberBanner() {
  return (
    <div className="mb-8 flex flex-col gap-3 rounded-lg border bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-primary/10 p-2">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold">Become a UX Hub member</h3>
          <p className="text-sm text-muted-foreground">
            Unlock member pricing on events and exclusive perks.
          </p>
        </div>
      </div>
      <Button asChild className="shrink-0">
        <Link href="/portal/membership">
          Become a member
          <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
    </div>
  );
}

export default function PortalHome() {
  const { user } = useUser();

  const firstName =
    user?.name?.split(" ")[0] || user?.email?.split("@")[0] || "there";

  const isMember =
    Boolean(user?.membership_type_id) &&
    (!user?.membership_expires_at ||
      new Date(user.membership_expires_at) > new Date());

  return (
    <main className="container mx-auto max-w-6xl px-4 py-8">
      {user && !isMember && <BecomeMemberBanner />}

      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-2">
          Hey, {firstName}!
        </h1>
        <p className="text-muted-foreground">
          Welcome to the UBC UX Hub portal.
        </p>
      </div>

      <Button asChild variant="outline">
        <Link href="/portal/events">
          View your events
          <CalendarDays className="h-4 w-4" />
        </Link>
      </Button>
    </main>
  );
}
