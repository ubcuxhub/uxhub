import { StatCard } from "@/components/ui/stat-card";

import { Specimen, SpecimenGroup } from "@/app/dev/_shell/Specimen";

function StatCardDemo() {
  return (
    <div className="flex flex-col gap-8">
      <SpecimenGroup
        title="StatCard"
        spec="§3.5"
        description="A dashboard number, its neutral context, and honest empty and loading states."
        min="9rem"
        className="grid-cols-2 lg:grid-cols-4"
      >
        <Specimen label="Value" bare className="h-full">
          <StatCard
            className="h-full w-full"
            label="Active members"
            kind="value"
            value={312}
            change={{ delta: 24, period: "since last term" }}
          />
        </Specimen>
        <Specimen label="Rate" bare className="h-full">
          <StatCard
            className="h-full w-full"
            label="Active members"
            kind="rate"
            count={412}
            total={528}
            noun="registrants"
          />
        </Specimen>
        <Specimen label="Not enough data" bare className="h-full">
          <StatCard
            className="h-full w-full"
            label="Active members"
            kind="insufficient"
            reason="Fewer than 3 sponsors this term."
          />
        </Specimen>
        <Specimen label="Loading" bare className="h-full">
          <StatCard
            className="h-full w-full"
            label="Active members"
            kind="loading"
          />
        </Specimen>
      </SpecimenGroup>
    </div>
  );
}

export default StatCardDemo;
