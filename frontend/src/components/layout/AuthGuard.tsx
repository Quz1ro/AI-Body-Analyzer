/**
 * AuthGuard — protects pages that require both authentication and email verification.
 * Redirects to /auth/login if not logged in, or /auth/verify-pending if email is not verified.
 */

"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

interface AuthGuardProps {
  children: ReactNode;
  /** If true, only checks login status, not email verification */
  skipVerification?: boolean;
}

export default function AuthGuard({ children, skipVerification = false }: AuthGuardProps) {
  const { loading, isLoggedIn, emailVerified } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (!isLoggedIn) {
      router.push("/auth/login");
      return;
    }

    if (!skipVerification && !emailVerified) {
      router.push("/auth/verify-pending");
      return;
    }
  }, [loading, isLoggedIn, emailVerified, skipVerification, router]);

  // Show loading skeleton while checking auth
  if (loading) {
    return (
      <div className="page-container">
        <div className="skeleton" style={{ width: 200, height: 32, marginBottom: 24 }} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
          {[...Array(3)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 120 }} />
          ))}
        </div>
      </div>
    );
  }

  // Not authorized — redirect is happening, show nothing
  if (!isLoggedIn || (!skipVerification && !emailVerified)) {
    return null;
  }

  return <>{children}</>;
}
