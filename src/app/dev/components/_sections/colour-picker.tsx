"use client";

import { useState } from "react";

import {
  ColourPicker,
  ColourSwatch,
  CustomColourForm,
} from "@/components/ui/colour-picker";
import {
  DEFAULT_EVENT_COLOUR,
  contrastRatio,
  featuredCardGradient,
  readableTextOn,
  ticketGradient,
} from "@/lib/event-colour";

import { Composition, Specimen, SpecimenGroup } from "../_gallery/Specimen";
import type { GallerySection, SectionProps } from "../_gallery/types";

const noop = () => {};

/** A picker that keeps its own state, as the event builder will. */
function StatefulPicker({
  label,
  initialValue = DEFAULT_EVENT_COLOUR,
  initialCustom = [],
  disabled,
  defaultOpen,
}: {
  label: string;
  initialValue?: string;
  initialCustom?: readonly string[];
  disabled?: boolean;
  defaultOpen?: boolean;
}) {
  const [value, setValue] = useState(initialValue);
  const [custom, setCustom] = useState<string[]>([...initialCustom]);
  return (
    <ColourPicker
      label={label}
      value={value}
      onValueChange={setValue}
      customColours={custom}
      onCustomColoursChange={setCustom}
      disabled={disabled}
      defaultOpen={defaultOpen}
    />
  );
}

const PREVIEW_COLOURS = [
  { name: "Blue", hex: "#325DC4" },
  { name: "Orchid", hex: "#C983C7" },
  { name: "Slate", hex: "#4A5E8A" },
  { name: "Pale yellow", hex: "#FEF3C7" },
] as const;

function GradientPreview({ name, hex }: { name: string; hex: string }) {
  const text = readableTextOn(hex);
  const label = text === "light" ? "#FFFFFF" : "#111111";
  const ratio = contrastRatio(hex, label);
  return (
    <figure
      data-specimen={`Gradients · ${name}`}
      className="m-0 flex min-w-0 flex-col gap-1.5"
    >
      <div className="flex gap-3">
        <div
          className="flex h-28 w-36 flex-col justify-end rounded-xl border border-border-subtle p-3"
          style={{ backgroundImage: ticketGradient(hex), color: label }}
        >
          <span className="text-label">Ticket</span>
          <span className="text-body-medium">Design sprint</span>
        </div>
        <div
          aria-hidden
          className="h-28 flex-1 rounded-xl border border-border-subtle"
          style={{ backgroundImage: featuredCardGradient(hex) }}
        />
      </div>
      <figcaption className="px-1 text-label text-muted-foreground">
        {name} {hex} · {text} text, {ratio.toFixed(1)}:1
      </figcaption>
    </figure>
  );
}

function ColourPickerSection({ open }: SectionProps) {
  return (
    <div className="flex flex-col gap-10">
      <SpecimenGroup
        title="ColourSwatch"
        spec="§3.10"
        description="44px circle with a hairline edge so white and pale colours show. Selected adds a 2px gap and a 2px ring; custom colours carry a 22px remove button. Focus a swatch to see the outline clear the ring."
        min="9rem"
      >
        <Specimen label="Default">
          <ColourSwatch colour="#325DC4" name="Blue" onClick={noop} />
        </Specimen>
        <Specimen label="Selected (aria-pressed)">
          <ColourSwatch colour="#325DC4" name="Blue" selected onClick={noop} />
        </Specimen>
        <Specimen label="Removable">
          <ColourSwatch
            colour="#2F8F6B"
            name="Custom colour #2F8F6B"
            onClick={noop}
            onRemove={noop}
          />
        </Specimen>
        <Specimen label="Removable, selected">
          <ColourSwatch
            colour="#2F8F6B"
            name="Custom colour #2F8F6B"
            selected
            onClick={noop}
            onRemove={noop}
          />
        </Specimen>
        <Specimen label="White (edge)">
          <ColourSwatch colour="#FFFFFF" name="Custom colour #FFFFFF" onClick={noop} />
        </Specimen>
        <Specimen label="Pale yellow, selected">
          <ColourSwatch colour="#FEF3C7" name="Custom colour #FEF3C7" selected onClick={noop} />
        </Specimen>
        <Specimen label="Disabled">
          <ColourSwatch colour="#C983C7" name="Orchid" disabled />
        </Specimen>
      </SpecimenGroup>

      <SpecimenGroup
        title="ColourPicker"
        spec="§3.10"
        description="Presets in order (Blue is the default), custom colours with remove, then the dashed Add. Removing the selected custom colour reverts to Blue. Force the popover with ?open=custom-colour."
        min="16rem"
      >
        <Specimen label="Event colour · two custom, one selected" wide>
          <StatefulPicker
            label="Event colour"
            initialValue="#2F8F6B"
            initialCustom={["#2F8F6B", "#E0A526"]}
            defaultOpen={open === "custom-colour"}
          />
        </Specimen>
        <Specimen label="Header colour · preset selected" wide>
          <StatefulPicker
            label="Header colour"
            initialValue="#4A5E8A"
            initialCustom={["#2F8F6B", "#E0A526"]}
          />
        </Specimen>
        <Specimen label="Default · no custom colours" wide>
          <StatefulPicker label="Event colour" />
        </Specimen>
        <Specimen label="Disabled" wide>
          <StatefulPicker
            label="Event colour"
            initialCustom={["#2F8F6B"]}
            disabled
          />
        </Specimen>
      </SpecimenGroup>

      <SpecimenGroup
        title="Custom colour popover"
        spec="§3.10"
        description="The panel on its own, inline: a valid hex, then the error. Open the real popover with the Add button, or ?open=custom-colour."
        min="17.5rem"
      >
        <Specimen label="Valid hex" bare>
          <div className="w-[280px] overlay-surface rounded-2xl p-4">
            <CustomColourForm
              initialColour="#2F8F6B"
              onUse={noop}
              onCancel={noop}
            />
          </div>
        </Specimen>
        <Specimen label="Invalid hex (error)" bare>
          <div className="w-[280px] overlay-surface rounded-2xl p-4">
            <CustomColourForm
              initialColour="#2F8F6B"
              initialText="#2F8F6"
              onUse={noop}
              onCancel={noop}
            />
          </div>
        </Specimen>
      </SpecimenGroup>

      <Composition
        title="Gradients and readable text"
        description="ticketGradient (45% white tint at the top, the colour at the bottom) with readableTextOn for its label, and featuredCardGradient (135°, colour to tint), which carries no text."
      >
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(20rem,100%),1fr))]">
          {PREVIEW_COLOURS.map((colour) => (
            <GradientPreview key={colour.hex} {...colour} />
          ))}
        </div>
      </Composition>
    </div>
  );
}

const section: GallerySection = {
  id: "colour-picker",
  title: "Colour picker",
  group: "Forms",
  description: "Let an admin pick an event colour from the swatches, or a custom one.",
  importPath: "@/components/ui/colour-picker",
  importNames: ["ColourPicker"],
  spec: "§3.10",
  layout: "split",
  openStates: ["custom-colour"],
  Component: ColourPickerSection,
};

export default section;
