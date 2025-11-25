"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/context/UserContext";
import { AdminPageSkeleton } from "@/components/AdminPageSkeleton";

interface ProtectedRouteProps {
  children: React.ReactNode;
  admin?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  admin = false,
}) => {
  const { user, loading } = useUser();
  const router = useRouter();

  const access = useMemo(() => {
    if (loading) return "loading";
    if (!user) return "unauthenticated";
    if (admin && user.role_access !== "admin") return "forbidden";
    return "allowed";
  }, [user, loading, admin]);

  useEffect(() => {
    if (access === "unauthenticated") {
      router.replace("/auth/login");
    } else if (access === "forbidden") {
      router.replace("/401");
    }
  }, [access, router]);

  if (access === "loading") {
    return admin ? (
      <AdminPageSkeleton />
    ) : (
      <div className="flex items-center justify-center h-screen text-gray-500">
        Loading...
      </div>
    );
  }

  // If redirecting, render nothing
  if (access === "unauthenticated" || access === "forbidden") {
    return null;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
