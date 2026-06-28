import { PageContainer } from "@/components/shared/PageContainer";

export default function AdminDashboard() {
  return (
    <PageContainer>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-2">
          Admin Dashboard
        </h1>
        <p className="text-muted-foreground">
          Manage events and users from the sidebar.
        </p>
      </div>
    </PageContainer>
  );
}
