import { PageContainer } from "@/components/shared/PageContainer";

export default function AdminDashboard() {
  return (
    <PageContainer>
      <div className="mb-8">
        <h1 className="mb-2 text-h1 tracking-tight">
          Admin Dashboard
        </h1>
        <p className="text-muted-foreground">
          Manage events and users from the sidebar.
        </p>
      </div>
    </PageContainer>
  );
}
