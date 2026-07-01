/**
 * Profile Page — view and edit user profile.
 */

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { updateProfile, deleteAccount, resendVerification } from "@/lib/api";
import { UserIcon, AlertTriangleIcon } from "@/components/ui/Icons";

export default function ProfilePage() {
  const { user, loading: authLoading, isLoggedIn, refresh, logout } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [resending, setResending] = useState(false);
  const [resentEmail, setResentEmail] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!isLoggedIn) {
      router.push("/auth/login");
      return;
    }
    if (user) setName(user.name);
  }, [authLoading, isLoggedIn, router, user]);

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

  async function handleResendVerification() {
    setResending(true);
    try {
      await resendVerification();
      setResentEmail(true);
      setTimeout(() => setResentEmail(false), 5000);
    } catch {
      // silent
    } finally {
      setResending(false);
    }
  }

  if (authLoading || !user) {
    return (
      <div className="page-container">
        <div className="skeleton" style={{ width: 200, height: 32 }} />
      </div>
    );
  }

  return (
    <div className="page-container">
      <section className="animate-in" style={{ marginBottom: "32px" }}>
        <h1 style={{ fontSize: "28px", fontWeight: 800, letterSpacing: "-0.02em", marginBottom: "8px" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}><UserIcon size={22} /> Профіль</span>
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
          Перегляд та редагування вашого профілю
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
              {user.email_verified ? (
                <span style={{
                  fontSize: "11px",
                  padding: "2px 8px",
                  borderRadius: "999px",
                  background: "rgba(0, 212, 170, 0.12)",
                  color: "var(--accent-teal)",
                  fontWeight: 600,
                }}>✓ Підтверджено</span>
              ) : (
                <span style={{
                  fontSize: "11px",
                  padding: "2px 8px",
                  borderRadius: "999px",
                  background: "rgba(251, 191, 36, 0.12)",
                  color: "#fbbf24",
                  fontWeight: 600,
                }}>Не підтверджено</span>
              )}
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
              Зареєстрований: {new Date(user.created_at).toLocaleDateString("uk-UA")}
            </div>
          </div>
        </div>

        <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label className="input-label" htmlFor="profile-name">Ім&apos;я</label>
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
            <label className="input-label">Email</label>
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
              {saving ? "Збереження..." : "Зберегти"}
            </button>
            {saved && (
              <span style={{ fontSize: "13px", color: "var(--accent-green)" }}>✓ Збережено</span>
            )}
          </div>
        </form>

        {/* Email Verification Section */}
        {!user.email_verified && (
          <div style={{
            marginTop: "20px",
            padding: "16px",
            borderRadius: "var(--radius-sm)",
            background: "linear-gradient(135deg, rgba(251, 191, 36, 0.06), rgba(245, 158, 11, 0.1))",
            border: "1px solid rgba(251, 191, 36, 0.15)",
          }}>
            <div style={{ fontSize: "13px", fontWeight: 600, color: "#fbbf24", marginBottom: "8px" }}>
              ⚠ Email не підтверджено
            </div>
            <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "12px" }}>
              Підтвердіть вашу пошту, щоб отримати доступ до завантаження фото та аналізу.
            </p>
            {resentEmail ? (
              <span style={{ fontSize: "13px", color: "var(--accent-teal)" }}>✓ Лист надіслано</span>
            ) : (
              <button
                className="btn-secondary"
                onClick={handleResendVerification}
                disabled={resending}
                style={{ padding: "8px 16px", fontSize: "13px" }}
              >
                {resending ? "Надсилання..." : "Надіслати лист підтвердження"}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Danger Zone */}
      <div className="glass-card animate-in animate-delay-2" style={{
        padding: "24px",
        maxWidth: "520px",
        borderColor: "rgba(239, 68, 68, 0.2)",
      }}>
        <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--accent-red)", marginBottom: "8px" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}><AlertTriangleIcon size={18} /> Небезпечна зона</span>
        </h3>
        <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "16px" }}>
          Видалення акаунта є незворотним. Всі ваші дані, аналізи та фотографії будуть видалені.
        </p>

        {!showDeleteConfirm ? (
          <button className="btn-danger" onClick={() => setShowDeleteConfirm(true)}>
            Видалити акаунт
          </button>
        ) : (
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <button
              className="btn-danger"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Видалення..." : "Так, видалити"}
            </button>
            <button className="btn-secondary" onClick={() => setShowDeleteConfirm(false)}>
              Скасувати
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
