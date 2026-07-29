"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface ApplicationResponseCardProps {
  question: string;
  response: string;
}

export function ApplicationResponseCard({
  question,
  response,
}: ApplicationResponseCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-subheading">{question}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-small whitespace-pre-wrap text-muted-foreground">
          {response || "No response provided"}
        </p>
      </CardContent>
    </Card>
  );
}
