/**
 * Profile Page — view and edit user profile.
 * Protected by AuthGuard (requires login + verified email).
 */

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { updateProfile, deleteAccount } from "@/lib/api";
import { UserIcon, AlertTriangleIcon } from "@/components/ui/Icons";
import AuthGuard from "@/components/layout/AuthGuard";
import type { Locale } from "@/locales";

function ProfileContent() {
  const { user, refresh, logout } = useAuth();
  const { locale, setLocale, t } = useLanguage();
  const router = useRouter();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (user) setName(user.name);
  }, [user]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);

    try {
      await updateProfile({ name });
      await refresh();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      // handle error
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteAccount();
      logout();
      router.push("/auth/login");
    } catch (err) {
      setDeleting(false);
    }
  }

  const langOptions: { key: Locale; flag: string; label: string }[] = [
    { key: "uk", flag: "🇺🇦", label: t.lang.uk },
    { key: "en", flag: "🇬🇧", label: t.lang.en },
  ];

  const dateLocale = locale === "uk" ? "uk-UA" : "en-US";

  if (!user) return null;

  return (
    <div className="page-container">
      <section className="animate-in" style={{ marginBottom: "32px" }}>
        <h1 style={{ fontSize: "28px", fontWeight: 800, letterSpacing: "-0.02em", marginBottom: "8px" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}><UserIcon size={22} /> {t.profile.title}</span>
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
          {t.profile.subtitle}
        </p>
      </section>

      {/* Avatar + Info */}
      <div className="glass-card animate-in animate-delay-1" style={{ padding: "32px", maxWidth: "520px", marginBottom: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "20px", marginBottom: "28px" }}>
          <div style={{
            width: "64px",
            height: "64px",
            borderRadius: "50%",
            background: "var(--gradient-primary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "24px",
            fontWeight: 800,
          }}>
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: "18px", fontWeight: 700 }}>{user.name}</div>
            <div style={{ fontSize: "13px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "8px" }}>
              {user.email}
              <span style={{
                fontSize: "11px",
                padding: "2px 8px",
                borderRadius: "999px",
                background: "rgba(0, 212, 170, 0.12)",
                color: "var(--accent-teal)",
                fontWeight: 600,
              }}>{t.common.confirmed}</span>
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
              {t.common.registered}: {new Date(user.created_at).toLocaleDateString(dateLocale)}
            </div>
          </div>
        </div>

        <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label className="input-label" htmlFor="profile-name">{t.profile.nameLabel}</label>
            <input
              id="profile-name"
              type="text"
              className="input-field"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={120}
            />
          </div>
          <div>
            <label className="input-label">{t.profile.emailLabel}</label>
            <input
              type="email"
              className="input-field"
              value={user.email}
              disabled
              style={{ opacity: 0.5 }}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? t.common.saving : t.common.save}
            </button>
            {saved && (
              <span style={{ fontSize: "13px", color: "var(--accent-green)" }}>{t.common.saved}</span>
            )}
          </div>
        </form>
      </div>

      {/* Language Selector */}
      <div className="glass-card animate-in animate-delay-2" style={{
        padding: "24px",
        maxWidth: "520px",
        marginBottom: "24px",
      }}>
        <h3 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "4px" }}>
          {t.profile.languageTitle}
        </h3>
        <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "16px" }}>
          {t.profile.languageSubtitle}
        </p>

        <div style={{
          display: "flex",
          gap: "10px",
        }}>
          {langOptions.map((l) => (
            <button
              key={l.key}
              type="button"
              onClick={() => setLocale(l.key)}
              style={{
                flex: 1,
                padding: "14px 16px",
                borderRadius: "var(--radius-md, 12px)",
                border: locale === l.key
                  ? "2px solid rgba(45, 212, 191, 0.5)"
                  : "1px solid var(--border-subtle)",
                background: locale === l.key
                  ? "rgba(45, 212, 191, 0.08)"
                  : "rgba(255, 255, 255, 0.02)",
                color: locale === l.key
                  ? "var(--accent-teal)"
                  : "var(--text-secondary)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
                fontSize: "14px",
                fontWeight: 700,
                transition: "all 0.25s ease",
                boxShadow: locale === l.key
                  ? "0 0 12px rgba(45, 212, 191, 0.15)"
                  : "none",
              }}
            >
              <span style={{ fontSize: "22px" }}>{l.flag}</span>
              {l.label}
            </button>
          ))}
        </div>
      </div>

      {/* Danger Zone */}
      <div className="glass-card animate-in animate-delay-3" style={{
        padding: "24px",
        maxWidth: "520px",
        borderColor: "rgba(239, 68, 68, 0.2)",
      }}>
        <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--accent-red)", marginBottom: "8px" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}><AlertTriangleIcon size={18} /> {t.profile.dangerZone}</span>
        </h3>
        <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "16px" }}>
          {t.profile.dangerText}
        </p>

        {!showDeleteConfirm ? (
          <button className="btn-danger" onClick={() => setShowDeleteConfirm(true)}>
            {t.profile.deleteAccount}
          </button>
        ) : (
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <button
              className="btn-danger"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? t.profile.deleting : t.profile.confirmDelete}
            </button>
            <button className="btn-secondary" onClick={() => setShowDeleteConfirm(false)}>
              {t.common.cancel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <AuthGuard>
      <ProfileContent />
    </AuthGuard>
  );
}
