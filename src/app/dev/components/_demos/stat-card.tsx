import { StatCard } from "@/components/ui/stat-card";

import { Specimen, SpecimenGroup } from "@/app/dev/_shell/Specimen";

function StatCardDemo() {
  return (
    <div className="flex flex-col gap-8">
      <SpecimenGroup
        title="StatCard"
        spec="§3.5"
        description="A dashboard number, its neutral context, and honest empty and loading states."
        className="items-stretch"
      >
        <Specimen label="Count and context" className="w-56"><StatCard label="Checked in" kind="count" count={12} total={48} noun="going" showRate/></Specimen>
        <Specimen label="Count without rate" className="w-56"><StatCard label="Not checked in" kind="count" count={36} total={48} noun="going"/></Specimen>
        <Specimen label="Zero attendees" className="w-56"><StatCard label="Checked in" kind="count" count={0} total={0} noun="going" showRate/></Specimen>
        <Specimen label="Value" className="w-56">
          <StatCard
            className="h-full w-full"
            label="Active members"
            kind="value"
            value={312}
            change={{ delta: 24, period: "since last term" }}
          />
        </Specimen>
        <Specimen label="Rate" className="w-56">
          <StatCard
            className="h-full w-full"
            label="Active members"
            kind="rate"
            count={412}
            total={528}
            noun="registrants"
          />
        </Specimen>
        <Specimen label="Not enough data" className="w-56">
          <StatCard
            className="h-full w-full"
            label="Active members"
            kind="insufficient"
            reason="Fewer than 3 sponsors this term."
          />
        </Specimen>
        <Specimen label="Loading" className="w-56">
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
