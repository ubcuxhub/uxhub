"use client";
import ProtectedRoute from "@/components/ProtectedRoute";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const AuthDashboard = () => {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/events"); // replace so /admin doesn’t stay in history
  }, [router]);

  return (
    <ProtectedRoute admin>
      <p>Redirecting to admin events...</p>
    </ProtectedRoute>
  );
};

export default AuthDashboard;
