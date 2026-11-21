import { CircleAlert, Info, Lock, TriangleAlert } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import { Specimen, SpecimenGroup } from "@/app/dev/_shell/Specimen";

function AlertDemo() {
  return (
    <div className="flex flex-col gap-8">
      <SpecimenGroup
        title="Alert"
        spec="§3.8"
        description="neutral, warning, info and destructive, each with a 16px icon and a title."
      >
        <Specimen label="neutral · locked setting" className="w-96">
          <Alert className="w-full" variant="neutral" icon={<Lock aria-hidden strokeWidth={1.5} />}>
            <AlertTitle>Paid · $10.00 for non-members, free for members</AlertTitle>
            <AlertDescription>Locked because people have registered.</AlertDescription>
          </Alert>
        </Specimen>
        <Specimen label="warning" className="w-96">
          <Alert className="w-full" variant="warning" icon={<TriangleAlert />}>
            <AlertTitle>Membership ends Apr 30</AlertTitle>
            <AlertDescription>
              Your membership expires at the end of the term.
            </AlertDescription>
          </Alert>
        </Specimen>
        <Specimen label="info" className="w-96">
          <Alert className="w-full" variant="info" icon={<Info />}>
            <AlertTitle>Applications close Nov 1</AlertTitle>
            <AlertDescription>You can edit until then.</AlertDescription>
          </Alert>
        </Specimen>
        <Specimen label="destructive" className="w-96">
          <Alert className="w-full" variant="destructive" icon={<CircleAlert />}>
            <AlertTitle>Payment failed</AlertTitle>
            <AlertDescription>Your card was declined.</AlertDescription>
          </Alert>
        </Specimen>
        <Specimen label="no title (as MembershipCheckout uses it)" className="w-96">
          <Alert className="w-full" variant="info" icon={<Info />}>
            A short notice with an icon and no title.
          </Alert>
        </Specimen>
        <Specimen label="no icon" className="w-96">
          <Alert className="w-full">Draft: only admins can see this.</Alert>
        </Specimen>
      </SpecimenGroup>
    </div>
  );
}

export default AlertDemo;
