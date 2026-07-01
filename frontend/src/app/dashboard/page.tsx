/**
 * Dashboard Page — Analysis history and progress overview.
 */

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { listAnalyses, resendVerification } from "@/lib/api";
import type { AnalysisSummary } from "@/types";
import { BarChartIcon, CameraIcon } from "@/components/ui/Icons";

export default function DashboardPage() {
  const { user, loading: authLoading, isLoggedIn } = useAuth();
  const router = useRouter();
  const [analyses, setAnalyses] = useState<AnalysisSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!isLoggedIn) {
      router.push("/auth/login");
      return;
    }

    listAnalyses()
      .then(setAnalyses)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [authLoading, isLoggedIn, router]);

  async function handleResend() {
    setResending(true);
    try {
      await resendVerification();
      setResent(true);
      setTimeout(() => setResent(false), 5000);
    } catch {
      // silent
    } finally {
      setResending(false);
    }
  }

  if (authLoading || loading) {
    return (
      <div className="page-container">
        <div className="skeleton" style={{ width: 200, height: 32, marginBottom: 24 }} />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 120 }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Email Not Verified Banner */}
      {user && !user.email_verified && (
        <div className="animate-in" style={{
          padding: "16px 20px",
          marginBottom: "24px",
          borderRadius: "var(--radius-md, 12px)",
          background: "linear-gradient(135deg, rgba(251, 191, 36, 0.08), rgba(245, 158, 11, 0.12))",
          border: "1px solid rgba(251, 191, 36, 0.2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "16px",
          flexWrap: "wrap",
        }}>
          <div>
            <div style={{ fontSize: "14px", fontWeight: 600, color: "#fbbf24", marginBottom: "4px" }}>
              ⚠ Email не підтверджено
            </div>
            <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
              Підтвердіть вашу пошту, щоб завантажувати фото та запускати аналіз
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {resent ? (
              <span style={{ fontSize: "13px", color: "var(--accent-teal)" }}>✓ Надіслано</span>
            ) : (
              <button
                className="btn-secondary"
                onClick={handleResend}
                disabled={resending}
                style={{ padding: "8px 16px", fontSize: "13px", whiteSpace: "nowrap" }}
              >
                {resending ? "Надсилання..." : "Надіслати лист повторно"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <section className="animate-in" style={{ marginBottom: "32px" }}>
        <h1 style={{ fontSize: "28px", fontWeight: 800, letterSpacing: "-0.02em", marginBottom: "8px" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}><BarChartIcon size={22} /> Дашборд</span>
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
          Ваша історія аналізів та прогрес
        </p>
      </section>

      {/* Stats Summary */}
      <section className="animate-in animate-delay-1" style={{ marginBottom: "32px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
          <div className="stat-card">
            <div className="stat-label">Всього аналізів</div>
            <div className="stat-value gradient-text">{analyses.length}</div>
          </div>
          {analyses.length > 0 && (
            <>
              <div className="stat-card">
                <div className="stat-label">Останній аналіз</div>
                <div className="stat-value" style={{ fontSize: "18px", color: "var(--accent-teal)" }}>
                  {new Date(analyses[0].created_at).toLocaleDateString("uk-UA")}
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Плечі/Талія (останній)</div>
                <div className="stat-value gradient-text">
                  {analyses[0].proportions?.shoulder_to_hip_ratio?.toFixed(2) || "—"}
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      {/* Analysis History */}
      <section className="animate-in animate-delay-2">
        <h2 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "16px" }}>
          Історія аналізів
        </h2>

        {analyses.length === 0 ? (
          <div className="glass-card" style={{ padding: "48px", textAlign: "center" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "16px", color: "var(--text-muted)" }}><CameraIcon size={48} /></div>
            <p style={{ fontSize: "16px", fontWeight: 600, marginBottom: "8px" }}>
              Ще немає аналізів
            </p>
            <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginBottom: "20px" }}>
              Завантажте фото для першого аналізу
            </p>
            <button className="btn-primary" onClick={() => router.push("/")}>
              Завантажити фото
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {analyses.map((a, i) => (
              <div
                key={a.id}
                className="glass-card"
                style={{
                  padding: "20px 24px",
                  cursor: "pointer",
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  alignItems: "center",
                  gap: "16px",
                }}
                onClick={() => router.push(`/analysis/${a.id}`)}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
                    <span style={{ fontWeight: 700, fontSize: "15px" }}>
                      Аналіз #{analyses.length - i}
                    </span>
                    <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                      {new Date(a.created_at).toLocaleString("uk-UA")}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: "16px", fontSize: "13px", color: "var(--text-secondary)" }}>
                    <span>
                      Плечі/Талія: <strong style={{ color: "var(--text-primary)" }}>
                        {a.proportions?.shoulder_to_hip_ratio?.toFixed(2)}
                      </strong>
                    </span>
                    <span>
                      Рук: <strong style={{ color: "var(--text-primary)" }}>
                        {a.proportions?.arm_symmetry?.toFixed(1)}%
                      </strong>
                    </span>
                    <span>
                      Ніг: <strong style={{ color: "var(--text-primary)" }}>
                        {a.proportions?.leg_symmetry?.toFixed(1)}%
                      </strong>
                    </span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "6px" }}>
                  {a.weak_zones.map((z, j) => (
                    <span key={j} className={`badge badge-${z.severity}`}>
                      {z.label}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
