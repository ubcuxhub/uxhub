import { BackButton, BackPill } from "@/components/shared/BackButton";
import { PageContainer } from "@/components/shared/PageContainer";

import { Specimen, SpecimenGroup } from "@/app/dev/_shell/Specimen";

function BackButtonDemo() {
  return (
    <div className="flex flex-col gap-8">
      <SpecimenGroup
        title="BackButton"
        spec="§4.5"
        description="40px pill, 20px side padding, 16px arrow, 8px gap. Rendered by PageContainer and by feature pages with a backHref."
      >
        <Specimen label="BackButton, named parent">
          <BackButton link="/dev/components" label="Back to Events" />
        </Specimen>
        <Specimen label="BackPill, long label">
          <BackPill href="/dev/components" label="Back to Manage Events" />
        </Specimen>
        <Specimen label="hover (forced)">
          <BackPill
            href="/dev/components"
            label="Back to Events"
            className="bg-muted"
          />
        </Specimen>
        <Specimen label="focus (forced)">
          <BackPill
            href="/dev/components"
            label="Back to Events"
            className="focus-ring"
          />
        </Specimen>
      </SpecimenGroup>

      <SpecimenGroup
        title="PageContainer"
        spec="§2.3"
        description="Top 40px on desktop and tablet, 32px on mobile; sides 20 / 24 / 64. The back pill sits 24px above the title. Shown in a frame, so check the mobile preset too."
      >
        <Specimen label="with backHref" wide>
          <div className="w-full overflow-hidden rounded-xl border border-dashed border-border bg-background">
            <PageContainer backHref="/dev/components" backLabel="Back to Events">
              <h3 className="text-h2">Page title</h3>
              <p className="mt-2 text-body text-muted-foreground">
                Content sits inside max-w-6xl with responsive side padding.
              </p>
            </PageContainer>
          </div>
        </Specimen>
      </SpecimenGroup>
    </div>
  );
}

export default BackButtonDemo;
