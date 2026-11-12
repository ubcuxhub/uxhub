"use client";

import { DetailList, DetailRow } from "@/components/shared/DetailRow";

import { Specimen, SpecimenGroup } from "@/app/dev/_shell/Specimen";

function DetailRowDemo() {
  return (
    <div className="flex flex-col gap-8">
      <SpecimenGroup
        title="Detail rows"
        spec="§3.15"
        description="Details are text, not disabled fields. A DetailList wraps the rows in a description list; a row with no value shows a dash and says “None” to screen readers."
      >
        <Specimen label="Detail rows" className="w-md">
          <DetailList className="rounded-xl border border-border-subtle bg-card px-4">
            <DetailRow label="Email">jane.smith@example.com</DetailRow>
            <DetailRow label="Phone" />
            <DetailRow label="Membership">Innovator</DetailRow>
          </DetailList>
        </Specimen>
      </SpecimenGroup>
    </div>
  );
}

export default DetailRowDemo;
