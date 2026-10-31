"use client";

import { useLayoutEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Calendar,
  Check,
  ChevronDown,
  CircleCheck,
  Search,
  Ticket,
  Users,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { Composition, Specimen, SpecimenGroup } from "../_gallery/Specimen";
import type { GallerySection } from "../_gallery/types";

/* Semantic tokens only: screens never use the primitives. */
const COLOUR_GROUPS: Array<{
  title: string;
  tokens: Array<{ name: string; variable: string; utility: string }>;
}> = [
  {
    title: "Background",
    tokens: [
      { name: "background/default", variable: "--background-default", utility: "bg-background" },
      { name: "background/secondary", variable: "--background-secondary", utility: "bg-section" },
      { name: "background/surface-default", variable: "--background-surface-default", utility: "bg-background" },
      { name: "background/surface-card", variable: "--background-surface-card", utility: "bg-card" },
      { name: "background/surface-modal", variable: "--background-surface-modal", utility: "bg-popover" },
      { name: "background/surface-subtle", variable: "--background-surface-subtle", utility: "bg-muted" },
      { name: "background/surface-hover", variable: "--background-surface-hover", utility: "bg-accent" },
    ],
  },
  {
    title: "Text",
    tokens: [
      { name: "text/primary", variable: "--text-primary", utility: "text-foreground" },
      { name: "text/secondary", variable: "--text-secondary", utility: "text-muted-foreground" },
      { name: "text/muted", variable: "--text-muted", utility: "text-muted-foreground" },
      { name: "text/disabled", variable: "--text-disabled", utility: "text-disabled-foreground" },
      { name: "text/inverse", variable: "--text-inverse", utility: "text-primary-foreground" },
    ],
  },
  {
    title: "Border",
    tokens: [
      { name: "border/default", variable: "--border-default", utility: "border-border" },
      { name: "border/subtle", variable: "--border-subtle", utility: "border-border-subtle" },
    ],
  },
  {
    title: "Action",
    tokens: [
      { name: "action/primary", variable: "--action-primary", utility: "bg-primary" },
      { name: "action/primary-hover", variable: "--action-primary-hover", utility: "bg-primary-hover" },
      { name: "action/primary-strong", variable: "--action-primary-strong", utility: "bg-primary-active" },
      { name: "action/secondary", variable: "--action-secondary", utility: "bg-background" },
      { name: "action/focus", variable: "--action-focus", utility: "outline-ring" },
      { name: "action/disabled-background", variable: "--action-disabled-background", utility: "bg-disabled" },
      { name: "action/disabled-border", variable: "--action-disabled-border", utility: "border-disabled-border" },
      { name: "action/destructive", variable: "--action-destructive", utility: "bg-destructive" },
      { name: "action/destructive-hover", variable: "--action-destructive-hover", utility: "bg-destructive-hover" },
      { name: "action/destructive-strong", variable: "--action-destructive-strong", utility: "bg-destructive-active" },
    ],
  },
  {
    title: "Status",
    tokens: [
      { name: "status/success-text", variable: "--status-success-text", utility: "text-success-foreground" },
      { name: "status/success-background", variable: "--status-success-background", utility: "bg-success" },
      { name: "status/success-active", variable: "--status-success-active", utility: "bg-success-solid" },
      { name: "status/warning-text", variable: "--status-warning-text", utility: "text-warning-foreground" },
      { name: "status/warning-background", variable: "--status-warning-background", utility: "bg-warning" },
      { name: "status/error-text", variable: "--status-error-text", utility: "text-destructive" },
      { name: "status/error-background", variable: "--status-error-background", utility: "bg-error" },
      { name: "status/info-text", variable: "--status-info-text", utility: "text-info-foreground" },
      { name: "status/info-background", variable: "--status-info-background", utility: "bg-info" },
    ],
  },
  {
    title: "Transaction",
    tokens: [
      { name: "transaction/positive", variable: "--transaction-positive", utility: "text-transaction-positive" },
      { name: "transaction/negative", variable: "--transaction-negative", utility: "text-transaction-negative" },
    ],
  },
  {
    title: "Overlay",
    tokens: [{ name: "overlay/scrim", variable: "--overlay-scrim", utility: "bg-scrim" }],
  },
];

const TYPE_STYLES = [
  { cls: "text-h1", name: "header-1", spec: "32 / 40 · 600", sample: "Welcome back, Johnny" },
  { cls: "text-h2", name: "header-2", spec: "24 / 32 · 600", sample: "Upcoming events" },
  { cls: "text-h3", name: "header-3", spec: "20 / 28 · 600", sample: "Delete this event?" },
  { cls: "text-subheading", name: "subheading", spec: "18 / 26 · 500", sample: "Registration details" },
  { cls: "text-body", name: "body", spec: "16 / 24 · 400", sample: "Join us for a night of design critique and pizza." },
  { cls: "text-body-medium", name: "body-medium", spec: "16 / 24 · 500", sample: "Full name" },
  { cls: "text-small", name: "body-small", spec: "14 / 20 · 400", sample: "Fri, Nov 14 · Henry Angus 098" },
  { cls: "text-table", name: "table-text", spec: "14 / 20 · 400", sample: "johnny@example.com" },
  { cls: "text-table-heading", name: "table-heading", spec: "16 / 24 · 500", sample: "Membership" },
  { cls: "text-button", name: "button", spec: "16 / 24 · 500", sample: "Register now" },
  { cls: "text-button-small", name: "button-small", spec: "14 / 20 · 500", sample: "Edit" },
  { cls: "text-label", name: "label", spec: "13 / 18 · 500", sample: "Optional" },
  { cls: "text-badge", name: "status-label", spec: "12 / 16 · 500", sample: "Going" },
];

const RADII = [
  { cls: "rounded-none", name: "none", px: "0" },
  { cls: "rounded-xs", name: "xs", px: "2" },
  { cls: "rounded-sm", name: "sm", px: "4" },
  { cls: "rounded-md", name: "md", px: "6" },
  { cls: "rounded-lg", name: "lg", px: "8" },
  { cls: "rounded-xl", name: "xl", px: "12" },
  { cls: "rounded-2xl", name: "2xl", px: "16" },
  { cls: "rounded-3xl", name: "3xl", px: "24" },
  { cls: "rounded-full", name: "full", px: "999" },
];

const ICONS = [
  { Icon: Calendar, name: "calendar" },
  { Icon: Users, name: "users" },
  { Icon: Ticket, name: "ticket" },
  { Icon: Search, name: "search" },
  { Icon: ArrowLeft, name: "arrow-left" },
  { Icon: ChevronDown, name: "chevron-down" },
  { Icon: Check, name: "check" },
  { Icon: X, name: "x" },
  { Icon: CircleCheck, name: "circle-check" },
];

const ICON_SIZES = [
  { cls: "size-3.5", label: "14px · small buttons, badges" },
  { cls: "size-4", label: "16px · buttons, fields" },
  { cls: "size-5", label: "20px · sidebar nav, 12px gap" },
  { cls: "size-6", label: "24px" },
];

function toHex(rgb: string) {
  const channels = rgb.match(/[\d.]+/g)?.map(Number);
  if (!channels || channels.length < 3) return rgb;
  const [r, g, b, a = 1] = channels;
  const hex = [r, g, b]
    .map((c) => Math.round(c).toString(16).padStart(2, "0"))
    .join("");
  return a < 1 ? `#${hex} · ${Math.round(a * 100)}%` : `#${hex}`;
}

/** A colour tile with the resolved value read back from the live theme. */
function Swatch({
  name,
  variable,
  utility,
}: {
  name: string;
  variable: string;
  utility: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState("");

  // The gallery applies the page theme after children mount, so re-read when
  // <html>'s theme attribute changes as well as on mount.
  useLayoutEffect(() => {
    const read = () => {
      if (ref.current) {
        setValue(toHex(getComputedStyle(ref.current).backgroundColor));
      }
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  return (
    <div data-specimen={name} className="flex min-w-0 flex-col gap-1.5">
      <div
        ref={ref}
        style={{ background: `var(${variable})` }}
        className="h-14 rounded-lg border border-border"
      />
      <div className="flex min-w-0 flex-col px-0.5">
        <span className="truncate text-label">{name}</span>
        <span className="truncate text-badge text-muted-foreground">
          {value || "…"}
        </span>
        <span className="truncate text-badge text-muted-foreground">{utility}</span>
      </div>
    </div>
  );
}

const DURATION_CLASS = {
  150: "duration-150",
  200: "duration-200",
  250: "duration-250",
} as const;

/** Slides a knob with a design-system duration so the motion can be felt. */
function MotionDemo({
  duration,
  label,
}: {
  duration: keyof typeof DURATION_CLASS;
  label: string;
}) {
  const [moved, setMoved] = useState(false);

  return (
    <Specimen label={label} className="flex-col items-stretch">
      <div className="relative h-8 w-full rounded-full bg-muted @container">
        <div
          className={cn(
            "absolute top-1 left-1 size-6 rounded-full bg-primary transition-transform ease-out",
            DURATION_CLASS[duration],
            moved && "translate-x-[calc(100cqw-2rem)]",
          )}
        />
      </div>
      <Button type="button" variant="outline" onClick={() => setMoved((m) => !m)}>
        Play {duration}ms
      </Button>
    </Specimen>
  );
}

function Foundations() {
  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-8">
        {COLOUR_GROUPS.map((group) => (
          <SpecimenGroup
            key={group.title}
            title={`Colour · ${group.title}`}
            spec="§2.1"
            min="9.5rem"
          >
            {group.tokens.map((token) => (
              <Swatch key={token.name} {...token} />
            ))}
          </SpecimenGroup>
        ))}
      </div>

      <SpecimenGroup
        title="Bridge utilities"
        spec="shadcn bridge"
        description="Legacy shadcn utilities that resolve through the semantic tokens. They must flip with the column, so every tile in the dark column has to be dark."
        min="9.5rem"
      >
        <Specimen label="bg-background / text-foreground" bare>
          <div className="w-full rounded-lg border bg-background p-3 text-small text-foreground">
            Aa
          </div>
        </Specimen>
        <Specimen label="bg-primary / text-primary-foreground" bare>
          <div className="w-full rounded-lg bg-primary p-3 text-small text-primary-foreground">
            Aa
          </div>
        </Specimen>
        <Specimen label="bg-muted / text-muted-foreground" bare>
          <div className="w-full rounded-lg bg-muted p-3 text-small text-muted-foreground">
            Aa
          </div>
        </Specimen>
        <Specimen label="bg-card / border" bare>
          <div className="w-full rounded-lg border bg-card p-3 text-small text-card-foreground">
            Aa
          </div>
        </Specimen>
        <Specimen label="text-destructive" bare>
          <div className="w-full rounded-lg border p-3 text-small text-destructive">
            Error text
          </div>
        </Specimen>
      </SpecimenGroup>

      <SpecimenGroup
        title="Typography"
        spec="§2.2"
        description="DM Sans, 13 styles on the 4px grid. No all caps, no letter-spacing."
        min="100%"
      >
        {TYPE_STYLES.map((t) => (
          <Specimen key={t.name} label={`${t.name} · ${t.spec} · ${t.cls}`}>
            <span className={cn(t.cls, "min-w-0")}>{t.sample}</span>
          </Specimen>
        ))}
      </SpecimenGroup>

      <SpecimenGroup
        title="Radius"
        spec="§2.5"
        description="Everything clickable or typeable is a pill; containers soften as they grow."
        min="7rem"
      >
        {RADII.map((r) => (
          <Specimen key={r.name} label={`${r.name} · ${r.px}px`} bare>
            <div
              className={cn(
                "h-16 w-full border border-border bg-muted",
                r.cls,
              )}
            />
          </Specimen>
        ))}
      </SpecimenGroup>

      <SpecimenGroup
        title="Focus ring"
        spec="§3.7"
        description="2px action-focus outline, 2px offset. Press Tab to focus the real controls."
        min="12rem"
      >
        <Specimen label="focus-ring utility (static)">
          <div className="focus-ring rounded-full border border-border px-4 py-2 text-button">
            Focused
          </div>
        </Specimen>
        <Specimen label="Button">
          <Button>Tab to me</Button>
        </Specimen>
        <Specimen label="Native input">
          <input
            aria-label="Focus demo"
            placeholder="Tab to me"
            className="h-10 w-full rounded-full border border-border bg-background px-4 text-body focus-visible:focus-ring"
          />
        </Specimen>
      </SpecimenGroup>

      <SpecimenGroup
        title="Icons"
        spec="§2.7"
        description="Lucide at its default 2px stroke at every size (thicker than Figma's 1.5px, by choice). 16px beside body text with an 8px gap, 14px beside small text, 20px with a 12px gap in sidebar rows."
        min="16rem"
      >
        {ICON_SIZES.map(({ cls, label }) => (
          <Specimen key={cls} label={label}>
            <div className="flex gap-3 text-muted-foreground">
              {ICONS.map(({ Icon, name }) => (
                <Icon key={name} className={cls} aria-hidden />
              ))}
            </div>
          </Specimen>
        ))}
        <Specimen label="Icon + label, 8px gap, 16px">
          <span className="inline-flex items-center gap-2 text-body">
            <Calendar className="size-4 text-muted-foreground" aria-hidden />
            Fri, Nov 14
          </span>
        </Specimen>
        <Specimen label="Icon + small label, 14px">
          <span className="inline-flex items-center gap-2 text-small">
            <Ticket className="size-3.5 text-muted-foreground" aria-hidden />2
            tickets
          </span>
        </Specimen>
      </SpecimenGroup>

      <SpecimenGroup
        title="Elevation"
        spec="§2.6"
        description="Borders separate surfaces. Levels 2 and 3 add shadow-overlay."
        min="12rem"
      >
        <Specimen label="Level 1 · card, border only" bare>
          <div className="w-full rounded-xl border bg-card p-4 text-small">
            Card
          </div>
        </Specimen>
        <Specimen label="Level 2 · overlay-surface" bare>
          <div className="overlay-surface w-full rounded-2xl p-4 text-small">
            Menu / tooltip
          </div>
        </Specimen>
        <Specimen label="Level 3 · scrim + overlay-surface" bare>
          <div className="relative w-full overflow-hidden rounded-2xl bg-muted p-4">
            <div className="absolute inset-0 bg-scrim" />
            <div className="overlay-surface relative rounded-2xl p-4 text-small">
              Dialog
            </div>
          </div>
        </Specimen>
      </SpecimenGroup>

      <SpecimenGroup
        title="Motion"
        spec="§2.8"
        description="One curve, ease-out cubic-bezier(0, 0, 0.2, 1). 150ms for hover and press, 200ms for menus and dialogs, 250ms for toasts."
        min="14rem"
      >
        <MotionDemo duration={150} label="150ms · hover, press" />
        <MotionDemo duration={200} label="200ms · menus, dialogs" />
        <MotionDemo duration={250} label="250ms · toasts" />
      </SpecimenGroup>

      <Composition
        title="Density"
        description="These tokens change with the toolbar's Compact toggle."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { label: "size-control", cls: "h-(--size-control)" },
            { label: "size-table-row", cls: "h-(--size-table-row)" },
            { label: "size-nav-row", cls: "h-(--size-nav-row)" },
          ].map((t) => (
            <Specimen key={t.label} label={t.label} bare>
              <div className={cn("w-full rounded-lg bg-muted", t.cls)} />
            </Specimen>
          ))}
        </div>
      </Composition>
    </div>
  );
}

const section: GallerySection = {
  id: "foundations",
  title: "Foundations",
  spec: "§2",
  layout: "split",
  Component: Foundations,
};

export default section;
