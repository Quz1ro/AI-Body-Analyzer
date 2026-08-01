/**
 * Dashboard Page — Analysis history and progress overview.
 * Protected by AuthGuard (requires login + verified email).
 */

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { listAnalyses } from "@/lib/api";
import type { AnalysisSummary } from "@/types";
import { BarChartIcon, CameraIcon } from "@/components/ui/Icons";
import AuthGuard from "@/components/layout/AuthGuard";

function DashboardContent() {
  const { user } = useAuth();
  const { locale, t } = useLanguage();
  const router = useRouter();
  const [analyses, setAnalyses] = useState<AnalysisSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const dateLocale = locale === "uk" ? "uk-UA" : "en-US";

  useEffect(() => {
    listAnalyses()
      .then(setAnalyses)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
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
      {/* Header */}
      <section className="animate-in" style={{ marginBottom: "32px" }}>
        <h1 style={{ fontSize: "28px", fontWeight: 800, letterSpacing: "-0.02em", marginBottom: "8px" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}><BarChartIcon size={22} /> {t.dashboard.title}</span>
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
          {t.dashboard.subtitle}
        </p>
      </section>

      {/* Stats Summary */}
      <section className="animate-in animate-delay-1" style={{ marginBottom: "32px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
          <div className="stat-card" style={{
            borderTop: "2px solid rgba(59,130,246,0.4)",
            background: "linear-gradient(180deg, rgba(59,130,246,0.06) 0%, var(--bg-card) 40%)",
          }}>
            <div className="stat-label">{t.dashboard.totalAnalyses}</div>
            <div className="stat-value gradient-text" style={{ fontSize: "32px" }}>{analyses.length}</div>
          </div>
          {analyses.length > 0 && (
            <>
              <div className="stat-card" style={{
                borderTop: "2px solid rgba(6,182,212,0.4)",
                background: "linear-gradient(180deg, rgba(6,182,212,0.06) 0%, var(--bg-card) 40%)",
              }}>
                <div className="stat-label">{t.dashboard.lastAnalysis}</div>
                <div className="stat-value" style={{ fontSize: "20px", color: "var(--accent-teal)" }}>
                  {new Date(analyses[0].created_at).toLocaleDateString(dateLocale)}
                </div>
              </div>
              <div className="stat-card" style={{
                borderTop: "2px solid rgba(139,92,246,0.4)",
                background: "linear-gradient(180deg, rgba(139,92,246,0.06) 0%, var(--bg-card) 40%)",
              }}>
                <div className="stat-label">{t.dashboard.shoulderHipLast}</div>
                <div className="stat-value gradient-text" style={{ fontSize: "28px" }}>
                  {analyses[0].proportions?.shoulder_to_hip_ratio?.toFixed(2) || "—"}
                </div>
              </div>
              {analyses[0].gemini_analysis?.overall_rating != null && (
                <div className="stat-card" style={{
                  borderTop: "2px solid rgba(16,185,129,0.4)",
                  background: "linear-gradient(180deg, rgba(16,185,129,0.06) 0%, var(--bg-card) 40%)",
                }}>
                  <div className="stat-label">{t.dashboard.ratingLast}</div>
                  <div className="stat-value" style={{ fontSize: "28px", color: "var(--accent-green)" }}>
                    {analyses[0].gemini_analysis.overall_rating.toFixed(1)}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* Analysis History */}
      <section className="animate-in animate-delay-2">
        <h2 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "16px" }}>
          {t.dashboard.historyTitle}
        </h2>

        {analyses.length === 0 ? (
          <div className="glass-card" style={{ padding: "48px", textAlign: "center" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "16px", color: "var(--text-muted)" }}><CameraIcon size={48} /></div>
            <p style={{ fontSize: "16px", fontWeight: 600, marginBottom: "8px" }}>
              {t.dashboard.noAnalyses}
            </p>
            <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginBottom: "20px" }}>
              {t.dashboard.noAnalysesHint}
            </p>
            <button className="btn-primary" onClick={() => router.push("/")}>
              {t.dashboard.uploadPhoto}
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
                      {t.dashboard.analysisNum} #{analyses.length - i}
                    </span>
                    <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                      {new Date(a.created_at).toLocaleString(dateLocale)}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: "16px", fontSize: "13px", color: "var(--text-secondary)" }}>
                    <span>
                      {t.dashboard.shoulderHipShort}: <strong style={{ color: "var(--text-primary)" }}>
                        {a.proportions?.shoulder_to_hip_ratio?.toFixed(2)}
                      </strong>
                    </span>
                    <span>
                      {t.dashboard.arms}: <strong style={{ color: "var(--text-primary)" }}>
                        {a.proportions?.arm_symmetry?.toFixed(1)}%
                      </strong>
                    </span>
                    {a.gemini_analysis?.photo_type !== "torso_only" && (a.proportions?.leg_symmetry ?? 0) > 0 && (
                    <span>
                      {t.dashboard.legs}: <strong style={{ color: "var(--text-primary)" }}>
                        {a.proportions?.leg_symmetry?.toFixed(1)}%
                      </strong>
                    </span>
                    )}
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

export default function DashboardPage() {
  return (
    <AuthGuard>
      <DashboardContent />
    </AuthGuard>
  );
}
