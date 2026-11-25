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
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { submitCheckoutAction } from "@/features/payments/actions";
import type { PurchaseKind } from "@/features/payments/types";
import { Button } from "@/components/ui/button";
import {
  ASYNC_DEADLINES,
  getAsyncErrorMessage,
  isAsyncTimeoutError,
  withDeadline,
} from "@/lib/async/deadline";
import { useNavigationRecovery } from "@/hooks/use-navigation-recovery";
import {
  type CheckoutAttemptScope,
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

/** Where a checkout goes when the page gives no confirmation route. */
const PURCHASES_HREF = "/portal#settings/purchases";

interface SquareCheckoutFormProps {
  amountCents: number;
  amountLabel: string;
  buttonLabel: string;
  /** The submit label for a free ticket or membership, which takes no card. */
  freeButtonLabel?: string;
  kind: PurchaseKind;
  slug: string;
  successHref?: string | ((purchaseId: string) => string);
  /**
   * The buyer's profile, for the billing contact the bank's verification
   * sees. The server charges with the profile it holds, not these.
   */
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
  freeButtonLabel = "Confirm spot",
  kind,
  slug,
  successHref = PURCHASES_HREF,
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
  // A free ticket or membership takes no card and never reaches Square.
  const free = amountCents === 0;
  const theme = useSyncExternalStore(
    subscribeTheme,
    getThemeSnapshot,
    getThemeServerSnapshot,
  );
  const containerId = useId().replace(/:/g, "");
  const [card, setCard] = useState<Card | null>(null);
  const [squarePayments, setSquarePayments] = useState<Payments | null>(null);
  const squareConfigured = Boolean(
    process.env.NEXT_PUBLIC_SQUARE_APP_ID &&
      process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID,
  );
  const [loadingCard, setLoadingCard] = useState(true);
  const initializing = !free && !disabled && squareConfigured && loadingCard;
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
  const shownMessage =
    message ||
    (!free && !disabled && !squareConfigured
      ? "Square is not configured yet for this environment."
      : "");
  const recoverStalledNavigation = useNavigationRecovery(() => {
    setRedirectTimedOut(true);
    setMessage(
      "Your request was submitted, but the confirmation page did not load. Check Purchases before trying again.",
    );
  });
  const checkoutScope = useMemo(
    () => ({ kind, slug, userId }),
    [kind, slug, userId],
  );
  // Stands in for sessionStorage when it is unavailable, so a retry within
  // this page still reuses the attempt's key.
  const fallbackAttempt = useRef<{
    scope: CheckoutAttemptScope;
    key: string;
  } | null>(null);

  // Read at submit, not on mount: the key matters only once a charge is sent.
  const getIdempotencyKey = () => {
    try {
      return getOrCreateCheckoutAttemptKey(sessionStorage, checkoutScope);
    } catch {
      if (fallbackAttempt.current?.scope !== checkoutScope) {
        fallbackAttempt.current = {
          scope: checkoutScope,
          key: crypto.randomUUID(),
        };
      }
      return fallbackAttempt.current.key;
    }
  };

  useEffect(() => {
    const applicationId = process.env.NEXT_PUBLIC_SQUARE_APP_ID;
    const locationId = process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID;

    if (free || disabled || !applicationId || !locationId) {
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
          setLoadingCard(false);
        }
      }
    };

    void initialize();

    return () => {
      mounted = false;
      void nextCard?.destroy();
    };
  }, [containerId, disabled, free]);

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
      (!free && (!card || !squarePayments)) ||
      busy
    ) {
      return;
    }

    const idempotencyKey = getIdempotencyKey();

    setSubmitting(true);
    setRedirectTimedOut(false);
    setMessage("");

    try {
      let token: string | null = null;
      let verificationToken: string | null = null;
      if (!free) {
        const billingContact: BillingContact = {
          countryCode: "CA",
          email: initialEmail,
          familyName: initialLastName || undefined,
          givenName: initialFirstName,
          phone: initialPhone || undefined,
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
          () => card!.tokenize(verificationDetails),
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
         *
         * Square's SCA guide now says `tokenize(verificationDetails)` handles
         * authentication itself and marks `verifyBuyer()` deprecated (it still
         * runs its own SCA check when called). Dropping it changes what reaches
         * `payments.create`, so that waits for a sandbox test of a challenged
         * card rather than being changed blind.
         */
        let verification;
        try {
          verification = await withDeadline(
            () => squarePayments!.verifyBuyer(tokenized.token, verificationDetails),
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

        token = tokenized.token;
        verificationToken = verification.token;
      }

      const result = await withDeadline(
        () =>
          submitCheckoutAction({
            idempotencyKey,
            kind,
            slug,
            token,
            verificationToken,
            expectedAmountCents: amountCents,
          }),
        {
          operation: free ? (kind === "membership" ? "Confirming membership" : "Confirming registration") : "Confirming payment",
          timeoutMs: ASYNC_DEADLINES.checkout,
        },
      );

      if (!result.ok) {
        setMessage(result.error);
        if (result.terminal) {
          try {
            rotateCheckoutAttemptKey(sessionStorage, checkoutScope);
          } catch {
            fallbackAttempt.current = null;
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
            : successHref;
        router.replace(destination);
      });
      recoverStalledNavigation();
    } catch (error) {
      console.error("Checkout did not finish before its deadline.");
      setMessage(
        isAsyncTimeoutError(error)
          ? getAsyncErrorMessage(error)
          : "Checkout could not be confirmed. Check your purchases before trying again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleCheckout} className="space-y-4">
      {showAmount ? (
        <div className="rounded-md border bg-background p-3 text-small">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Charge amount</span>
            <span className="text-body-medium">{amountLabel}</span>
          </div>
        </div>
      ) : null}

      {!free && <div id={containerId} className="min-h-24" />}

      {shownMessage ? (
        <p role="alert" className="text-small text-destructive">{shownMessage}</p>
      ) : free ? (
        <p className="text-small text-muted-foreground">{kind === "membership" ? "No payment details are needed. Confirm to start your membership." : "No payment details are needed. Confirm to reserve your ticket."}</p>
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
          (!free && (!card || !squarePayments))
        }
        type="submit"
      >
        {busy ? "Processing..." : free ? freeButtonLabel : buttonLabel}
      </Button>
    </form>
  );
}
