import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const emptyStateVariants = cva(
  "flex flex-col items-center px-6 text-center",
  {
    variants: {
      size: {
        page: "py-16",
        card: "py-10",
        inline: "py-8",
      },
    },
    defaultVariants: { size: "card" },
  },
);

export interface EmptyStateProps
  extends Omit<React.ComponentProps<"div">, "title">,
    VariantProps<typeof emptyStateVariants> {
  /** "No upcoming events" */
  title: string;
  /** What goes here and what happens next. */
  description?: React.ReactNode;
  /** A lucide icon, shown in a 40px disc. Ignored when `size="inline"`. */
  icon?: React.ReactNode;
  /**
   * Art shown above the title, unframed: `<Hubbo emotion="resting" size="card" />`
   * (§5.2, card size, one Hubbo per screen). Wins over `icon` when both are
   * given. Ignored when `size="inline"`.
   */
  media?: React.ReactNode;
  /** One or two Buttons ("Clear search", "Try again"); use `size="sm"`. */
  actions?: React.ReactNode;
  /** Heading level of the title. Defaults to `h3`. */
  titleAs?: "h2" | "h3" | "p";
}

/**
 * Says what goes here and offers the next step (§3.8, §4.4f). Never an error
 * colour, never blame, including on "Couldn't load events". Hubbo may stand in
 * for the icon at card size, but never on payments or rejections.
 *
 * Pass a bare lucide icon as `icon`; it sits in a 40px disc. Pass Hubbo (or
 * other art) as `media`; it is not framed, and replaces the icon. The component
 * has no border: put it inside a Card, a TableCard or a bordered frame as the
 * surface needs.
 */
function EmptyState({
  title,
  description,
  icon,
  media,
  actions,
  size,
  titleAs: Title = "h3",
  className,
  ...props
}: EmptyStateProps) {
  const showArt = size !== "inline";
  const showMedia = showArt && Boolean(media);
  const showIcon = showArt && !media && Boolean(icon);
  return (
    <div
      data-slot="empty-state"
      className={cn(emptyStateVariants({ size }), className)}
      {...props}
    >
      {showMedia ? (
        <div
          data-slot="empty-state-media"
          className="mb-3 flex items-center justify-center"
        >
          {media}
        </div>
      ) : null}
      {showIcon ? (
        <div
          data-slot="empty-state-icon"
          className="mb-3 flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground [&_svg]:size-5"
        >
          {icon}
        </div>
      ) : null}
      <Title
        data-slot="empty-state-title"
        className="text-subheading text-foreground"
      >
        {title}
      </Title>
      {description ? (
        <div
          data-slot="empty-state-description"
          className="mt-1.5 max-w-sm text-small text-muted-foreground"
        >
          {description}
        </div>
      ) : null}
      {actions ? (
        <div
          data-slot="empty-state-actions"
          className="mt-4 flex flex-wrap items-center justify-center gap-2"
        >
          {actions}
        </div>
      ) : null}
    </div>
  );
}

export { EmptyState, emptyStateVariants };
