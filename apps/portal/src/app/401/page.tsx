import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen text-center p-6">
      <h1 className="text-3xl font-bold mb-4">401 - Unauthorized</h1>
      <p className="text-gray-600 mb-6">
        You don’t have permission to view this page.
      </p>
      <Link
        href="/"
        className="px-4 py-2 bg-black text-white rounded hover:opacity-90 transition"
      >
        Go Back
      </Link>
    </main>
  );
}
