"use client";

import { Check, X } from "lucide-react";
import { Toaster as Sonner, toast as sonner } from "sonner";

import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/utils";

/**
 * Toasts (§3.8): bottom right, stacked 8px apart, 380px wide, dismissed after
 * five seconds. Tones are Success, Neutral and Error. Mount `<Toaster />` once
 * in the root layout, then call `toast.success("Event published")` from any
 * client code, including right after a server action. Call sites never import
 * `sonner`.
 *
 * Rules: every admin result gets one; errors say what to do ("Check your
 * connection and try again"); text only, never Hubbo. A toast never takes
 * focus, so anything it offers must also be reachable on the page. `Alt+T`
 * moves focus into the stack, and hovering or focusing it pauses the timer.
 */

type ToastTone = "success" | "neutral" | "error";

export interface ToastOptions {
  description?: string;
  /** One action, shown as an underlined link beside the text. Keep the label to a few words, e.g. "Try again". */
  action?: { label: string; onClick: () => void };
  /** Reusing an id replaces the toast in place instead of stacking another. */
  id?: string | number;
  /** Milliseconds. Defaults to 5000; `Infinity` keeps it until dismissed. */
  duration?: number;
}

const MARK: Record<Exclude<ToastTone, "neutral">, string> = {
  success: "bg-success text-success-foreground",
  error: "bg-error text-destructive",
};

interface ToastViewProps extends ToastOptions {
  tone: ToastTone;
  message: string;
  onDismiss: () => void;
}

/** The toast surface. Exported for tests and the gallery's static specimens. */
function ToastView({
  tone,
  message,
  description,
  action,
  onDismiss,
}: ToastViewProps) {
  return (
    <div
      data-slot="toast"
      data-tone={tone}
      className="overlay-surface flex w-[var(--width,380px)] max-w-[calc(100vw-32px)] items-start gap-3 rounded-xl py-3.5 pr-3 pl-4"
    >
      {tone === "neutral" ? null : (
        <span
          data-slot="toast-mark"
          aria-hidden
          className={cn(
            "flex size-5 shrink-0 items-center justify-center rounded-full",
            MARK[tone],
          )}
        >
          {tone === "success" ? (
            <Check className="size-3" />
          ) : (
            <X className="size-3" />
          )}
        </span>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 break-words">
        <p
          data-slot="toast-title"
          className="text-small font-semibold text-foreground"
        >
          {message}
        </p>
        {description ? (
          <p
            data-slot="toast-description"
            className="text-label font-normal text-muted-foreground"
          >
            {description}
          </p>
        ) : null}
      </div>
      {action ? (
        <button
          type="button"
          data-slot="toast-action"
          onClick={() => {
            action.onClick();
            onDismiss();
          }}
          className="shrink-0 cursor-pointer rounded-sm px-1 py-0.5 text-label font-semibold text-primary underline underline-offset-2 hover:text-primary-hover focus-visible:focus-ring"
        >
          {action.label}
        </button>
      ) : null}
      <IconButton
        variant="ghost"
        size="icon-sm"
        label="Dismiss"
        onClick={onDismiss}
        className="shrink-0 [&_svg]:size-4"
      >
        <X />
      </IconButton>
    </div>
  );
}

function show(tone: ToastTone, message: string, options: ToastOptions = {}) {
  const { id, duration, ...view } = options;
  return sonner.custom(
    (toastId) => (
      <ToastView
        tone={tone}
        message={message}
        onDismiss={() => sonner.dismiss(toastId)}
        {...view}
      />
    ),
    { id, duration },
  );
}

type ToastFn = (message: string, options?: ToastOptions) => string | number;

const toast = Object.assign<
  ToastFn,
  {
    success: ToastFn;
    error: ToastFn;
    dismiss: (id?: string | number) => void;
  }
>((message, options) => show("neutral", message, options), {
  success: (message, options) => show("success", message, options),
  error: (message, options) => show("error", message, options),
  dismiss: (id) => {
    sonner.dismiss(id);
  },
});

/**
 * Mount once, in the root layout. Sonner injects unlayered CSS, so the
 * overrides below carry `!`. Reduced motion is handled by Sonner itself.
 */
function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      duration={5000}
      visibleToasts={3}
      gap={8}
      offset={24}
      mobileOffset={16}
      style={{ "--width": "380px" } as React.CSSProperties}
      toastOptions={{
        unstyled: true,
        classNames: { toast: "duration-250! ease-out!" },
      }}
    />
  );
}

export { Toaster, ToastView, toast };
