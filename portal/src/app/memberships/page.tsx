"use client";
import ProtectedRoute from "@/components/ProtectedRoute";
import { membershipTiers } from "@/lib/types/membershipTypes";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function MembershipsPage() {
  const router = useRouter();

  return (
    <ProtectedRoute>
      {Object.entries(membershipTiers).map(([name, info], index) => (
        <div key={index} className="mb-8">
          <div className="mb-4">{info.display}</div>
          <Button onClick={() => router.push(`/memberships/${name}`)}>
            Purchase
          </Button>
        </div>
      ))}
    </ProtectedRoute>
  );
}
