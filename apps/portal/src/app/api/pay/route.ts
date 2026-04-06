import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { token, name, email, studentNumber, tier } = body;

    if (!token || !name || !email || !tier?.price || !tier?.display) {
      return NextResponse.json(
        { error: "Missing required payment information" },
        { status: 400 }
      );
    }

    const customerRes = await fetch(
      process.env.SQUARE_ENV === "production"
        ? "https://connect.squareup.com/v2/customers"
        : "https://connect.squareupsandbox.com/v2/customers",
      {
        method: "POST",
        headers: {
          "Square-Version": "2025-01-01",
          Authorization: `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          given_name: name,
          email_address: email,
          reference_id: studentNumber || undefined,
        }),
      }
    );

    const customerData = await customerRes.json();
    const customerId = customerData.customer?.id;

    const paymentRes = await fetch(
      process.env.SQUARE_ENV === "production"
        ? "https://connect.squareup.com/v2/payments"
        : "https://connect.squareupsandbox.com/v2/payments",
      {
        method: "POST",
        headers: {
          "Square-Version": "2025-01-01",
          Authorization: `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          source_id: token,
          idempotency_key: crypto.randomUUID(),
          amount_money: {
            amount: Math.round(tier.price * 100),
            currency: "CAD",
          },
          autocomplete: true,
          customer_id: customerId,
          note: `UX Hub Membership [${tier.display}] - ${name}`,
        }),
      }
    );

    const paymentData = await paymentRes.json();

    if (!paymentRes.ok) {
      console.error("Square payment error:", paymentData);
      return NextResponse.json(
        { error: paymentData.errors?.[0]?.detail || "Payment failed" },
        { status: 400 }
      );
    }

    const paymentId = paymentData.payment?.id;

    const today = new Date();
    const formattedDate = today.toISOString().split("T")[0].replace(/-/g, "/");

    const { error: updateError } = await supabase
      .from("user_info")
      .update({
        membership_type: tier.display,
        order_date: formattedDate,
      })
      .eq("email", email);

    if (updateError) {
      console.error("Supabase update error:", updateError);
    }

    return NextResponse.json({
      success: true,
      paymentId,
      message: "Payment completed successfully",
    });
  } catch (err) {
    console.error("Payment route error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
