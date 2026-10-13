// TEMPORARY: delete this folder before merging the Sentry PR. It triggers one
// event of each kind so the Sentry setup can be checked on a preview deploy.

import { notFound } from "next/navigation";

import { PageContainer } from "@/components/shared/PageContainer";

import { SentryCheck } from "./SentryCheck";

export default function SentryCheckPage() {
  if (process.env.NEXT_PUBLIC_VERCEL_ENV === "production") notFound();

  return (
    <PageContainer className="flex flex-col gap-6">
      <h1 className="text-h1 tracking-tight">Sentry check</h1>
      <SentryCheck />
    </PageContainer>
  );
}
