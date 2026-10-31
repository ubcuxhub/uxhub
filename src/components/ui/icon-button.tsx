"use client";

import * as React from "react";

import { Button, type ButtonProps } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface IconButtonProps
  extends Omit<ButtonProps, "variant" | "size" | "aria-label" | "asChild" | "loading"> {
  /** Names the button: its `aria-label` and the tooltip text. */
  label: string;
  /** Secondary has a hairline edge; ghost has none until hovered. */
  variant?: "secondary" | "ghost";
  size?: "icon" | "icon-sm";
}

/**
 * A circular icon-only button with a tooltip. The label is required because an
 * icon alone has no accessible name. Pass the icon as the child.
 */
const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ label, variant = "secondary", size = "icon", children, ...props }, ref) => (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            ref={ref}
            type="button"
            variant={variant}
            size={size}
            aria-label={label}
            {...props}
          >
            {children}
          </Button>
        </TooltipTrigger>
        <TooltipContent sideOffset={6}>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ),
);
IconButton.displayName = "IconButton";

export { IconButton };
