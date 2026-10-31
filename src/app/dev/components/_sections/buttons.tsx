"use client";

import Link from "next/link";
import { Download, Pencil, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

import { Specimen, SpecimenGroup } from "../_gallery/Specimen";
import type { GallerySection } from "../_gallery/types";

const VARIANTS = [
  "default",
  "destructive",
  "outline",
  "secondary",
  "ghost",
  "link",
] as const;

function Buttons() {
  return (
    <div className="flex flex-col gap-8">
      <SpecimenGroup
        title="Button · variant × size"
        spec="§3.1"
        description="Every current variant at both sizes. Hover, pressed and focus are checked interactively."
        min="12rem"
      >
        {VARIANTS.map((variant) => (
          <Specimen key={`${variant}-default`} label={`${variant} / default`}>
            <Button variant={variant}>Label</Button>
          </Specimen>
        ))}
        {VARIANTS.map((variant) => (
          <Specimen key={`${variant}-icon`} label={`${variant} / icon`}>
            <Button variant={variant} size="icon" aria-label="Add">
              <Plus />
            </Button>
          </Specimen>
        ))}
      </SpecimenGroup>

      <SpecimenGroup
        title="Button · with icon"
        description="Leading and trailing icons beside a label."
        min="12rem"
      >
        {VARIANTS.map((variant) => (
          <Specimen key={variant} label={`${variant} / leading icon`}>
            <Button variant={variant}>
              <Download />
              Download
            </Button>
          </Specimen>
        ))}
        <Specimen label="outline / trailing icon">
          <Button variant="outline">
            Edit
            <Pencil />
          </Button>
        </Specimen>
        <Specimen label="destructive / leading icon">
          <Button variant="destructive">
            <Trash2 />
            Delete event
          </Button>
        </Specimen>
      </SpecimenGroup>

      <SpecimenGroup title="Button · disabled" min="12rem">
        {VARIANTS.map((variant) => (
          <Specimen key={variant} label={`${variant} / disabled`}>
            <Button variant={variant} disabled>
              Label
            </Button>
          </Specimen>
        ))}
        {(["default", "outline", "ghost"] as const).map((variant) => (
          <Specimen key={variant} label={`${variant} / icon / disabled`}>
            <Button variant={variant} size="icon" disabled aria-label="Add">
              <Plus />
            </Button>
          </Specimen>
        ))}
      </SpecimenGroup>

      <SpecimenGroup
        title="Button · other states"
        min="12rem"
      >
        <Specimen label="outline icon / aria-pressed=true">
          <Button variant="outline" size="icon" aria-pressed="true" aria-label="Edit">
            <Pencil />
          </Button>
        </Specimen>
        <Specimen label="outline icon / aria-pressed=false">
          <Button variant="outline" size="icon" aria-pressed="false" aria-label="Edit">
            <Pencil />
          </Button>
        </Specimen>
        <Specimen label="asChild link (default)">
          <Button asChild>
            <Link href="/dev/components">Link as button</Link>
          </Button>
        </Specimen>
        <Specimen label="asChild link (outline)">
          <Button asChild variant="outline">
            <Link href="/dev/components">Link as button</Link>
          </Button>
        </Specimen>
        <Specimen label="pending today: disabled + Spinner">
          <Button disabled>
            <Spinner size="sm" className="text-primary-foreground" />
            Saving
          </Button>
        </Specimen>
        <Specimen label="pending today: outline + Spinner">
          <Button variant="outline" disabled>
            <Spinner size="sm" />
            Saving
          </Button>
        </Specimen>
        <Specimen label="full width (w-full)" wide>
          <Button className="w-full">Continue to payment</Button>
        </Specimen>
        <Specimen label="long label (whitespace-nowrap)" className="max-w-xs">
          <Button variant="outline" className="max-w-full">
            <span className="truncate">Register for UXathon 2026 as a member</span>
          </Button>
        </Specimen>
      </SpecimenGroup>

      <SpecimenGroup
        title="Spinner"
        description="Standalone, sm / md (default) / lg."
        min="8rem"
      >
        {(["sm", "md", "lg"] as const).map((size) => (
          <Specimen key={size} label={`size=${size}`}>
            <Spinner size={size} />
          </Specimen>
        ))}
      </SpecimenGroup>
    </div>
  );
}

const section: GallerySection = {
  id: "buttons",
  title: "Buttons",
  spec: "§3.1",
  layout: "split",
  Component: Buttons,
};

export default section;
