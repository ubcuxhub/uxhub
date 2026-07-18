import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen text-center p-6">
      <h1 className="mb-4 text-h1">401 - Unauthorized</h1>
      <p className="mb-6 text-muted-foreground">
        You don’t have permission to view this page.
      </p>
      <Link
        href="/"
        className="rounded bg-primary px-4 py-2 text-primary-foreground transition hover:bg-primary/90"
      >
        Go Back
      </Link>
    </main>
  );
}
