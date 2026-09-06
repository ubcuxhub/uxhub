import { PageContainer } from "@/components/shared/PageContainer";

export default function AdminDashboard() {
  return (
    <PageContainer className="flex flex-1 items-center justify-center text-center">
      <div>
        <h1 className="mb-2 text-h1 tracking-tight">Coming soon</h1>
        <p className="text-muted-foreground">
          {"The admin dashboard is on its way :)"}
        </p>
      </div>
    </PageContainer>
  );
}
