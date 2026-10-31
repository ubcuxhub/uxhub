"use client";

import Link from "next/link";
import {
  ArrowRight,
  Download,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Spinner } from "@/components/ui/spinner";

import { Specimen, SpecimenGroup } from "../_gallery/Specimen";
import type { GallerySection } from "../_gallery/types";

const VARIANTS = ["primary", "secondary", "destructive", "ghost", "link"] as const;
const ICON_VARIANTS = ["primary", "secondary", "destructive", "ghost"] as const;
const SIZES = ["md", "sm"] as const;
const ICON_SIZES = ["icon", "icon-sm"] as const;

function Buttons() {
  return (
    <div className="flex flex-col gap-8">
      <SpecimenGroup
        title="Button · variant × size"
        spec="§3.1"
        description="md is 40px (44px on phones, matching inputs), sm is 32px. Link has no height or padding. Hover, pressed and focus are checked interactively (or in the forced-state group below)."
        min="9rem"
      >
        {VARIANTS.flatMap((variant) =>
          SIZES.map((size) => (
            <Specimen key={`${variant}-${size}`} label={`${variant} / ${size}`}>
              <Button variant={variant} size={size}>
                Label
              </Button>
            </Specimen>
          )),
        )}
        {ICON_VARIANTS.flatMap((variant) =>
          ICON_SIZES.map((size) => (
            <Specimen key={`${variant}-${size}`} label={`${variant} / ${size}`}>
              <Button variant={variant} size={size} aria-label="Add">
                <Plus />
              </Button>
            </Specimen>
          )),
        )}
      </SpecimenGroup>

      <SpecimenGroup
        title="Button · with icon"
        description="16px icon (14px at sm), 8px gap (6px at sm). Leading and trailing."
        min="12rem"
      >
        {VARIANTS.filter((v) => v !== "link").flatMap((variant) =>
          SIZES.map((size) => (
            <Specimen
              key={`${variant}-${size}`}
              label={`${variant} / ${size} / leading icon`}
            >
              <Button variant={variant} size={size}>
                <Download />
                Download
              </Button>
            </Specimen>
          )),
        )}
        <Specimen label="secondary / md / trailing icon">
          <Button variant="secondary">
            Continue
            <ArrowRight />
          </Button>
        </Specimen>
        <Specimen label="secondary / sm / trailing icon">
          <Button variant="secondary" size="sm">
            Edit
            <Pencil />
          </Button>
        </Specimen>
        <Specimen label="destructive / md / leading icon">
          <Button variant="destructive">
            <Trash2 />
            Delete event
          </Button>
        </Specimen>
        <Specimen label="link / leading icon">
          <Button variant="link">
            <ArrowRight />
            Read more
          </Button>
        </Specimen>
      </SpecimenGroup>

      <SpecimenGroup
        title="Button · row alignment"
        description="Every size in one row: edges should line up on the centre line."
        min="100%"
      >
        <Specimen label="md, sm, icon, icon-sm side by side" wide>
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button size="sm">Small</Button>
          <Button size="sm" variant="secondary">
            <Plus />
            Small
          </Button>
          <Button size="icon" variant="secondary" aria-label="Edit">
            <Pencil />
          </Button>
          <Button size="icon-sm" variant="secondary" aria-label="Close">
            <X />
          </Button>
          <Button size="icon" variant="ghost" aria-label="Edit">
            <Pencil />
          </Button>
          <Button variant="ghost">Clear</Button>
        </Specimen>
        <Specimen label="Dialog footer: Secondary + Primary / Secondary + Destructive" wide>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary">Keep event</Button>
            <Button variant="destructive">Delete event</Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary">Cancel</Button>
            <Button>Save changes</Button>
          </div>
        </Specimen>
      </SpecimenGroup>

      <SpecimenGroup
        title="Button · hover and pressed (forced)"
        description="The hover and pressed fills applied by class, so they can be reviewed without a pointer. Real hover and pressed use the same tokens."
        min="10rem"
      >
        <Specimen label="primary / hover">
          <Button className="bg-primary-hover">Label</Button>
        </Specimen>
        <Specimen label="primary / pressed">
          <Button className="bg-primary-active">Label</Button>
        </Specimen>
        <Specimen label="secondary / hover">
          <Button variant="secondary" className="bg-muted">
            Label
          </Button>
        </Specimen>
        <Specimen label="secondary / pressed">
          <Button variant="secondary" className="bg-border-subtle">
            Label
          </Button>
        </Specimen>
        <Specimen label="destructive / hover">
          <Button variant="destructive" className="bg-destructive-hover">
            Label
          </Button>
        </Specimen>
        <Specimen label="destructive / pressed">
          <Button variant="destructive" className="bg-destructive-active">
            Label
          </Button>
        </Specimen>
        <Specimen label="ghost / hover">
          <Button variant="ghost" className="bg-muted">
            Label
          </Button>
        </Specimen>
        <Specimen label="ghost / pressed">
          <Button variant="ghost" className="bg-border-subtle">
            Label
          </Button>
        </Specimen>
        <Specimen label="link / hover">
          <Button variant="link" className="underline">
            Label
          </Button>
        </Specimen>
        <Specimen label="focus-visible (forced)">
          <Button className="focus-ring">Label</Button>
        </Specimen>
        <Specimen label="secondary icon / focus-visible (forced)">
          <Button
            variant="secondary"
            size="icon"
            aria-label="Edit"
            className="focus-ring"
          >
            <Pencil />
          </Button>
        </Specimen>
      </SpecimenGroup>

      <SpecimenGroup
        title="Button · disabled"
        description="Disabled fill, edge and label tokens. Ghost and link only grey the label."
        min="9rem"
      >
        {VARIANTS.flatMap((variant) =>
          SIZES.map((size) => (
            <Specimen
              key={`${variant}-${size}`}
              label={`${variant} / ${size} / disabled`}
            >
              <Button variant={variant} size={size} disabled>
                Label
              </Button>
            </Specimen>
          )),
        )}
        {ICON_VARIANTS.map((variant) => (
          <Specimen key={variant} label={`${variant} / icon / disabled`}>
            <Button variant={variant} size="icon" disabled aria-label="Add">
              <Plus />
            </Button>
          </Specimen>
        ))}
        <Specimen label="asChild link / aria-disabled">
          <Button asChild aria-disabled="true">
            <Link href="/dev/components" tabIndex={-1}>
              Link as button
            </Link>
          </Button>
        </Specimen>
      </SpecimenGroup>

      <SpecimenGroup
        title="Button · loading"
        description="The spinner replaces the label in place and the width does not change. The button keeps its colours and is disabled with aria-busy."
        min="9rem"
      >
        {VARIANTS.filter((v) => v !== "link").flatMap((variant) =>
          SIZES.map((size) => (
            <Specimen
              key={`${variant}-${size}`}
              label={`${variant} / ${size} / loading`}
            >
              <Button variant={variant} size={size} loading>
                Save changes
              </Button>
            </Specimen>
          )),
        )}
        {ICON_VARIANTS.filter((v) => v !== "ghost").map((variant) => (
          <Specimen key={variant} label={`${variant} / icon / loading`}>
            <Button variant={variant} size="icon" loading aria-label="Download">
              <Download />
            </Button>
          </Specimen>
        ))}
        <Specimen label="same label, loading off / on" wide>
          <Button variant="secondary">Save changes</Button>
          <Button variant="secondary" loading>
            Save changes
          </Button>
        </Specimen>
      </SpecimenGroup>

      <SpecimenGroup title="Button · aliases" min="9rem">
        <Specimen label="default (= primary)">
          <Button variant="default">Label</Button>
        </Specimen>
        <Specimen label="outline (= secondary)">
          <Button variant="outline">Label</Button>
        </Specimen>
        <Specimen label="size=default (= md)">
          <Button size="default" variant="secondary">
            Label
          </Button>
        </Specimen>
        <Specimen label="outline / icon">
          <Button variant="outline" size="icon" aria-label="Edit">
            <Pencil />
          </Button>
        </Specimen>
        <Specimen label="no props">
          <Button>Label</Button>
        </Specimen>
      </SpecimenGroup>

      <SpecimenGroup title="Button · other" min="12rem">
        <Specimen label="secondary icon / aria-pressed=true">
          <Button
            variant="secondary"
            size="icon"
            aria-pressed="true"
            aria-label="Edit"
          >
            <Pencil />
          </Button>
        </Specimen>
        <Specimen label="secondary icon / aria-pressed=false">
          <Button
            variant="secondary"
            size="icon"
            aria-pressed="false"
            aria-label="Edit"
          >
            <Pencil />
          </Button>
        </Specimen>
        <Specimen label="asChild link (primary)">
          <Button asChild>
            <Link href="/dev/components">Link as button</Link>
          </Button>
        </Specimen>
        <Specimen label="asChild link (secondary)">
          <Button asChild variant="secondary">
            <Link href="/dev/components">Link as button</Link>
          </Button>
        </Specimen>
        <Specimen label="IconButton (hover for tooltip)">
          <IconButton label="Edit user">
            <Pencil />
          </IconButton>
          <IconButton label="Close" variant="ghost">
            <X />
          </IconButton>
          <IconButton label="Close" size="icon-sm">
            <X />
          </IconButton>
          <IconButton label="Add" disabled>
            <Plus />
          </IconButton>
        </Specimen>
        <Specimen label="full width (w-full)" wide>
          <Button className="w-full">Continue to payment</Button>
        </Specimen>
        <Specimen label="long label inside max-w-xs" className="max-w-xs">
          <Button variant="secondary" className="max-w-full">
            <span className="truncate">Register for UXathon 2026 as a member</span>
          </Button>
        </Specimen>
      </SpecimenGroup>

      <SpecimenGroup
        title="Spinner"
        description="Decorative by default (aria-hidden). With a label it is a status region."
        min="8rem"
      >
        {(["sm", "md", "lg"] as const).map((size) => (
          <Specimen key={size} label={`size=${size}`}>
            <Spinner size={size} />
          </Specimen>
        ))}
        <Specimen label="label=“Loading events”">
          <Spinner label="Loading events" />
        </Specimen>
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
