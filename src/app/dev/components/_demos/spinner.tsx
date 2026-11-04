"use client";

import { Spinner } from "@/components/ui/spinner";

import { Specimen, SpecimenGroup } from "@/app/dev/_shell/Specimen";

function SpinnerDemo() {
  return (
    <div className="flex flex-col gap-8">
      <SpecimenGroup
        title="Spinner"
        spec="§3.1"
        description="Decorative by default (aria-hidden). With a label it is a status region."
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

export default SpinnerDemo;
