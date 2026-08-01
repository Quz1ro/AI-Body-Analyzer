/**
 * Registration Page
 */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { register } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { ActivityIcon } from "@/components/ui/Icons";
import type { Locale } from "@/locales";

export default function RegisterPage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const { locale, setLocale, t } = useLanguage();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError(t.auth.register.passwordsMismatch);
      return;
    }

    setLoading(true);

    try {
      await register({ name, email, password });
      await refresh();
      // Redirect to verification pending page
      router.push("/auth/verify-pending");
    } catch (err: any) {
      setError(err.message || t.auth.register.error);
    } finally {
      setLoading(false);
    }
  }

  const locales: { key: Locale; flag: string; label: string }[] = [
    { key: "uk", flag: "🇺🇦", label: "UA" },
    { key: "en", flag: "🇬🇧", label: "EN" },
  ];

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "20px",
      background: "var(--bg-primary)",
    }}>
      <div className="glass-card animate-in" style={{ width: "100%", maxWidth: "420px", padding: "40px" }}>
        {/* Language Selector */}
        <div style={{
          display: "flex",
          justifyContent: "flex-end",
          marginBottom: "8px",
        }}>
          <div style={{
            display: "flex",
            borderRadius: "10px",
            overflow: "hidden",
            border: "1px solid var(--border-subtle)",
            background: "rgba(255, 255, 255, 0.03)",
          }}>
            {locales.map((l) => (
              <button
                key={l.key}
                type="button"
                onClick={() => setLocale(l.key)}
                style={{
                  padding: "6px 14px",
                  fontSize: "13px",
                  fontWeight: 600,
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                  transition: "all 0.25s ease",
                  background: locale === l.key
                    ? "rgba(45, 212, 191, 0.15)"
                    : "transparent",
                  color: locale === l.key
                    ? "var(--accent-teal)"
                    : "var(--text-muted)",
                  boxShadow: locale === l.key
                    ? "inset 0 0 0 1px rgba(45, 212, 191, 0.3)"
                    : "none",
                }}
              >
                <span style={{ fontSize: "15px" }}>{l.flag}</span>
                {l.label}
              </button>
            ))}
          </div>
        </div>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div style={{ marginBottom: "12px", color: "var(--accent-teal)", display: "flex", justifyContent: "center" }}><ActivityIcon size={40} /></div>
          <h1 style={{ fontSize: "24px", fontWeight: 800, marginBottom: "8px" }}>
            {t.auth.register.title} <span className="gradient-text">{t.auth.register.titleAccent}</span>
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
            {t.auth.register.subtitle}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label className="input-label" htmlFor="register-name">{t.auth.register.nameLabel}</label>
            <input
              id="register-name"
              type="text"
              className="input-field"
              placeholder={t.auth.register.namePlaceholder}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={120}
              autoComplete="name"
            />
          </div>
          <div>
            <label className="input-label" htmlFor="register-email">{t.auth.register.emailLabel}</label>
            <input
              id="register-email"
              type="email"
              className="input-field"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div>
            <label className="input-label" htmlFor="register-password">{t.auth.register.passwordLabel}</label>
            <input
              id="register-password"
              type="password"
              className="input-field"
              placeholder={t.auth.register.passwordPlaceholder}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="input-label" htmlFor="register-confirm">{t.auth.register.confirmLabel}</label>
            <input
              id="register-confirm"
              type="password"
              className="input-field"
              placeholder={t.auth.register.confirmPlaceholder}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
            />
          </div>

          {error && (
            <div style={{
              padding: "10px 14px",
              borderRadius: "var(--radius-sm)",
              background: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.2)",
              color: "var(--accent-red)",
              fontSize: "13px",
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
            style={{ width: "100%", padding: "14px", fontSize: "15px", marginTop: "8px" }}
          >
            {loading ? t.auth.register.submitLoading : t.auth.register.submit}
          </button>
        </form>

        {/* Footer */}
        <p style={{ textAlign: "center", marginTop: "24px", fontSize: "13px", color: "var(--text-muted)" }}>
          {t.auth.register.hasAccount}{" "}
          <Link href="/auth/login" style={{ color: "var(--accent-blue)", textDecoration: "none", fontWeight: 600 }}>
            {t.auth.register.loginLink}
          </Link>
        </p>
      </div>
    </div>
  );
}
