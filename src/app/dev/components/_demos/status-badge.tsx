import { STATUSES, StatusBadge } from "@/components/ui/status-badge";

import { Specimen, SpecimenGroup } from "@/app/dev/_shell/Specimen";

function StatusBadgeDemo() {
  return (
    <div className="flex flex-col gap-8">
      <SpecimenGroup
        title="StatusBadge"
        spec="§3.3, §4.3"
        description="The nine statuses: tone, icon and label, default and large."
      >
        {STATUSES.map((status) => (
          <Specimen key={status} label={status}>
            <StatusBadge status={status} />
            <StatusBadge status={status} size="large" />
          </Specimen>
        ))}
      </SpecimenGroup>
    </div>
  );
}

export default StatusBadgeDemo;
