"use client";

import { payments } from "@square/web-sdk";
import type {
  BillingContact,
  Card,
  CardClassSelectors,
  ChargeCardVerificationDetails,
  Payments,
  TokenResult,
} from "@square/web-sdk";
import {
  useEffect,
  useId,
  useMemo,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { submitCheckoutAction } from "@/features/payments/actions";
import type { PurchaseKind } from "@/features/payments/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ASYNC_DEADLINES,
  getAsyncErrorMessage,
  isAsyncTimeoutError,
  withDeadline,
} from "@/lib/async/deadline";
import { useNavigationRecovery } from "@/lib/async/use-navigation-recovery";
import {
  clearCheckoutAttemptKey,
  getOrCreateCheckoutAttemptKey,
  rotateCheckoutAttemptKey,
} from "@/features/payments/checkout-attempt";
import {
  getThemeServerSnapshot,
  getThemeSnapshot,
  subscribeTheme,
  type Theme,
} from "@/lib/theme";

interface SquareCheckoutFormProps {
  amountCents: number;
  amountLabel: string;
  buttonLabel: string;
  collectBuyerDetails?: boolean;
  kind: PurchaseKind;
  slug: string;
  successHref?: string | ((purchaseId: string) => string);
  initialEmail: string;
  initialFirstName: string;
  initialLastName: string;
  initialPhone?: string | null;
  disabled?: boolean;
  disabledMessage?: string | null;
  onSubmittingChange?: (submitting: boolean) => void;
  showAmount?: boolean;
  showSecurityMessage?: boolean;
  userId: string;
}

function getSquareScriptUrl(applicationId: string) {
  return applicationId.startsWith("sandbox-")
    ? "https://sandbox.web.squarecdn.com/v1/square.js"
    : "https://web.squarecdn.com/v1/square.js";
}

function getCardClassSelectors(theme: Theme): CardClassSelectors {
  const colors =
    theme === "dark"
      ? {
          background: "#1c2029",
          border: "#2a2f3a",
          error: "#f87171",
          focus: "#89a4e4",
          muted: "#8b9097",
          text: "#f1f2f5",
        }
      : {
          background: "#ffffff",
          border: "#d9dce3",
          error: "#b42318",
          focus: "#5f81d1",
          muted: "#8b9097",
          text: "#111111",
        };

  return {
    input: {
      backgroundColor: colors.background,
      color: colors.text,
    },
    "input::placeholder": {
      color: colors.muted,
    },
    "input.is-error": {
      color: colors.error,
    },
    ".input-container": {
      borderColor: colors.border,
      borderRadius: "6px",
    },
    ".input-container.is-focus": {
      borderColor: colors.focus,
    },
    ".input-container.is-error": {
      borderColor: colors.error,
    },
    ".message-text": {
      color: colors.muted,
    },
    ".message-icon": {
      color: colors.muted,
    },
    ".message-text.is-error": {
      color: colors.error,
    },
    ".message-icon.is-error": {
      color: colors.error,
    },
  };
}

function getTokenizationMessage(result: TokenResult) {
  if (result.status === "OK" || !("errors" in result)) {
    return null;
  }

  const [firstError] = result.errors;

  return firstError && "message" in firstError ? firstError.message : null;
}

export function SquareCheckoutForm({
  amountCents,
  amountLabel,
  buttonLabel,
  collectBuyerDetails = true,
  kind,
  slug,
  successHref,
  initialEmail,
  initialFirstName,
  initialLastName,
  initialPhone,
  disabled = false,
  disabledMessage = null,
  onSubmittingChange,
  showAmount = true,
  showSecurityMessage = true,
  userId,
}: SquareCheckoutFormProps) {
  const router = useRouter();
  const theme = useSyncExternalStore(
    subscribeTheme,
    getThemeSnapshot,
    getThemeServerSnapshot,
  );
  const containerId = useId().replace(/:/g, "");
  const [buyerFirstName, setBuyerFirstName] = useState(initialFirstName);
  const [buyerLastName, setBuyerLastName] = useState(initialLastName);
  const [buyerEmail, setBuyerEmail] = useState(initialEmail);
  const [buyerPhone, setBuyerPhone] = useState(initialPhone ?? "");
  const [billingPostalCode, setBillingPostalCode] = useState("");
  const [card, setCard] = useState<Card | null>(null);
  const [squarePayments, setSquarePayments] = useState<Payments | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  /**
   * The redirect to the confirmation page is a transition, so it stays pending
   * while that route renders. Treating it as busy keeps the processing state up
   * until the navigation commits instead of briefly restoring this form.
   */
  const [redirecting, startRedirect] = useTransition();
  const [redirectTimedOut, setRedirectTimedOut] = useState(false);
  const busy = submitting || (redirecting && !redirectTimedOut);
  const [message, setMessage] = useState(disabledMessage ?? "");
  const recoverStalledNavigation = useNavigationRecovery(() => {
    setRedirectTimedOut(true);
    setMessage(
      "Your payment was submitted, but the confirmation page did not load. Check Purchases before trying again.",
    );
  });
  const checkoutScope = useMemo(
    () => ({ kind, slug, userId }),
    [kind, slug, userId],
  );
  const [idempotencyKey, setIdempotencyKey] = useState("");

  useEffect(() => {
    try {
      setIdempotencyKey(
        getOrCreateCheckoutAttemptKey(sessionStorage, checkoutScope),
      );
    } catch {
      setIdempotencyKey(crypto.randomUUID());
    }
  }, [checkoutScope]);

  useEffect(() => {
    if (disabled) {
      setInitializing(false);
      return;
    }

    const applicationId = process.env.NEXT_PUBLIC_SQUARE_APP_ID;
    const locationId = process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID;

    if (!applicationId || !locationId) {
      setMessage("Square is not configured yet for this environment.");
      setInitializing(false);
      return;
    }

    let mounted = true;
    let nextCard: Card | null = null;

    const initialize = async () => {
      try {
        const initialized = await withDeadline(
          async (signal) => {
            const nextPayments = await payments(applicationId, locationId, {
              scriptSrc: getSquareScriptUrl(applicationId),
            });

            if (!nextPayments || !mounted || signal.aborted) {
              return null;
            }

            try {
              nextCard = await nextPayments.card({
                style: getCardClassSelectors(getThemeSnapshot()),
              });
            } catch {
              if (signal.aborted || !mounted) return null;
              console.error("Square theme setup failed.");
              nextCard = await nextPayments.card();
            }

            if (!nextCard) return null;
            if (signal.aborted || !mounted) {
              void nextCard.destroy();
              return null;
            }

            await nextCard.attach(`#${containerId}`);

            if (signal.aborted || !mounted) {
              void nextCard.destroy();
              return null;
            }

            return { card: nextCard, payments: nextPayments };
          },
          {
            operation: "Loading payment form",
            timeoutMs: ASYNC_DEADLINES.userAction,
          },
        );

        if (!initialized || !mounted) {
          return;
        }

        setSquarePayments(initialized.payments);
        setCard(initialized.card);
      } catch (error) {
        console.error("Square initialization failed.");
        if (mounted) {
          setMessage(
            isAsyncTimeoutError(error)
              ? getAsyncErrorMessage(error)
              : "Payment form failed to load. Please refresh and try again.",
          );
        }
      } finally {
        if (mounted) {
          setInitializing(false);
        }
      }
    };

    void initialize();

    return () => {
      mounted = false;
      void nextCard?.destroy();
    };
  }, [containerId, disabled]);

  useEffect(() => {
    onSubmittingChange?.(busy);
  }, [busy, onSubmittingChange]);

  useEffect(() => {
    if (!card) {
      return;
    }

    void card.configure({ style: getCardClassSelectors(theme) }).catch(() => {
      console.error("Square theme update failed.");
    });
  }, [card, theme]);

  const handleCheckout = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (
      disabled ||
      !card ||
      !squarePayments ||
      !idempotencyKey ||
      busy
    ) {
      return;
    }

    setSubmitting(true);
    setRedirectTimedOut(false);
    setMessage("");

    try {
      const billingContact: BillingContact = {
        countryCode: "CA",
        email: buyerEmail,
        familyName: buyerLastName,
        givenName: buyerFirstName,
        phone: buyerPhone || undefined,
        postalCode: billingPostalCode || undefined,
      };
      const verificationDetails: ChargeCardVerificationDetails = {
        amount: (amountCents / 100).toFixed(2),
        billingContact,
        customerInitiated: true,
        currencyCode: "CAD",
        intent: "CHARGE",
        sellerKeyedIn: false,
      };

      const tokenized = await withDeadline(
        () => card.tokenize(verificationDetails),
        {
          operation: "Verifying card details",
          timeoutMs: ASYNC_DEADLINES.checkout,
        },
      );

      if (tokenized.status !== "OK" || !tokenized.token) {
        setMessage(
          getTokenizationMessage(tokenized) ||
            "Card details could not be verified. Please check your information."
        );
        return;
      }

      /**
       * Issuers may require Strong Customer Authentication before they will
       * authorize a card-not-present payment. This runs the buyer through the
       * bank's challenge when one is needed, and the resulting token is what
       * tells Square the buyer was verified.
       */
      let verification;
      try {
        verification = await withDeadline(
          () => squarePayments.verifyBuyer(tokenized.token, verificationDetails),
          {
            operation: "Verifying payment with your bank",
            timeoutMs: ASYNC_DEADLINES.checkout,
          },
        );
      } catch (verificationError) {
        console.error("Square buyer verification failed.");
        setMessage(
          isAsyncTimeoutError(verificationError)
            ? getAsyncErrorMessage(verificationError)
            : "Your bank could not verify this payment. Please try again or use a different card.",
        );
        return;
      }

      if (!verification?.token) {
        setMessage(
          "Your bank could not verify this payment. Please try again or use a different card.",
        );
        return;
      }

      const result = await withDeadline(
        () =>
          submitCheckoutAction({
            billingPostalCode,
            buyerEmail,
            buyerFirstName,
            buyerLastName,
            buyerPhone,
            idempotencyKey,
            kind,
            slug,
            token: tokenized.token,
            verificationToken: verification.token,
          }),
        {
          operation: "Confirming payment",
          timeoutMs: ASYNC_DEADLINES.checkout,
        },
      );

      if (!result.ok) {
        setMessage(result.error);
        if (result.terminal) {
          try {
            setIdempotencyKey(
              rotateCheckoutAttemptKey(sessionStorage, checkoutScope),
            );
          } catch {
            setIdempotencyKey(crypto.randomUUID());
          }
        }
        return;
      }

      if (result.resolution === "completed") {
        try {
          clearCheckoutAttemptKey(sessionStorage, checkoutScope);
        } catch {
          // Storage may be unavailable; navigation can still complete.
        }
      }

      startRedirect(() => {
        const destination =
          typeof successHref === "function"
            ? successHref(result.purchaseId)
            : successHref || result.redirectTo;
        router.replace(destination);
      });
      recoverStalledNavigation();
    } catch (error) {
      console.error("Checkout did not finish before its deadline.");
      setMessage(
        isAsyncTimeoutError(error)
          ? getAsyncErrorMessage(error)
          : "Payment could not be confirmed. Check your purchases before trying again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleCheckout} className="space-y-4">
      {collectBuyerDetails ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`${containerId}-first-name`}>First name</Label>
              <Input
                id={`${containerId}-first-name`}
                autoComplete="given-name"
                onChange={(event) => setBuyerFirstName(event.target.value)}
                required
                value={buyerFirstName}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${containerId}-last-name`}>Last name</Label>
              <Input
                id={`${containerId}-last-name`}
                autoComplete="family-name"
                onChange={(event) => setBuyerLastName(event.target.value)}
                required
                value={buyerLastName}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${containerId}-email`}>Email</Label>
            <Input
              id={`${containerId}-email`}
              autoComplete="email"
              onChange={(event) => setBuyerEmail(event.target.value)}
              required
              type="email"
              value={buyerEmail}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`${containerId}-phone`}>Phone</Label>
              <Input
                id={`${containerId}-phone`}
                autoComplete="tel"
                onChange={(event) => setBuyerPhone(event.target.value)}
                placeholder="+1 604 555 1234"
                value={buyerPhone}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`${containerId}-postal`}>Postal code</Label>
              <Input
                id={`${containerId}-postal`}
                autoComplete="postal-code"
                onChange={(event) => setBillingPostalCode(event.target.value)}
                placeholder="V6T 1Z4"
                value={billingPostalCode}
              />
            </div>
          </div>
        </>
      ) : null}

      {showAmount ? (
        <div className="rounded-md border bg-background p-3 text-small">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Charge amount</span>
            <span className="font-medium">{amountLabel}</span>
          </div>
        </div>
      ) : null}

      <div
        id={containerId}
        className="min-h-24"
      />

      {message ? (
        <p className="text-small text-destructive">{message}</p>
      ) : showSecurityMessage ? (
        <p className="text-small text-muted-foreground">
          Your card details are tokenized by Square. Prices and eligibility are
          confirmed on the server before we complete the purchase.
        </p>
      ) : null}

      <Button
        className="w-full"
        disabled={
          disabled ||
          initializing ||
          busy ||
          !card ||
          !squarePayments ||
          !idempotencyKey
        }
        type="submit"
      >
        {busy ? "Processing..." : buttonLabel}
      </Button>
    </form>
  );
}
