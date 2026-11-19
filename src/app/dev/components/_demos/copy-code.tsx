import { CopyCode } from "@/components/shared/CopyCode";

import { Specimen, SpecimenGroup } from "@/app/dev/_shell/Specimen";

function CopyCodeDemo() {
  return (
    <div className="flex flex-col gap-8">
      <SpecimenGroup title="CopyCode" spec="§2.10">
        <Specimen label="default (click to copy)">
          <CopyCode code="UXHUB-2026" />
        </Specimen>
        <Specimen label="Narrow meeting location cell (long value)">
          <div className="w-36"><CopyCode code="LONG-MEETING-PASSCODE-123456789" label="Copy meeting passcode" /></div>
        </Specimen>
      </SpecimenGroup>
    </div>
  );
}

export default CopyCodeDemo;
