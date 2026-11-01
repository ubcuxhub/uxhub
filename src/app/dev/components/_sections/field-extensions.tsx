"use client";

import { useId, useState } from "react";
import { Mail, Search } from "lucide-react";

import {
  Field,
  FieldError,
  FieldLabel,
  FieldLabelRow,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";

import { Composition, Specimen, SpecimenGroup } from "../_gallery/Specimen";
import type { GallerySection } from "../_gallery/types";

/** The focus ring a keyboard user sees, forced on so it can be looked at. */
const FORCED_FOCUS = "focus-ring";
const FORCED_THUMB_FOCUS =
  "[&_input::-webkit-slider-thumb]:shadow-none [&_input::-webkit-slider-thumb]:focus-ring [&_input::-moz-range-thumb]:shadow-none [&_input::-moz-range-thumb]:focus-ring";

const DESCRIPTION =
  "A three-week design sprint for UBC students, from problem statement to final pitch.";

function FieldExtensions() {
  const uid = useId();
  const id = (name: string) => `${uid}-${name}`;
  const [zoom, setZoom] = useState(140);

  return (
    <div className="flex flex-col gap-8">
      <SpecimenGroup
        title="Input with a leading icon"
        spec="§3.2"
        description="A 16px icon, 20px in from the edge, text starting at 44px. The icon is decorative; the label names the field."
        min="17rem"
      >
        <Specimen label="Mail · default">
          <Field>
            <FieldLabel htmlFor={id("mail-default")}>Email address</FieldLabel>
            <Input
              id={id("mail-default")}
              leadingIcon={Mail}
              placeholder="name@student.ubc.ca"
            />
          </Field>
        </Specimen>
        <Specimen label="Mail · filled">
          <Field>
            <FieldLabel htmlFor={id("mail-filled")}>Email address</FieldLabel>
            <Input
              id={id("mail-filled")}
              leadingIcon={Mail}
              defaultValue="name@student.ubc.ca"
            />
          </Field>
        </Specimen>
        <Specimen label="Mail · focus (ring forced on)">
          <Field>
            <FieldLabel htmlFor={id("mail-focus")}>Email address</FieldLabel>
            <Input
              id={id("mail-focus")}
              leadingIcon={Mail}
              defaultValue="name@student.ubc.ca"
              className={FORCED_FOCUS}
            />
          </Field>
        </Specimen>
        <Specimen label="Mail · error">
          <Field>
            <FieldLabel htmlFor={id("mail-error")}>Email address</FieldLabel>
            <Input
              id={id("mail-error")}
              leadingIcon={Mail}
              defaultValue="name@student"
              aria-invalid
              aria-describedby={id("mail-error-text")}
            />
            <FieldError id={id("mail-error-text")}>
              Enter an email address like name@student.ubc.ca.
            </FieldError>
          </Field>
        </Specimen>
        <Specimen label="Mail · disabled">
          <Field>
            <FieldLabel htmlFor={id("mail-disabled")}>Email address</FieldLabel>
            <Input
              id={id("mail-disabled")}
              leadingIcon={Mail}
              defaultValue="name@student.ubc.ca"
              disabled
            />
          </Field>
        </Specimen>

        <Specimen label="Search · default">
          <Input
            aria-label="Search users"
            leadingIcon={Search}
            type="search"
            placeholder="Search users"
          />
        </Specimen>
        <Specimen label="Search · filled">
          <Input
            aria-label="Search users"
            leadingIcon={Search}
            type="search"
            defaultValue="Alex Chen"
          />
        </Specimen>
        <Specimen label="Search · focus (ring forced on)">
          <Input
            aria-label="Search users"
            leadingIcon={Search}
            type="search"
            defaultValue="Alex Chen"
            className={FORCED_FOCUS}
          />
        </Specimen>
        <Specimen label="Search · error">
          <Input
            aria-label="Search users"
            leadingIcon={Search}
            type="search"
            defaultValue="@@"
            aria-invalid
          />
        </Specimen>
        <Specimen label="Search · disabled">
          <Input
            aria-label="Search users"
            leadingIcon={Search}
            type="search"
            placeholder="Search users"
            disabled
          />
        </Specimen>
      </SpecimenGroup>

      <SpecimenGroup
        title="Label row with an action"
        spec="§3.2"
        description="Label first in the DOM, then the action: Tab goes label action, then the input. Passwords have no placeholder."
        min="17rem"
      >
        <Specimen label="Sign-in password">
          <Field>
            <FieldLabelRow
              action={
                <a
                  href="#forgot-password"
                  className="rounded-sm text-small text-primary underline-offset-4 hover:underline focus-visible:focus-ring"
                >
                  Forgot password?
                </a>
              }
            >
              <FieldLabel htmlFor={id("password")}>Password</FieldLabel>
            </FieldLabelRow>
            <Input
              id={id("password")}
              type="password"
              autoComplete="current-password"
            />
          </Field>
        </Specimen>
        <Specimen label="No action (label alone)">
          <Field>
            <FieldLabelRow>
              <FieldLabel htmlFor={id("name")}>Full name</FieldLabel>
            </FieldLabelRow>
            <Input id={id("name")} defaultValue="Johnny Dong" />
          </Field>
        </Specimen>
      </SpecimenGroup>

      <SpecimenGroup
        title="Textarea with a counter"
        spec="§3.12"
        description="showCount with maxLength. The counter goes red on an invalid field and at the limit; the screen-reader line speaks at 20 left or fewer. 120px tall here to match Figma (the default stays min-h-20)."
        min="19rem"
      >
        <Specimen label="Filled · 83/280">
          <Field>
            <FieldLabel htmlFor={id("ta-filled")}>Short description</FieldLabel>
            <Textarea
              id={id("ta-filled")}
              className="min-h-30"
              maxLength={280}
              showCount
              defaultValue={DESCRIPTION}
            />
          </Field>
        </Specimen>
        <Specimen label="Focus (ring forced on)">
          <Field>
            <FieldLabel htmlFor={id("ta-focus")}>Short description</FieldLabel>
            <Textarea
              id={id("ta-focus")}
              className={`min-h-30 ${FORCED_FOCUS}`}
              maxLength={280}
              showCount
              defaultValue={DESCRIPTION}
            />
          </Field>
        </Specimen>
        <Specimen label="Placeholder · 0/280">
          <Field>
            <FieldLabel htmlFor={id("ta-empty")}>Short description</FieldLabel>
            <Textarea
              id={id("ta-empty")}
              className="min-h-30"
              maxLength={280}
              showCount
              placeholder="For example, what attendees will make or learn"
            />
          </Field>
        </Specimen>
        <Specimen label="Error · counter red">
          <Field>
            <FieldLabel htmlFor={id("ta-error")}>Short description</FieldLabel>
            <Textarea
              id={id("ta-error")}
              className="min-h-30"
              maxLength={280}
              showCount
              aria-invalid
            />
            <FieldError>Add a short description.</FieldError>
          </Field>
        </Specimen>
        <Specimen label="Disabled">
          <Field>
            <FieldLabel htmlFor={id("ta-disabled")}>Short description</FieldLabel>
            <Textarea
              id={id("ta-disabled")}
              className="min-h-30"
              maxLength={280}
              showCount
              disabled
              defaultValue="Registration is closed for this event."
            />
          </Field>
        </Specimen>
        <Specimen label="Near the limit · 59/60, type one more character">
          <Field>
            <FieldLabel htmlFor={id("ta-limit")}>Tagline</FieldLabel>
            <Textarea
              id={id("ta-limit")}
              maxLength={60}
              showCount
              defaultValue="Three weeks, one problem statement, and a pitch at the end."
            />
          </Field>
        </Specimen>
      </SpecimenGroup>

      <SpecimenGroup
        title="Slider"
        spec="§3.17"
        description="A native range input: arrows ±1 step, Page Up/Down ±10 steps, Home/End. The value reads out on the right and as aria-valuetext."
        min="19rem"
      >
        <Specimen label="Default · 140%">
          <div className="flex w-full items-center gap-4">
            <span id={id("zoom-default")} className="text-label">
              Zoom
            </span>
            <Slider
              aria-labelledby={id("zoom-default")}
              min={100}
              max={300}
              step={10}
              defaultValue={140}
              formatValue={(value) => `${value}%`}
            />
          </div>
        </Specimen>
        <Specimen label="Focus (ring forced on)">
          <div className="flex w-full items-center gap-4">
            <span id={id("zoom-focus")} className="text-label">
              Zoom
            </span>
            <Slider
              aria-labelledby={id("zoom-focus")}
              className={FORCED_THUMB_FOCUS}
              min={100}
              max={300}
              step={10}
              defaultValue={140}
              formatValue={(value) => `${value}%`}
            />
          </div>
        </Specimen>
        <Specimen label="Disabled">
          <div className="flex w-full items-center gap-4">
            <span id={id("zoom-disabled")} className="text-label text-disabled-foreground">
              Zoom
            </span>
            <Slider
              aria-labelledby={id("zoom-disabled")}
              min={100}
              max={300}
              step={10}
              defaultValue={140}
              formatValue={(value) => `${value}%`}
              disabled
            />
          </div>
        </Specimen>
        <Specimen label="At min · 100% / at max · 300%">
          <div className="flex w-full flex-col">
            <Slider
              aria-label="Zoom at minimum"
              min={100}
              max={300}
              step={10}
              defaultValue={100}
              formatValue={(value) => `${value}%`}
            />
            <Slider
              aria-label="Zoom at maximum"
              min={100}
              max={300}
              step={10}
              defaultValue={300}
              formatValue={(value) => `${value}%`}
            />
          </div>
        </Specimen>
      </SpecimenGroup>

      <Composition
        title="Crop dialog zoom"
        description="The live preview follows the thumb while you drag or press keys."
      >
        <div className="flex max-w-md flex-col gap-4 rounded-xl border border-border-subtle bg-card p-4">
          <div className="flex h-32 items-center justify-center overflow-hidden rounded-lg bg-muted">
            <div
              className="size-20 rounded-lg bg-primary transition-transform duration-100"
              style={{ transform: `scale(${zoom / 100})` }}
            />
          </div>
          <div className="flex items-center gap-4">
            <span id={id("zoom-live")} className="text-label">
              Zoom
            </span>
            <Slider
              aria-labelledby={id("zoom-live")}
              min={100}
              max={300}
              step={10}
              value={zoom}
              onValueChange={setZoom}
              formatValue={(value) => `${value}%`}
            />
          </div>
        </div>
      </Composition>
    </div>
  );
}

const section: GallerySection = {
  id: "field-extensions",
  title: "Field extensions and slider",
  group: "Forms",
  description: "Add-ons for a field (a leading icon, an action in the label row, a character counter) and the Slider.",
  spec: "§3.2, §3.12, §3.17",
  layout: "split",
  Component: FieldExtensions,
};

export default section;
