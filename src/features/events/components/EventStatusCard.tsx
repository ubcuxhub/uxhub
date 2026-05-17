import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface EventStatusCardProps {
  hasApplied: boolean;
  hasQuestions: boolean;
}

export function EventStatusCard({
  hasApplied,
  hasQuestions,
}: EventStatusCardProps) {
  if (!hasQuestions) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Application Required</CardTitle>
          <CardDescription>
            This event does not require an application. Check back later for
            registration details.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (hasApplied) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Application Status</CardTitle>
          <CardDescription>
            You have already applied for this event. You can update your
            application in the form on the right.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return null;
}

