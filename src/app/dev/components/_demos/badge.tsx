import { CircleAlert, CircleCheck, CircleMinus, Hourglass, Info, Tag } from "lucide-react";

import { Badge } from "@/components/ui/badge";

import { Specimen, SpecimenGroup } from "@/app/dev/_shell/Specimen";

const TONES = ["success", "warning", "error", "info", "neutral", "tag"] as const;

const ALIASES = [
  { alias: "default", tone: "info" },
  { alias: "secondary", tone: "neutral" },
  { alias: "destructive", tone: "error" },
  { alias: "outline", tone: "tag" },
] as const;

const TONE_ICONS = {
  success: CircleCheck,
  warning: Hourglass,
  error: CircleAlert,
  info: Info,
  neutral: CircleMinus,
  tag: Tag,
} as const;

/** Tones callers still compose by hand (AdminEventsTable, EventTicket); their classes win. */
const CALLER_TONES = [
  { variant: "outline", label: "outline + bg-success", cls: "border-transparent bg-success text-success-foreground" },
  { variant: "secondary", label: "secondary + bg-success", cls: "bg-success text-success-foreground" },
  { variant: "destructive", label: "destructive (Draft)", cls: "" },
  { variant: "outline", label: "outline + info tag", cls: "border-info-foreground bg-info text-info-foreground" },
] as const;

function BadgeDemo() {
  return (
    <div className="flex flex-col gap-8">
      <SpecimenGroup
        title="Badge"
        spec="§3.3, §3.15"
        description="One variant prop. Default and large, each with and without a 14px icon."
      >
        {TONES.map((tone) => {
          const Icon = TONE_ICONS[tone];
          return (
            <Specimen key={tone} label={tone}>
              <Badge variant={tone}>Label</Badge>
              <Badge variant={tone}>
                <Icon aria-hidden />
                Label
              </Badge>
              <Badge variant={tone} size="large">
                Label
              </Badge>
              <Badge variant={tone} size="large">
                <Icon aria-hidden />
                Label
              </Badge>
            </Specimen>
          );
        })}
      </SpecimenGroup>

      <SpecimenGroup
        title="Badge aliases"
        description="The shadcn names still work and map to a tone, so no call site changes."
      >
        {ALIASES.map(({ alias, tone }) => (
          <Specimen key={alias} label={`${alias} = ${tone}`}>
            <Badge variant={alias}>Label</Badge>
            <Badge variant={tone}>Label</Badge>
          </Specimen>
        ))}
        {CALLER_TONES.map(({ variant, label, cls }) => (
          <Specimen key={label} label={`caller: ${label}`}>
            <Badge variant={variant} className={cls}>
              Label
            </Badge>
          </Specimen>
        ))}
      </SpecimenGroup>
    </div>
  );
}

export default BadgeDemo;
