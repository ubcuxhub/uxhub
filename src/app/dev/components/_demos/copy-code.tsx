import { CopyCode } from "@/components/shared/CopyCode";

import { Specimen, SpecimenGroup } from "@/app/dev/_shell/Specimen";

function CopyCodeDemo() {
  return (
    <div className="flex flex-col gap-8">
      <SpecimenGroup title="CopyCode" spec="§2.10">
        <Specimen label="default (click to copy)">
          <CopyCode code="UXHUB-2026" />
        </Specimen>
      </SpecimenGroup>
    </div>
  );
}

export default CopyCodeDemo;
