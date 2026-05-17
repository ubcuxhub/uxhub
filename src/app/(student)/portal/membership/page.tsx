"use client";
import type { MembershipTier } from "@/features/memberships";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { useUser } from "@/context/UserContext";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export default function MembershipsPage() {
  const router = useRouter();
  const { user } = useUser();
  const [membershipTiers, setMembershipTiers] = useState<MembershipTier[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMembershipTiers = async () => {
      const supabase = createClient();
      try {
        const { data, error } = await supabase
          .from("membership_types")
          .select("*")
          .order("price", { ascending: true });

        if (error) throw error;
        setMembershipTiers(data || []);
      } catch (error) {
        console.error("Error fetching membership tiers:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMembershipTiers();
  }, []);

  if (loading || !user) {
    return <div>Loading memberships...</div>;
  }

  // Determine if a user can purchase a specific tier
  const canPurchase = (tierName: string): boolean => {
    // If user already has a membership, they cannot purchase any
    if (user.membership_type_id) {
      return false;
    }

    const lowerName = tierName.toLowerCase();

    if (user.user_type === "ubcStudent" && user.student_number) {
      return lowerName.includes("explorer") || lowerName.includes("innovator");
    }

    if (user.user_type === "faculty") {
      return lowerName.includes("faculty");
    }

    if (user.user_type === "nonUbc") {
      return lowerName.includes("non"); // matches "Non-UBC"
    }

    return false;
  };

  return (
    <div className="container mx-auto py-10 max-w-5xl">
        <h1 className="text-3xl font-bold mb-8 text-center">
          Choose Your Membership
        </h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {membershipTiers.map((tier) => {
            const isCurrent = user.membership_type_id === tier.id;
            const isPurchasable = canPurchase(tier.name);
            const formattedPrice = new Intl.NumberFormat("en-CA", {
              style: "currency",
              currency: "CAD",
            }).format(tier.price);

            return (
              <Card
                key={tier.id}
                className={cn(
                  "flex flex-col h-full relative overflow-hidden transition-all duration-200 hover:shadow-md",
                  isCurrent && "border-primary ring-1 ring-primary bg-primary/5"
                )}
              >
                {isCurrent && (
                  <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs px-3 py-1 rounded-bl-lg font-medium">
                    Current Plan
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="text-xl">{tier.name}</CardTitle>
                  <CardDescription className="text-2xl font-bold text-primary mt-2">
                    {formattedPrice}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-grow">
                  <p className="text-muted-foreground text-sm mb-6">
                    {tier.description}
                  </p>
                  {tier.features && tier.features.length > 0 && (
                    <ul className="space-y-2">
                      {tier.features.map((feature, idx) => (
                        <li
                          key={idx}
                          className="flex items-start gap-2 text-sm text-muted-foreground"
                        >
                          <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full"
                    variant={isCurrent ? "outline" : "default"}
                    disabled={!isPurchasable}
                    onClick={() => {
                      if (!isCurrent) {
                        router.push(`/portal/membership/${tier.id}`);
                      }
                    }}
                  >
                    {isCurrent
                      ? "Expires at..."
                      : isPurchasable
                      ? "Purchase"
                      : "Not Available"}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
    </div>
  );
}
