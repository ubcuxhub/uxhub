"use client";
import { PageContainer } from "@/components/shared/PageContainer";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
export default function CheckInError({reset}:{reset:()=>void}) {
  return <PageContainer><EmptyState title="Couldn't load check-in" description="Check your connection and try again." actions={<Button onClick={reset}>Try again</Button>}/></PageContainer>;
}
