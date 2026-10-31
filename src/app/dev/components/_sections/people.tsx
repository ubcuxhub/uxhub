import { ExternalLink } from "lucide-react";

import { Avatar, AvatarGroup, type AvatarSize } from "@/components/ui/avatar";

import { Composition, Specimen, SpecimenGroup } from "../_gallery/Specimen";
import type { GallerySection } from "../_gallery/types";

const SIZES = [24, 28, 32, 40, 56, 64] as const satisfies readonly AvatarSize[];

const PEOPLE = [
  { name: "Aubrey Lam", src: "/people/aubrey.png" },
  { name: "Brady Wu", src: "/people/brady.jpg" },
  { name: "Carys Evans", src: "/people/carys.jpg" },
  { name: "David Okafor", src: "/people/david.jpg" },
  { name: "Elaine Cho", src: "/people/elaine.jpg" },
  { name: "Quang Tran", src: "/people/quang.jpg" },
] as const;

/** Decodes to nothing, so the image errors without a failed request in the console. */
const BROKEN_SRC = "data:image/png;base64,AAAA";

const GROUP_SIZES = [24, 32, 40] as const;
const GROUP_COUNTS = [3, 4, 6] as const;

function Section() {
  return (
    <div className="flex flex-col gap-8">
      <SpecimenGroup
        title="Photo"
        description="Cropped to fill. Sizes 24, 28 (groups), 32, 40, 56 and 64 (list rows)."
        min="16rem"
      >
        <Specimen label="Sizes 24–64" wide>
          {SIZES.map((size) => (
            <Avatar key={size} name="Aubrey Lam" src="/people/aubrey.png" size={size} />
          ))}
        </Specimen>
      </SpecimenGroup>

      <SpecimenGroup
        title="Initials"
        description="Up to two, SemiBold at about 36% of the avatar."
        min="16rem"
      >
        <Specimen label="Two initials" wide>
          {SIZES.map((size) => (
            <Avatar key={size} name="Alex Chen" size={size} />
          ))}
        </Specimen>
        <Specimen label="Single-word name" wide>
          {SIZES.map((size) => (
            <Avatar key={size} name="Cher" size={size} />
          ))}
        </Specimen>
        <Specimen label="Long name: first and last word only" wide>
          {SIZES.map((size) => (
            <Avatar key={size} name="Maria de la Cruz Hernández Ortiz" size={size} />
          ))}
        </Specimen>
        <Specimen label="Wide capitals" wide>
          {SIZES.map((size) => (
            <Avatar key={size} name="Wendy Mwangi" size={size} />
          ))}
        </Specimen>
        <Specimen label="Accented" wide>
          {SIZES.map((size) => (
            <Avatar key={size} name="Élodie Durand" size={size} />
          ))}
        </Specimen>
      </SpecimenGroup>

      <SpecimenGroup
        title="Anonymous and broken photo"
        description="A deleted user gets a person icon. A src that fails to load falls back to initials."
        min="16rem"
      >
        <Specimen label="anonymous" wide>
          {SIZES.map((size) => (
            <Avatar key={size} name="Deleted user" anonymous size={size} />
          ))}
        </Specimen>
        <Specimen label="Broken src" wide>
          {SIZES.map((size) => (
            <Avatar key={size} name="Priya Patel" src={BROKEN_SRC} size={size} />
          ))}
        </Specimen>
      </SpecimenGroup>

      <SpecimenGroup
        title="AvatarGroup"
        description="Up to four faces, then “+N”, paired with words."
        min="min(21rem, 100%)"
      >
        {GROUP_SIZES.flatMap((size) =>
          GROUP_COUNTS.map((count) => (
            <Specimen key={`${size}-${count}`} label={`${count} people · ${size}px`}>
              <AvatarGroup people={PEOPLE.slice(0, count)} size={size} />
              <span className="whitespace-nowrap text-small text-muted-foreground">
                Team Pixel · {count} members
              </span>
            </Specimen>
          )),
        )}
        <Specimen label="Initials only · 28px (Figma example)">
          <AvatarGroup
            size={28}
            people={[
              { name: "Alex Chen" },
              { name: "Priya Shah" },
              { name: "Sam Okafor" },
              { name: "Mia Park" },
              { name: "Jo Kim" },
              { name: "Kat Ng" },
            ]}
          />
          <span className="whitespace-nowrap text-small text-muted-foreground">
            Team Pixel · 6 members
          </span>
        </Specimen>
      </SpecimenGroup>

      <Composition
        title="List row (§4.1)"
        description="64px avatar, 18px name, role · company, and a link labelled with the person."
      >
        <div className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-background-secondary p-4">
          <div className="flex items-center gap-4">
            <Avatar name="Alex Chen" src="/people/david.jpg" size={64} decorative />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-subheading">Alex Chen</span>
              <span className="text-small text-muted-foreground">
                Senior product designer · Acme
              </span>
            </div>
            <a
              href="#list-row"
              className="inline-flex items-center gap-1 text-small text-primary underline-offset-4 hover:underline"
            >
              Alex Chen on LinkedIn
              <ExternalLink className="size-4" aria-hidden />
            </a>
          </div>
        </div>
      </Composition>

      <Composition
        title="Reviewer note header"
        description="32px avatar, name and time."
      >
        <div className="flex items-center gap-2 rounded-lg border border-border-subtle bg-card p-4">
          <Avatar name="Priya Patel" src="/people/elaine.jpg" size={32} decorative />
          <span className="text-label">Priya Patel</span>
          <span className="text-small text-muted-foreground">Oct 28, 4:12 PM</span>
        </div>
      </Composition>
    </div>
  );
}

const section: GallerySection = {
  id: "people",
  title: "Avatars",
  spec: "§3.9",
  layout: "split",
  Component: Section,
};

export default section;
