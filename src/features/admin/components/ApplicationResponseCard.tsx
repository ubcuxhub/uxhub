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
        <CardTitle className="text-base font-medium">{question}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm whitespace-pre-wrap text-muted-foreground">
          {response || "No response provided"}
        </p>
      </CardContent>
    </Card>
  );
}

