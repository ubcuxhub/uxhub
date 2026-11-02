"use client";

import { SuccessOverlay } from "@/components/shared/SuccessOverlay";

import { Specimen, SpecimenGroup } from "@/app/dev/_shell/Specimen";

/** Drawn inside a transformed frame so its `fixed inset-0` stays contained. */
function SuccessOverlayFrame() {
  return (
    <div className="relative h-72 w-full overflow-hidden rounded-xl border [transform:translateZ(0)]">
      <SuccessOverlay message="The application was accepted." onClose={() => {}} />
    </div>
  );
}

function SuccessOverlayDemo() {
  return (
    <div className="flex flex-col gap-8">
      <SpecimenGroup
        title="SuccessOverlay"
        description="Full-screen scrim and card, drawn inside a frame."
        min="100%"
      >
        <Specimen label="default" bare>
          <SuccessOverlayFrame />
        </Specimen>
      </SpecimenGroup>
    </div>
  );
}

export default SuccessOverlayDemo;
