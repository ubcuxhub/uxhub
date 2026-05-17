"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

const AuthDashboard = () => {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/events"); // replace so /admin doesn’t stay in history
  }, [router]);

  return <p>Redirecting to admin events...</p>;
};

export default AuthDashboard;
