/**
 * Email Verification Page — handles token from URL and shows verification status.
 */

"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { verifyEmail, resendVerification, isAuthenticated } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { ActivityIcon } from "@/components/ui/Icons";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { refresh, isLoggedIn } = useAuth();
  const { t } = useLanguage();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"loading" | "success" | "already" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMsg(t.auth.verifyEmail.errorInvalidLink);
      return;
    }

    verifyEmail(token)
      .then((res) => {
        if (res.already_verified) {
          setStatus("already");
        } else {
          setStatus("success");
          // Refresh user profile to update email_verified status
          if (isAuthenticated()) {
            refresh();
          }
        }
      })
      .catch((err) => {
        setStatus("error");
        setErrorMsg(err.message || t.auth.verifyEmail.errorGeneric);
      });
  }, [token, refresh]);

  async function handleResend() {
    if (!isLoggedIn) {
      router.push("/auth/login");
      return;
    }
    setResending(true);
    try {
      await resendVerification();
      setResent(true);
    } catch {
      // silent
    } finally {
      setResending(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "20px",
      background: "var(--bg-primary)",
    }}>
      <div className="glass-card animate-in" style={{ width: "100%", maxWidth: "480px", padding: "48px 40px", textAlign: "center" }}>
        {/* Logo */}
        <div style={{ marginBottom: "24px", color: "var(--accent-teal)", display: "flex", justifyContent: "center" }}>
          <ActivityIcon size={48} />
        </div>

        {/* Loading State */}
        {status === "loading" && (
          <>
            <div style={{ marginBottom: "16px" }}>
              <div className="spinner" style={{
                width: "40px",
                height: "40px",
                border: "3px solid rgba(255,255,255,0.1)",
                borderTopColor: "var(--accent-teal)",
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
                margin: "0 auto 20px",
              }} />
            </div>
            <h1 style={{ fontSize: "22px", fontWeight: 800, marginBottom: "8px" }}>
              {t.auth.verifyEmail.loadingTitle} <span className="gradient-text">{t.auth.verifyEmail.loadingTitleAccent}</span>...
            </h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
              {t.auth.verifyEmail.loadingText}
            </p>
          </>
        )}

        {/* Success State */}
        {status === "success" && (
          <>
            <div style={{
              width: "64px",
              height: "64px",
              borderRadius: "50%",
              background: "rgba(0, 212, 170, 0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px",
              fontSize: "28px",
            }}>
              ✓
            </div>
            <h1 style={{ fontSize: "22px", fontWeight: 800, marginBottom: "8px" }}>
              {t.auth.verifyEmail.successTitle} <span className="gradient-text">{t.auth.verifyEmail.successTitleAccent}</span>
            </h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginBottom: "28px" }}>
              {t.auth.verifyEmail.successText}
            </p>
            <button
              className="btn-primary"
              onClick={() => router.push("/")}
              style={{ padding: "14px 40px", fontSize: "15px" }}
            >
              {t.auth.verifyEmail.goToApp}
            </button>
          </>
        )}

        {/* Already Verified */}
        {status === "already" && (
          <>
            <div style={{
              width: "64px",
              height: "64px",
              borderRadius: "50%",
              background: "rgba(59, 130, 246, 0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px",
              fontSize: "28px",
            }}>
              ✓
            </div>
            <h1 style={{ fontSize: "22px", fontWeight: 800, marginBottom: "8px" }}>
              {t.auth.verifyEmail.alreadyTitle} <span className="gradient-text">{t.auth.verifyEmail.alreadyTitleAccent}</span>
            </h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginBottom: "28px" }}>
              {t.auth.verifyEmail.alreadyText}
            </p>
            <button
              className="btn-primary"
              onClick={() => router.push("/")}
              style={{ padding: "14px 40px", fontSize: "15px" }}
            >
              {t.auth.verifyEmail.goToApp}
            </button>
          </>
        )}

        {/* Error State */}
        {status === "error" && (
          <>
            <div style={{
              width: "64px",
              height: "64px",
              borderRadius: "50%",
              background: "rgba(239, 68, 68, 0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px",
              fontSize: "28px",
              color: "var(--accent-red)",
            }}>
              ✕
            </div>
            <h1 style={{ fontSize: "22px", fontWeight: 800, marginBottom: "8px" }}>
              {t.auth.verifyEmail.errorTitle} <span style={{ color: "var(--accent-red)" }}>{t.auth.verifyEmail.errorTitleAccent}</span>
            </h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginBottom: "8px" }}>
              {errorMsg}
            </p>
            <p style={{ color: "var(--text-muted)", fontSize: "13px", marginBottom: "28px" }}>
              {t.auth.verifyEmail.errorExpired}
            </p>

            {isLoggedIn && !resent && (
              <button
                className="btn-primary"
                onClick={handleResend}
                disabled={resending}
                style={{ padding: "14px 32px", fontSize: "15px", marginBottom: "12px" }}
              >
                {resending ? t.auth.verifyEmail.resending : t.auth.verifyEmail.resendBtn}
              </button>
            )}

            {resent && (
              <div style={{
                padding: "10px 14px",
                borderRadius: "var(--radius-sm)",
                background: "rgba(0, 212, 170, 0.1)",
                border: "1px solid rgba(0, 212, 170, 0.2)",
                color: "var(--accent-teal)",
                fontSize: "13px",
                marginBottom: "12px",
              }}>
                {t.auth.verifyEmail.resentSuccess}
              </div>
            )}

            <div>
              <Link
                href="/"
                style={{ color: "var(--accent-blue)", textDecoration: "none", fontSize: "13px", fontWeight: 600 }}
              >
                {t.auth.verifyEmail.goHome}
              </Link>
            </div>
          </>
        )}
      </div>

      {/* Spinner animation */}
      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg-primary)",
      }}>
        <div className="glass-card" style={{ padding: "48px", textAlign: "center" }}>
          <p style={{ color: "var(--text-secondary)" }}>Loading...</p>
        </div>
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}
