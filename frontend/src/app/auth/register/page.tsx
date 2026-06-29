/**
 * Registration Page
 */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { register } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { ActivityIcon } from "@/components/ui/Icons";

export default function RegisterPage() {
  const router = useRouter();
  const { refresh } = useAuth();
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
      setError("Паролі не збігаються");
      return;
    }

    setLoading(true);

    try {
      await register({ name, email, password });
      await refresh();
      router.push("/");
    } catch (err: any) {
      setError(err.message || "Помилка реєстрації");
    } finally {
      setLoading(false);
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
      <div className="glass-card animate-in" style={{ width: "100%", maxWidth: "420px", padding: "40px" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div style={{ marginBottom: "12px", color: "var(--accent-teal)", display: "flex", justifyContent: "center" }}><ActivityIcon size={40} /></div>
          <h1 style={{ fontSize: "24px", fontWeight: 800, marginBottom: "8px" }}>
            Створити <span className="gradient-text">акаунт</span>
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
            Зареєструйтесь для аналізу фізичної форми
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label className="input-label" htmlFor="register-name">Ім&apos;я</label>
            <input
              id="register-name"
              type="text"
              className="input-field"
              placeholder="Ваше ім'я"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={120}
              autoComplete="name"
            />
          </div>
          <div>
            <label className="input-label" htmlFor="register-email">Email</label>
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
            <label className="input-label" htmlFor="register-password">Пароль</label>
            <input
              id="register-password"
              type="password"
              className="input-field"
              placeholder="Мінімум 6 символів"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="input-label" htmlFor="register-confirm">Підтвердження пароля</label>
            <input
              id="register-confirm"
              type="password"
              className="input-field"
              placeholder="Повторіть пароль"
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
            {loading ? "Створення..." : "Зареєструватися"}
          </button>
        </form>

        {/* Footer */}
        <p style={{ textAlign: "center", marginTop: "24px", fontSize: "13px", color: "var(--text-muted)" }}>
          Вже є акаунт?{" "}
          <Link href="/auth/login" style={{ color: "var(--accent-blue)", textDecoration: "none", fontWeight: 600 }}>
            Увійти
          </Link>
        </p>
      </div>
    </div>
  );
}
