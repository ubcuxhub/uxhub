import { Separator } from "@/components/ui/separator";

import { Specimen, SpecimenGroup } from "@/app/dev/_shell/Specimen";

function SeparatorDemo() {
  return (
    <div className="flex flex-col gap-8">
      <SpecimenGroup title="Separator" spec="§2.1" min="14rem">
        <Specimen label="horizontal">
          <Separator />
        </Specimen>
        <Specimen label="vertical">
          <div className="flex h-8 items-center gap-3 text-small">
            Events
            <Separator orientation="vertical" />
            Members
            <Separator orientation="vertical" />
            Settings
          </div>
        </Specimen>
      </SpecimenGroup>
    </div>
  );
}

export default SeparatorDemo;
