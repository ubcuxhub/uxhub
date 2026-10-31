"use client";

import * as React from "react";
import { HexColorPicker } from "react-colorful";
import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DEFAULT_EVENT_COLOUR,
  EVENT_COLOUR_PRESETS,
  normalizeHex,
} from "@/lib/event-colour";
import { cn } from "@/lib/utils";

/**
 * Event colour swatches and the custom-colour popover (§3.10).
 *
 * The swatch fill and its edge are the organizer's colour, not tokens, so they
 * are inline styles. The edge is `text-primary` at 12% (the spec's
 * rgba(17,17,17,.12) in light mode), which keeps white and pale colours
 * visible and flips to a light edge in dark mode.
 *
 * The selected ring is box-shadow, so the fill sits on an inner span: an inline
 * `box-shadow` for the edge would otherwise replace the ring. The focus
 * outline steps out to 6px on a selected swatch to clear the 4px ring.
 *
 * UI only: the parent owns `value` and the custom list.
 */

const SWATCH_EDGE =
  "inset 0 0 0 1px color-mix(in srgb, var(--foreground) 12%, transparent)";

interface ColourSwatchProps
  extends Omit<React.ComponentProps<"button">, "children"> {
  /** Any CSS colour, normally a hex. */
  colour: string;
  /** Accessible name: "Blue", "Custom colour #2F8F6B". */
  name: string;
  /** Exposed as `aria-pressed`. */
  selected?: boolean;
  /** Custom colours: shows the 22px remove button. */
  onRemove?: () => void;
}

function ColourSwatch({
  colour,
  name,
  selected = false,
  onRemove,
  className,
  type = "button",
  disabled,
  ...props
}: ColourSwatchProps) {
  return (
    <div data-slot="colour-swatch-wrapper" className="relative size-11 shrink-0">
      <button
        type={type}
        data-slot="colour-swatch"
        aria-label={name}
        aria-pressed={selected}
        disabled={disabled}
        className={cn(
          "block size-full cursor-pointer rounded-full outline-none transition-shadow duration-150 ease-out",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-(--action-focus)",
          "disabled:cursor-not-allowed disabled:opacity-50",
          selected &&
            "ring-2 ring-foreground ring-offset-2 ring-offset-background focus-visible:outline-offset-6",
          className,
        )}
        {...props}
      >
        <span
          aria-hidden
          className="block size-full rounded-full"
          style={{ backgroundColor: colour, boxShadow: SWATCH_EDGE }}
        />
      </button>
      {onRemove ? (
        <button
          type="button"
          data-slot="colour-swatch-remove"
          aria-label={`Remove ${name.replace(/^Custom colour /, "")}`}
          disabled={disabled}
          onClick={onRemove}
          className="absolute -top-2 left-[30px] flex size-[22px] cursor-pointer items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors duration-150 ease-out hover:bg-muted focus-visible:focus-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          <X aria-hidden className="size-3" />
        </button>
      ) : null}
    </div>
  );
}

/**
 * Restyles react-colorful through its class names: a 160px saturation area with
 * `rounded-lg` corners, a 14px hue track in a 20px row, 18px and 20px
 * white-edged thumbs, and the focus outline on the thumb of whichever control
 * has focus. The library paints a 12px black strip under the saturation area;
 * it is cleared. Its stylesheet is injected unlayered, which beats Tailwind's
 * layered utilities, so every override is `!important`.
 */
// `\_\_` keeps the BEM double underscore: a bare `_` in an arbitrary variant
// becomes a space.
const wheelClasses = cn(
  String.raw`[&_.react-colorful]:h-auto! [&_.react-colorful]:w-full! [&_.react-colorful]:gap-3.5!`,
  String.raw`[&_.react-colorful\_\_saturation]:h-40! [&_.react-colorful\_\_saturation]:rounded-lg! [&_.react-colorful\_\_saturation]:border-b-0!`,
  String.raw`[&_.react-colorful\_\_hue]:my-[3px]! [&_.react-colorful\_\_hue]:h-3.5! [&_.react-colorful\_\_hue]:rounded-full!`,
  String.raw`[&_.react-colorful\_\_saturation-pointer]:size-[18px]! [&_.react-colorful\_\_hue-pointer]:size-5!`,
  String.raw`[&_.react-colorful\_\_pointer]:border-2! [&_.react-colorful\_\_pointer]:shadow-sm!`,
  String.raw`[&_.react-colorful\_\_interactive]:outline-none!`,
  String.raw`[&_.react-colorful\_\_interactive:focus-visible_.react-colorful\_\_pointer]:outline-2! [&_.react-colorful\_\_interactive:focus-visible_.react-colorful\_\_pointer]:outline-offset-2! [&_.react-colorful\_\_interactive:focus-visible_.react-colorful\_\_pointer]:outline-solid! [&_.react-colorful\_\_interactive:focus-visible_.react-colorful\_\_pointer]:outline-(--action-focus)!`,
);

const HEX_ERROR = "Use a 6-digit hex, like #325DC4.";

interface CustomColourFormProps {
  /** Seeds the wheel and the hex field. */
  initialColour?: string;
  /** Seeds the hex field with text that may not be a colour, for the error state. */
  initialText?: string;
  onUse: (hex: string) => void;
  onCancel: () => void;
  className?: string;
}

/**
 * The popover body: wheel, hue slider, hex field, Cancel and Use colour. It is
 * its own export so the gallery can show it inline in its error state. It is
 * not a `<form>`: it renders inside a portal, and React bubbles a portaled
 * form's submit to any form around the trigger, such as the event builder.
 */
function CustomColourForm({
  initialColour = DEFAULT_EVENT_COLOUR,
  initialText,
  onUse,
  onCancel,
  className,
}: CustomColourFormProps) {
  const uid = React.useId();
  const titleId = `${uid}-title`;
  const inputId = `${uid}-hex`;
  const errorId = `${uid}-hex-error`;
  const inputRef = React.useRef<HTMLInputElement>(null);

  const startColour = normalizeHex(initialColour) ?? DEFAULT_EVENT_COLOUR;
  const [colour, setColour] = React.useState(startColour);
  const [text, setText] = React.useState(initialText ?? startColour);
  const [showError, setShowError] = React.useState(
    initialText !== undefined && normalizeHex(initialText) === null,
  );

  const parsed = normalizeHex(text);
  const invalid = showError && parsed === null;

  const handleTextChange = (next: string) => {
    setText(next);
    const hex = normalizeHex(next);
    if (hex) {
      setColour(hex);
      setShowError(false);
    }
  };

  const handleWheel = (next: string) => {
    const hex = normalizeHex(next) ?? colour;
    setColour(hex);
    setText(hex);
    setShowError(false);
  };

  const submit = () => {
    if (!parsed) {
      setShowError(true);
      inputRef.current?.focus();
      return;
    }
    onUse(parsed);
  };

  return (
    <div
      data-slot="colour-picker-form"
      role="group"
      aria-labelledby={titleId}
      className={cn("flex w-full flex-col gap-3.5", className)}
    >
      <p id={titleId} className="text-small font-semibold text-foreground">
        Custom event colour
      </p>
      <div className={wheelClasses}>
        <HexColorPicker color={colour} onChange={handleWheel} />
      </div>
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          data-slot="colour-picker-preview"
          className="mt-7 block size-11 shrink-0 rounded-full"
          style={{ backgroundColor: colour, boxShadow: SWATCH_EDGE }}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <FieldLabel htmlFor={inputId}>Hex</FieldLabel>
          <Input
            ref={inputRef}
            id={inputId}
            value={text}
            placeholder={DEFAULT_EVENT_COLOUR}
            maxLength={7}
            spellCheck={false}
            autoComplete="off"
            autoCapitalize="characters"
            aria-invalid={invalid || undefined}
            aria-describedby={invalid ? errorId : undefined}
            onChange={(event) => handleTextChange(event.target.value)}
            onBlur={() => setShowError(parsed === null)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                submit();
              }
            }}
          />
          {invalid ? <FieldError id={errorId}>{HEX_ERROR}</FieldError> : null}
        </div>
      </div>
      <div className="flex items-start justify-end gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" size="sm" onClick={submit}>
          Use colour
        </Button>
      </div>
    </div>
  );
}

interface ColourPickerProps {
  value: string;
  onValueChange: (hex: string) => void;
  customColours: readonly string[];
  onCustomColoursChange: (hexes: string[]) => void;
  /** Names the group: "Event colour". */
  label: string;
  disabled?: boolean;
  className?: string;
  /** Opens the custom popover on mount. For the gallery's forced states. */
  defaultOpen?: boolean;
}

function ColourPicker({
  value,
  onValueChange,
  customColours,
  onCustomColoursChange,
  label,
  disabled,
  className,
  defaultOpen,
}: ColourPickerProps) {
  const labelId = React.useId();
  const rowRef = React.useRef<HTMLDivElement>(null);
  const focusAfterRemove = React.useRef<number | null>(null);
  const [open, setOpen] = React.useState(defaultOpen ?? false);

  const selected = normalizeHex(value);

  // A removed swatch takes focus with it. Hand focus to the swatch that slid
  // into its place, or to Add when it was the last one.
  React.useEffect(() => {
    const index = focusAfterRemove.current;
    if (index === null) return;
    focusAfterRemove.current = null;
    const swatches = rowRef.current?.querySelectorAll<HTMLElement>(
      '[data-slot="colour-swatch"]',
    );
    const target =
      swatches?.[EVENT_COLOUR_PRESETS.length + index] ??
      rowRef.current?.querySelector<HTMLElement>('[data-slot="colour-add"]');
    target?.focus();
  }, [customColours]);

  const select = (hex: string) => {
    if (hex !== selected) onValueChange(hex);
  };

  const remove = (index: number) => {
    const hex = normalizeHex(customColours[index] ?? "");
    focusAfterRemove.current = index;
    onCustomColoursChange(customColours.filter((_, i) => i !== index));
    if (hex && hex === selected) onValueChange(DEFAULT_EVENT_COLOUR);
  };

  const useColour = (hex: string) => {
    const known =
      EVENT_COLOUR_PRESETS.some((preset) => preset.hex === hex) ||
      customColours.some((custom) => normalizeHex(custom) === hex);
    if (!known) onCustomColoursChange([...customColours, hex]);
    onValueChange(hex);
    setOpen(false);
  };

  return (
    <div
      role="group"
      aria-labelledby={labelId}
      data-slot="colour-picker"
      className={cn("flex flex-col gap-3", className)}
    >
      <span id={labelId} className="text-body-medium text-foreground">
        {label}
      </span>
      <div ref={rowRef} className="flex flex-wrap items-center gap-3 pt-2">
        {EVENT_COLOUR_PRESETS.map((preset) => (
          <ColourSwatch
            key={preset.hex}
            colour={preset.hex}
            name={preset.name}
            selected={selected === preset.hex}
            disabled={disabled}
            onClick={() => select(preset.hex)}
          />
        ))}
        {customColours.map((custom, index) => {
          const hex = normalizeHex(custom);
          if (!hex) return null;
          return (
            <ColourSwatch
              key={hex}
              colour={hex}
              name={`Custom colour ${hex}`}
              selected={selected === hex}
              disabled={disabled}
              onClick={() => select(hex)}
              onRemove={() => remove(index)}
            />
          );
        })}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              data-slot="colour-add"
              aria-label="Add custom colour"
              disabled={disabled}
              className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-dashed border-muted-foreground text-foreground transition-colors duration-150 ease-out hover:bg-muted focus-visible:focus-ring aria-expanded:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus aria-hidden className="size-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[280px]">
            <CustomColourForm
              initialColour={selected ?? DEFAULT_EVENT_COLOUR}
              onUse={useColour}
              onCancel={() => setOpen(false)}
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

export { ColourSwatch, ColourPicker, CustomColourForm };
export type { ColourSwatchProps, ColourPickerProps, CustomColourFormProps };
