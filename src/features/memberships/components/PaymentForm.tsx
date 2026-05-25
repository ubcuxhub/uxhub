/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import type { MembershipTypeRow } from "../types/membershipTypes";

interface PaymentFormProps {
  tier: MembershipTypeRow;
}

declare global {
  interface Window {
    Square?: any;
  }
}

export default function PaymentForm({ tier }: PaymentFormProps) {
  const [cardLoaded, setCardLoaded] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [card, setCard] = useState<any>(null);

  useEffect(() => {
    let isMounted = true;

    const loadSquareScript = (): Promise<void> => {
      return new Promise((resolve, reject) => {
        if (window.Square) return resolve();

        const isProd = process.env.SQUARE_ENV === "production";

        const script = document.createElement("script");
        script.src = isProd
          ? "https://web.squarecdn.com/v1/square.js"
          : "https://sandbox.web.squarecdn.com/v1/square.js";
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject("Failed to load Square script");
        document.body.appendChild(script);
      });
    };

    const initialize = async () => {
      try {
        await loadSquareScript();

        const paymentsInstance = window.Square.payments(
          process.env.NEXT_PUBLIC_SQUARE_APP_ID!,
          process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID!
        );
        if (!isMounted) return;

        const cardInstance = await paymentsInstance.card();
        await cardInstance.attach("#card-container");

        if (!isMounted) return;
        setCard(cardInstance);
        setCardLoaded(true);

        const digitalWallet = await paymentsInstance.paymentRequest({
          countryCode: "CA",
          currencyCode: "CAD",
          total: {
            amount: tier.price.toFixed(2),
            label: "Membership Payment",
          },
          requestBillingContact: true,
        });

        const applePay = await paymentsInstance.applePay(digitalWallet);
        const googlePay = await paymentsInstance.googlePay(digitalWallet);

        if (await applePay.canMakePayment()) {
          await applePay.attach("#apple-pay-button");
        } else if (await googlePay.canMakePayment()) {
          await googlePay.attach("#google-pay-button");
        }
      } catch (err) {
        console.error("Error initializing Square Payments:", err);
      }
    };

    initialize();
    return () => {
      isMounted = false;
    };
  }, [tier.price]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPaymentLoading(true);
    setMessage("");

    try {
      if (!card) {
        setMessage("Payment form not ready yet. Please wait a moment.");
        return;
      }

      const name = (document.getElementById("name") as HTMLInputElement).value;
      const email = (document.getElementById("email") as HTMLInputElement)
        .value;
      const studentNumber =
        (document.getElementById("studentNumber") as HTMLInputElement)?.value ||
        null;

      const result = await card.tokenize();

      if (result.status !== "OK") {
        setMessage("Card tokenization failed. Please check your details.");
        return;
      }

      const payload = {
        token: result.token,
        name,
        email,
        studentNumber,
        tier,
      };

      const res = await fetch("/api/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) setMessage("Payment successful!");
      else setMessage("Payment failed: " + (data.error || "Unknown error"));
    } catch (err) {
      console.error(err);
      setMessage("Payment failed. Try again later.");
    } finally {
      setPaymentLoading(false);
    }
  };

  // Determine if UBC student field is needed based on tier name convention or description
  const isUbcStudentTier =
    tier.name.toLowerCase().includes("student") ||
    tier.name.toLowerCase().includes("innovator") ||
    tier.name.toLowerCase().includes("explorer");

  return (
    <div className="max-w-md mx-auto mt-8 p-6 border rounded-2xl shadow-sm bg-white/5 backdrop-blur-md">
      <h2 className="text-xl font-semibold mb-4 text-center">
        Pay ${tier.price.toFixed(2)} CAD
      </h2>

      <form id="payment-form" onSubmit={handleSubmit} className="space-y-3">
        <input
          id="name"
          placeholder="Full Name"
          required
          className="w-full px-3 py-2 border rounded-md bg-white/10"
        />
        <input
          id="email"
          type="email"
          placeholder="Email"
          required
          className="w-full px-3 py-2 border rounded-md bg-white/10"
        />
        {isUbcStudentTier ? (
          <input
            id="studentNumber"
            placeholder="Student Number"
            required
            className="w-full px-3 py-2 border rounded-md bg-white/10"
          />
        ) : (
          <></>
        )}

        <div id="apple-pay-button" className="my-2" />
        <div id="google-pay-button" className="my-2" />

        <div id="card-container" className="my-4" />

        <button
          type="submit"
          disabled={!cardLoaded || paymentLoading}
          className="w-full py-2 rounded-md bg-black text-white hover:opacity-90 transition disabled:opacity-50"
        >
          {paymentLoading ? "Processing..." : "Pay Now"}
        </button>
      </form>

      {message && <p className="text-center mt-4">{message}</p>}
    </div>
  );
}
