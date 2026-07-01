/**
 * Email Verification Page — handles token from URL and shows verification status.
 */

"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { verifyEmail, resendVerification, isAuthenticated } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { ActivityIcon } from "@/components/ui/Icons";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { refresh, isLoggedIn } = useAuth();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"loading" | "success" | "already" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMsg("Посилання для підтвердження некоректне або відсутнє");
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
        setErrorMsg(err.message || "Помилка підтвердження email");
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
              Підтвердження <span className="gradient-text">email</span>...
            </h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
              Зачекайте, ми перевіряємо ваше посилання
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
              Email <span className="gradient-text">підтверджено!</span>
            </h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginBottom: "28px" }}>
              Вашу електронну пошту успішно підтверджено. Тепер ви можете
              завантажувати фото та запускати аналіз.
            </p>
            <button
              className="btn-primary"
              onClick={() => router.push("/")}
              style={{ padding: "14px 40px", fontSize: "15px" }}
            >
              Перейти до додатку
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
              Email вже <span className="gradient-text">підтверджено</span>
            </h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginBottom: "28px" }}>
              Ваша електронна пошта була підтверджена раніше.
            </p>
            <button
              className="btn-primary"
              onClick={() => router.push("/")}
              style={{ padding: "14px 40px", fontSize: "15px" }}
            >
              Перейти до додатку
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
              Помилка <span style={{ color: "var(--accent-red)" }}>підтвердження</span>
            </h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginBottom: "8px" }}>
              {errorMsg}
            </p>
            <p style={{ color: "var(--text-muted)", fontSize: "13px", marginBottom: "28px" }}>
              Посилання могло закінчитися. Спробуйте надіслати лист повторно.
            </p>

            {isLoggedIn && !resent && (
              <button
                className="btn-primary"
                onClick={handleResend}
                disabled={resending}
                style={{ padding: "14px 32px", fontSize: "15px", marginBottom: "12px" }}
              >
                {resending ? "Надсилання..." : "Надіслати повторно"}
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
                ✓ Лист підтвердження надіслано повторно
              </div>
            )}

            <div>
              <Link
                href="/"
                style={{ color: "var(--accent-blue)", textDecoration: "none", fontSize: "13px", fontWeight: 600 }}
              >
                На головну
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
          <p style={{ color: "var(--text-secondary)" }}>Завантаження...</p>
        </div>
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}
