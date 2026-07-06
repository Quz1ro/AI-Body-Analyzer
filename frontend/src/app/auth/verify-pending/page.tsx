/**
 * Verify Pending Page — shown to logged-in users whose email is not yet verified.
 * Features auto-polling every 5 seconds, resend with 60s cooldown, and logout option.
 */

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { resendVerification, checkVerificationStatus, isAuthenticated } from "@/lib/api";
import { ActivityIcon } from "@/components/ui/Icons";

const RESEND_COOLDOWN = 60; // seconds

export default function VerifyPendingPage() {
  const router = useRouter();
  const { user, loading, isLoggedIn, emailVerified, refresh, logout } = useAuth();

  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState("");
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Redirect logic
  useEffect(() => {
    if (loading) return;
    if (!isLoggedIn) {
      router.push("/auth/login");
      return;
    }
    if (emailVerified) {
      router.push("/");
      return;
    }
  }, [loading, isLoggedIn, emailVerified, router]);

  // Poll verification status every 5 seconds
  useEffect(() => {
    if (!isLoggedIn || emailVerified) return;

    const poll = async () => {
      try {
        const status = await checkVerificationStatus();
        if (status.email_verified) {
          await refresh();
          router.push("/");
        }
      } catch {
        // silently ignore polling errors
      }
    };

    pollRef.current = setInterval(poll, 5000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [isLoggedIn, emailVerified, refresh, router]);

  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
      return;
    }

    cooldownRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          if (cooldownRef.current) clearInterval(cooldownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, [cooldown]);

  const handleResend = useCallback(async () => {
    if (cooldown > 0 || resending) return;
    setResending(true);
    setError("");
    setResent(false);

    try {
      await resendVerification();
      setResent(true);
      setCooldown(RESEND_COOLDOWN);
    } catch (err: any) {
      if (err.status === 429) {
        // Parse remaining seconds from error message
        const match = err.message?.match(/(\d+)/);
        const remaining = match ? parseInt(match[1], 10) : RESEND_COOLDOWN;
        setCooldown(remaining);
        setError("");
      } else {
        setError(err.message || "Помилка надсилання");
      }
    } finally {
      setResending(false);
    }
  }, [cooldown, resending]);

  const handleLogout = useCallback(() => {
    logout();
    router.push("/auth/login");
  }, [logout, router]);

  // Show nothing while loading
  if (loading || !isLoggedIn || emailVerified) {
    return (
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
    );
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
      <div className="glass-card animate-in" style={{
        width: "100%",
        maxWidth: "500px",
        padding: "48px 40px",
        textAlign: "center",
      }}>
        {/* Logo */}
        <div style={{
          marginBottom: "24px",
          color: "var(--accent-teal)",
          display: "flex",
          justifyContent: "center",
        }}>
          <ActivityIcon size={48} />
        </div>

        {/* Email icon */}
        <div style={{
          width: "80px",
          height: "80px",
          borderRadius: "50%",
          background: "linear-gradient(135deg, rgba(251, 191, 36, 0.12), rgba(245, 158, 11, 0.18))",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 28px",
          fontSize: "36px",
          animation: "pulse-soft 2s ease-in-out infinite",
        }}>
          ✉
        </div>

        <h1 style={{ fontSize: "24px", fontWeight: 800, marginBottom: "8px" }}>
          Підтвердіть вашу{" "}
          <span className="gradient-text">пошту</span>
        </h1>

        <p style={{
          color: "var(--text-secondary)",
          fontSize: "14px",
          marginBottom: "8px",
          lineHeight: 1.6,
        }}>
          Ми надіслали лист підтвердження на адресу:
        </p>

        <p style={{
          color: "var(--accent-blue)",
          fontSize: "16px",
          fontWeight: 700,
          marginBottom: "20px",
          wordBreak: "break-all",
          padding: "12px 16px",
          background: "rgba(59, 130, 246, 0.08)",
          borderRadius: "var(--radius-sm, 8px)",
          border: "1px solid rgba(59, 130, 246, 0.15)",
        }}>
          {user?.email}
        </p>

        <p style={{
          color: "var(--text-muted)",
          fontSize: "13px",
          marginBottom: "32px",
          lineHeight: 1.7,
        }}>
          Натисніть на посилання в листі, щоб підтвердити вашу електронну пошту
          та отримати повний доступ до додатку. Сторінка оновиться автоматично.
        </p>

        {/* Status indicators */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
          marginBottom: "24px",
          fontSize: "13px",
          color: "var(--text-muted)",
        }}>
          <div style={{
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            background: "var(--accent-teal)",
            animation: "pulse-dot 1.5s ease-in-out infinite",
          }} />
          Очікуємо підтвердження...
        </div>

        {/* Resend button or success message */}
        {resent && cooldown > 0 ? (
          <div style={{
            padding: "12px 16px",
            borderRadius: "var(--radius-sm, 8px)",
            background: "rgba(0, 212, 170, 0.1)",
            border: "1px solid rgba(0, 212, 170, 0.2)",
            color: "var(--accent-teal)",
            fontSize: "13px",
            marginBottom: "16px",
          }}>
            ✓ Лист надіслано повторно. Повторна відправка через {cooldown} с.
          </div>
        ) : (
          <button
            className="btn-secondary"
            onClick={handleResend}
            disabled={resending || cooldown > 0}
            style={{
              marginBottom: "16px",
              padding: "12px 32px",
              fontSize: "14px",
              width: "100%",
              opacity: cooldown > 0 ? 0.6 : 1,
            }}
          >
            {resending
              ? "Надсилання..."
              : cooldown > 0
                ? `Повторити через ${cooldown} с.`
                : "Надіслати лист повторно"}
          </button>
        )}

        {/* Error */}
        {error && (
          <div style={{
            padding: "10px 14px",
            borderRadius: "var(--radius-sm, 8px)",
            background: "rgba(239, 68, 68, 0.1)",
            border: "1px solid rgba(239, 68, 68, 0.2)",
            color: "var(--accent-red)",
            fontSize: "13px",
            marginBottom: "16px",
          }}>
            {error}
          </div>
        )}

        {/* Logout */}
        <button
          onClick={handleLogout}
          style={{
            background: "none",
            border: "none",
            color: "var(--text-muted)",
            fontSize: "13px",
            cursor: "pointer",
            textDecoration: "underline",
            padding: "8px",
          }}
        >
          Вийти з акаунту
        </button>
      </div>

      {/* Animations */}
      <style jsx>{`
        @keyframes pulse-soft {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.85; }
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.8); }
        }
      `}</style>
    </div>
  );
}
