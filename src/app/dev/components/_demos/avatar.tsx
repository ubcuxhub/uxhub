import { Avatar, AvatarGroup, type AvatarSize } from "@/components/ui/avatar";

import { Composition, Specimen, SpecimenGroup } from "@/app/dev/_shell/Specimen";

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

function AvatarDemo() {
  return (
    <div className="flex flex-col gap-8">
      <SpecimenGroup
        title="Photo"
        description="Cropped to fill. Sizes 24, 28 (groups), 32, 40, 56 and 64 (list rows)."
      >
        <Specimen label="Sizes 24–64">
          {SIZES.map((size) => (
            <Avatar key={size} name="Aubrey Lam" src="/people/aubrey.png" size={size} />
          ))}
        </Specimen>
      </SpecimenGroup>

      <SpecimenGroup
        title="Initials"
        description="Up to two, SemiBold at about 36% of the avatar."
      >
        <Specimen label="Two initials">
          {SIZES.map((size) => (
            <Avatar key={size} name="Alex Chen" size={size} />
          ))}
        </Specimen>
        <Specimen label="Single-word name">
          {SIZES.map((size) => (
            <Avatar key={size} name="Cher" size={size} />
          ))}
        </Specimen>
        <Specimen label="Long name: first and last word only">
          {SIZES.map((size) => (
            <Avatar key={size} name="Maria de la Cruz Hernández Ortiz" size={size} />
          ))}
        </Specimen>
        <Specimen label="Wide capitals">
          {SIZES.map((size) => (
            <Avatar key={size} name="Wendy Mwangi" size={size} />
          ))}
        </Specimen>
        <Specimen label="Accented">
          {SIZES.map((size) => (
            <Avatar key={size} name="Élodie Durand" size={size} />
          ))}
        </Specimen>
      </SpecimenGroup>

      <SpecimenGroup
        title="Anonymous and broken photo"
        description="A deleted user gets a person icon. A src that fails to load falls back to initials."
      >
        <Specimen label="anonymous">
          {SIZES.map((size) => (
            <Avatar key={size} name="Deleted user" anonymous size={size} />
          ))}
        </Specimen>
        <Specimen label="Broken src">
          {SIZES.map((size) => (
            <Avatar key={size} name="Priya Patel" src={BROKEN_SRC} size={size} />
          ))}
        </Specimen>
      </SpecimenGroup>

      <SpecimenGroup
        title="AvatarGroup"
        description="Up to four faces, then “+N”, paired with words."
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

export default AvatarDemo;
