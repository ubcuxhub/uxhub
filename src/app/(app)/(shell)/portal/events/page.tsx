import { ArrowUpRight } from "lucide-react";

import { PageContainer } from "@/components/shared/PageContainer";
import { Button } from "@/components/ui/button";

const LINKTREE_URL = "https://linktr.ee/ubcuxhub";

export default function PortalEvents() {
  return (
    <PageContainer>
      <div className="flex flex-col items-center gap-8 py-24 text-center">
        <div className="flex flex-col gap-3">
          <h1 className="text-h1 tracking-tight">
            Events coming soon to the portal
          </h1>
          <p className="text-muted-foreground">
            In the meantime, check out and register for our current events
            through our Linktree.
          </p>
        </div>

        <Button asChild>
          <a href={LINKTREE_URL} target="_blank" rel="noopener noreferrer">
            Go to our Linktree
            <ArrowUpRight />
          </a>
        </Button>
      </div>
    </PageContainer>
  );
}
