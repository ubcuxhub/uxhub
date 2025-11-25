import { membershipTiers } from "@/lib/types/membershipTypes";
import Link from "next/link";
import { notFound } from "next/navigation";
import PaymentForm from "@/components/PaymentForm";
import ProtectedRoute from "@/components/ProtectedRoute";

async function page({ params }: { params: Promise<{ tier: string }> }) {
  const { tier } = await params;

  if (!(tier in membershipTiers)) {
    notFound();
  }

  const formattedPrice = new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(membershipTiers[tier].price);

  return (
    <ProtectedRoute>
      <Link href={"/memberships"}>back</Link>
      <div>
        membership: {membershipTiers[tier].display} <br></br>
        price: {formattedPrice} <br></br>
        {membershipTiers[tier].description
          ? membershipTiers[tier].description
          : ""}
      </div>

      <PaymentForm tier={membershipTiers[tier]} />
    </ProtectedRoute>
  );
}

export default page;
