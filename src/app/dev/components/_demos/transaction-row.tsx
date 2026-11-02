"use client";

import { TransactionRow } from "@/components/shared/TransactionRow";

import { Specimen, SpecimenGroup } from "@/app/dev/_shell/Specimen";

const membershipMedia = <div className="size-full bg-ux-hub" />;
const awardMedia = (
  <div className="size-full bg-linear-to-br from-slate-600 to-slate-400" />
);

function TransactionRowDemo() {
  return (
    <div className="flex flex-col gap-8">
      <SpecimenGroup
        title="Payment and credit"
        spec="§3.15"
        min="min(28rem, 100%)"
        description="Transactions show a sign, colour and spoken charge or credit cue."
      >
        <Specimen label="Payment and credit" bare>
          <div className="flex w-full flex-col gap-3">
            <TransactionRow
              title="2026–27 membership"
              description="Innovator"
              amountCents={-1500}
              date="Sept 27, 2026"
              media={membershipMedia}
            />
            <TransactionRow
              title="UXathon 2025 · First place"
              description="Competition award"
              amountCents={10000}
              date="Jan 14, 2025"
              media={awardMedia}
            />
          </div>
        </Specimen>
      </SpecimenGroup>
    </div>
  );
}

export default TransactionRowDemo;
