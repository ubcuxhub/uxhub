"use client";
import { AdminPageSkeleton } from "@/features/admin";
import { ProtectedRoute } from "@/features/auth";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const AuthDashboard = () => {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/events"); // replace so /admin doesn’t stay in history
  }, [router]);

  return (
    <ProtectedRoute admin loadingFallback={<AdminPageSkeleton />}>
      <p>Redirecting to admin events...</p>
    </ProtectedRoute>
  );
};

export default AuthDashboard;
