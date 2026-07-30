/**
 * Statistics Page — Progress comparison with interactive SVG charts.
 * Shows trends for overall rating, muscle group scores, and body proportions.
 */

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { listAnalyses } from "@/lib/api";
import type { AnalysisSummary } from "@/types";
import { TrendingUpIcon, DumbbellIcon, BarChartIcon } from "@/components/ui/Icons";
import AuthGuard from "@/components/layout/AuthGuard";

// ── Types ────────────────────────────────────────────────────

interface ChartPoint {
  x: number;
  y: number;
  value: number;
  label: string;
  date: string;
}

interface ChartSeries {
  key: string;
  name: string;
  color: string;
  points: ChartPoint[];
}

interface TooltipData {
  x: number;
  y: number;
  lines: { name: string; value: string; color: string }[];
  date: string;
}

// ── Chart Colors ─────────────────────────────────────────────

const MUSCLE_COLORS: Record<string, string> = {
  shoulders: "#8b5cf6",
  chest:     "#3b82f6",
  back:      "#06b6d4",
  arms:      "#f59e0b",
  core:      "#10b981",
  legs:      "#ef4444",
};

const MUSCLE_LABELS: Record<string, string> = {
  shoulders: "Плечі",
  chest:     "Груди",
  back:      "Спина",
  arms:      "Руки",
  core:      "Кор",
  legs:      "Ноги",
};

const PROPORTION_COLORS: Record<string, string> = {
  shoulder_to_hip: "#8b5cf6",
  waist_shoulder:  "#06b6d4",
  body_fat:        "#10b981",
  dryness:         "#f59e0b",
  muscle_mass:     "#3b82f6",
};

const PROPORTION_LABELS: Record<string, string> = {
  shoulder_to_hip: "Плечі/Стегна",
  waist_shoulder:  "Талія/Плечі",
  body_fat:        "BF%",
  dryness:         "Сухість",
  muscle_mass:     "М'яз. маса",
};

// ── SVG Line Chart Component ─────────────────────────────────

function LineChart({
  series,
  height = 300,
  yMin: yMinProp,
  yMax: yMaxProp,
  yLabel,
  showLegend = false,
  gradientId,
  animationKey,
}: {
  series: ChartSeries[];
  height?: number;
  yMin?: number;
  yMax?: number;
  yLabel?: string;
  showLegend?: boolean;
  gradientId: string;
  animationKey?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(600);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());

  // Responsive width
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    ro.observe(el);
    setContainerWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const padding = { top: 20, right: 24, bottom: 36, left: yLabel ? 52 : 44 };
  const chartW = containerWidth - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  // Compute Y bounds across visible series
  const visibleSeries = series.filter((s) => !hiddenSeries.has(s.key));
  const allValues = visibleSeries.flatMap((s) => s.points.map((p) => p.value));

  let yMin = yMinProp ?? Math.min(...(allValues.length ? allValues : [0]));
  let yMax = yMaxProp ?? Math.max(...(allValues.length ? allValues : [10]));
  // Add 10% padding
  const yRange = yMax - yMin || 1;
  yMin = yMin - yRange * 0.08;
  yMax = yMax + yRange * 0.08;

  const numPoints = series[0]?.points.length || 0;

  const scaleX = (i: number) => padding.left + (numPoints > 1 ? (i / (numPoints - 1)) * chartW : chartW / 2);
  const scaleY = (v: number) => padding.top + chartH - ((v - yMin) / (yMax - yMin)) * chartH;

  // Build path
  const buildPath = (points: ChartPoint[]) => {
    if (points.length === 0) return "";
    return points
      .map((p, i) => `${i === 0 ? "M" : "L"} ${scaleX(i).toFixed(1)} ${scaleY(p.value).toFixed(1)}`)
      .join(" ");
  };

  // Build area path (for gradient fill under single-line charts)
  const buildAreaPath = (points: ChartPoint[]) => {
    if (points.length === 0) return "";
    const linePath = buildPath(points);
    const lastX = scaleX(points.length - 1);
    const firstX = scaleX(0);
    const bottom = padding.top + chartH;
    return `${linePath} L ${lastX.toFixed(1)} ${bottom} L ${firstX.toFixed(1)} ${bottom} Z`;
  };

  // Compute path length for animation
  const computePathLength = (points: ChartPoint[]) => {
    let len = 0;
    for (let i = 1; i < points.length; i++) {
      const dx = scaleX(i) - scaleX(i - 1);
      const dy = scaleY(points[i].value) - scaleY(points[i - 1].value);
      len += Math.sqrt(dx * dx + dy * dy);
    }
    return Math.ceil(len) || 1000;
  };

  // Y-axis grid lines
  const gridLines = 5;
  const yTicks = Array.from({ length: gridLines }, (_, i) => {
    const v = yMin + ((yMax - yMin) / (gridLines - 1)) * i;
    return { value: v, y: scaleY(v) };
  });

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (numPoints === 0 || visibleSeries.length === 0) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      // Find nearest point index
      let closestIdx = 0;
      let closestDist = Infinity;
      for (let i = 0; i < numPoints; i++) {
        const d = Math.abs(scaleX(i) - mx);
        if (d < closestDist) {
          closestDist = d;
          closestIdx = i;
        }
      }
      if (closestDist > 40) {
        setTooltip(null);
        return;
      }
      const lines = visibleSeries.map((s) => ({
        name: s.name,
        value: s.points[closestIdx]?.value.toFixed(2) ?? "—",
        color: s.color,
      }));
      setTooltip({
        x: scaleX(closestIdx),
        y: Math.min(...visibleSeries.map((s) => scaleY(s.points[closestIdx]?.value ?? 0))),
        lines,
        date: series[0].points[closestIdx]?.date ?? "",
      });
    },
    [numPoints, visibleSeries, series, containerWidth]
  );

  const toggleSeries = (key: string) => {
    setHiddenSeries((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (numPoints === 0) {
    return (
      <div style={{ padding: "48px", textAlign: "center", color: "var(--text-muted)" }}>
        Недостатньо даних для побудови графіку
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%" }}>
      <svg
        key={animationKey}
        width={containerWidth}
        height={height}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
        style={{ display: "block" }}
      >
        <defs>
          {/* Gradient fills for area under each series */}
          {series.map((s) => (
            <linearGradient key={`grad-${s.key}`} id={`${gradientId}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity="0.3" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0.02" />
            </linearGradient>
          ))}
        </defs>

        {/* Y-axis grid */}
        {yTicks.map((tick, i) => (
          <g key={`tick-${i}`}>
            <line
              x1={padding.left}
              y1={tick.y}
              x2={padding.left + chartW}
              y2={tick.y}
              stroke="var(--border-subtle)"
              strokeWidth="1"
            />
            <text
              x={padding.left - 8}
              y={tick.y + 4}
              textAnchor="end"
              fill="var(--text-muted)"
              fontSize="11"
              fontFamily="Inter, sans-serif"
            >
              {tick.value.toFixed(1)}
            </text>
          </g>
        ))}

        {/* X-axis date labels */}
        {series[0]?.points.map((p, i) => {
          // Show only a subset of labels if too many points
          const showLabel =
            numPoints <= 8 || i === 0 || i === numPoints - 1 || i % Math.ceil(numPoints / 6) === 0;
          if (!showLabel) return null;
          return (
            <text
              key={`xlabel-${i}`}
              x={scaleX(i)}
              y={height - 6}
              textAnchor="middle"
              fill="var(--text-muted)"
              fontSize="10"
              fontFamily="Inter, sans-serif"
            >
              {p.label}
            </text>
          );
        })}

        {/* Vertical hover line */}
        {tooltip && (
          <line
            x1={tooltip.x}
            y1={padding.top}
            x2={tooltip.x}
            y2={padding.top + chartH}
            stroke="var(--border-default)"
            strokeWidth="1"
            strokeDasharray="4,4"
          />
        )}

        {/* Area fills (only for single-series or visible series) */}
        {visibleSeries.map((s) => (
          <path
            key={`area-${s.key}`}
            d={buildAreaPath(s.points)}
            fill={`url(#${gradientId}-${s.key})`}
            opacity={0.6}
          />
        ))}

        {/* Lines */}
        {visibleSeries.map((s) => {
          const pathLen = computePathLength(s.points);
          return (
            <path
              key={`line-${s.key}`}
              d={buildPath(s.points)}
              className="chart-line"
              stroke={s.color}
              style={{ "--line-length": pathLen } as React.CSSProperties}
            />
          );
        })}

        {/* Dots */}
        {visibleSeries.map((s) =>
          s.points.map((p, i) => (
            <circle
              key={`dot-${s.key}-${i}`}
              cx={scaleX(i)}
              cy={scaleY(p.value)}
              r={4}
              fill={s.color}
              stroke="var(--bg-card)"
              strokeWidth="2"
              className="chart-dot"
              style={{ color: s.color }}
            />
          ))
        )}

        {/* Y axis label */}
        {yLabel && (
          <text
            x={14}
            y={height / 2}
            transform={`rotate(-90, 14, ${height / 2})`}
            textAnchor="middle"
            fill="var(--text-muted)"
            fontSize="11"
            fontFamily="Inter, sans-serif"
          >
            {yLabel}
          </text>
        )}
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="chart-tooltip"
          style={{
            left: tooltip.x + 16,
            top: tooltip.y - 12,
            transform: tooltip.x > containerWidth * 0.7 ? "translateX(calc(-100% - 32px))" : undefined,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: "4px", color: "var(--text-primary)" }}>
            {tooltip.date}
          </div>
          {tooltip.lines.map((l, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: l.color, flexShrink: 0 }} />
              <span style={{ color: "var(--text-secondary)" }}>{l.name}:</span>
              <span style={{ fontWeight: 700, color: l.color }}>{l.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Legend */}
      {showLegend && (
        <div className="chart-legend">
          {series.map((s) => (
            <button
              key={s.key}
              className="chart-legend-item"
              onClick={() => toggleSeries(s.key)}
              style={{ opacity: hiddenSeries.has(s.key) ? 0.35 : 1 }}
            >
              <span className="chart-legend-dot" style={{ background: s.color }} />
              {s.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Stat Delta Badge ─────────────────────────────────────────

function DeltaBadge({ first, last, suffix = "" }: { first: number; last: number; suffix?: string }) {
  const delta = last - first;
  if (Math.abs(delta) < 0.01) return null;
  const isUp = delta > 0;
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: "3px",
      fontSize: "11px",
      fontWeight: 700,
      color: isUp ? "#10b981" : "#ef4444",
      background: isUp ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)",
      padding: "3px 8px",
      borderRadius: "6px",
      border: `1px solid ${isUp ? "rgba(16,185,129,0.25)" : "rgba(239,68,68,0.25)"}`,
    }}>
      {isUp ? "↑" : "↓"} {Math.abs(delta).toFixed(2)}{suffix}
    </span>
  );
}

// ── Main Page Content ────────────────────────────────────────

type TabKey = "rating" | "muscles" | "proportions";

function StatisticsContent() {
  const router = useRouter();
  const [analyses, setAnalyses] = useState<AnalysisSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>("rating");

  useEffect(() => {
    listAnalyses()
      .then((data) => {
        // Sort oldest → newest for charts
        setAnalyses([...data].reverse());
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="page-container">
        <div className="skeleton" style={{ width: 220, height: 32, marginBottom: 24 }} />
        <div className="skeleton" style={{ width: "100%", height: 56, marginBottom: 24 }} />
        <div className="skeleton" style={{ width: "100%", height: 350 }} />
      </div>
    );
  }

  // ── Build chart data ─────────────────────────────────────

  const formatDate = (d: string) => {
    const date = new Date(d);
    return date.toLocaleDateString("uk-UA", { day: "numeric", month: "short" });
  };

  const formatDateFull = (d: string) => {
    return new Date(d).toLocaleDateString("uk-UA", { day: "numeric", month: "long", year: "numeric" });
  };

  // 1. Overall Rating series
  const ratingPoints: ChartPoint[] = analyses
    .filter((a) => a.gemini_analysis?.overall_rating != null)
    .map((a, i) => ({
      x: i,
      y: 0,
      value: a.gemini_analysis!.overall_rating!,
      label: formatDate(a.created_at),
      date: formatDateFull(a.created_at),
    }));

  const ratingSeries: ChartSeries[] = [
    { key: "rating", name: "Загальний рейтинг", color: "#8b5cf6", points: ratingPoints },
  ];

  // 2. Muscle groups series
  // For legs: if the photo is torso_only, the score is 0 — carry forward the last known value
  const muscleKeys = ["shoulders", "chest", "back", "arms", "core", "legs"] as const;
  const muscleSeries: ChartSeries[] = muscleKeys.map((mk) => {
    const withMuscleData = analyses.filter((a) => a.gemini_analysis?.muscle_groups != null);
    let lastKnownValue = 0;
    const points: ChartPoint[] = [];

    for (let i = 0; i < withMuscleData.length; i++) {
      const a = withMuscleData[i];
      const mg = a.gemini_analysis!.muscle_groups!;
      const rawScore = (mg as any)[mk]?.score ?? 0;
      const isTorsoOnly = a.gemini_analysis?.photo_type === "torso_only";

      // If legs (or any group) has 0 score on a torso-only scan, use the last known value
      if (rawScore <= 0 && isTorsoOnly) {
        // Skip this point entirely if we have no prior data for this group
        if (lastKnownValue <= 0) continue;
        points.push({
          x: points.length,
          y: 0,
          value: lastKnownValue,
          label: formatDate(a.created_at),
          date: formatDateFull(a.created_at),
        });
      } else {
        lastKnownValue = rawScore;
        points.push({
          x: points.length,
          y: 0,
          value: rawScore,
          label: formatDate(a.created_at),
          date: formatDateFull(a.created_at),
        });
      }
    }

    return {
      key: mk,
      name: MUSCLE_LABELS[mk],
      color: MUSCLE_COLORS[mk],
      points,
    };
  });

  // 3. Proportions series
  const proportionsSeries: ChartSeries[] = [
    {
      key: "shoulder_to_hip",
      name: PROPORTION_LABELS.shoulder_to_hip,
      color: PROPORTION_COLORS.shoulder_to_hip,
      points: analyses.map((a, i) => ({
        x: i, y: 0,
        value: a.proportions?.shoulder_to_hip_ratio ?? 0,
        label: formatDate(a.created_at),
        date: formatDateFull(a.created_at),
      })),
    },
    {
      key: "waist_shoulder",
      name: PROPORTION_LABELS.waist_shoulder,
      color: PROPORTION_COLORS.waist_shoulder,
      points: analyses
        .filter((a) => a.gemini_analysis?.waist_shoulder_ratio != null)
        .map((a, i) => ({
          x: i, y: 0,
          value: a.gemini_analysis!.waist_shoulder_ratio,
          label: formatDate(a.created_at),
          date: formatDateFull(a.created_at),
        })),
    },
    {
      key: "body_fat",
      name: PROPORTION_LABELS.body_fat,
      color: PROPORTION_COLORS.body_fat,
      points: analyses
        .filter((a) => a.gemini_analysis?.body_fat_pct != null)
        .map((a, i) => ({
          x: i, y: 0,
          value: a.gemini_analysis!.body_fat_pct,
          label: formatDate(a.created_at),
          date: formatDateFull(a.created_at),
        })),
    },
    {
      key: "dryness",
      name: PROPORTION_LABELS.dryness,
      color: PROPORTION_COLORS.dryness,
      points: analyses
        .filter((a) => a.gemini_analysis?.dryness_score != null)
        .map((a, i) => ({
          x: i, y: 0,
          value: a.gemini_analysis!.dryness_score!,
          label: formatDate(a.created_at),
          date: formatDateFull(a.created_at),
        })),
    },
    {
      key: "muscle_mass",
      name: PROPORTION_LABELS.muscle_mass,
      color: PROPORTION_COLORS.muscle_mass,
      points: analyses
        .filter((a) => a.gemini_analysis?.muscle_mass_score != null)
        .map((a, i) => ({
          x: i, y: 0,
          value: a.gemini_analysis!.muscle_mass_score!,
          label: formatDate(a.created_at),
          date: formatDateFull(a.created_at),
        })),
    },
  ];

  // ── Summary stats ──────────────────────────────────────────

  const getLatest = (points: ChartPoint[]) => points[points.length - 1]?.value ?? null;
  const getFirst = (points: ChartPoint[]) => points[0]?.value ?? null;

  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: "rating", label: "Загальна оцінка", icon: <TrendingUpIcon size={15} /> },
    { key: "muscles", label: "М'язові групи", icon: <DumbbellIcon size={15} /> },
    { key: "proportions", label: "Пропорції тіла", icon: <BarChartIcon size={15} /> },
  ];

  return (
    <div className="page-container">
      {/* Header */}
      <section className="animate-in" style={{ marginBottom: "28px" }}>
        <h1 style={{ fontSize: "28px", fontWeight: 800, letterSpacing: "-0.02em", marginBottom: "8px" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
            <TrendingUpIcon size={22} /> Статистика прогресу
          </span>
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "14px", margin: 0 }}>
          Порівняння ваших показників з часом — відстежуйте зміни та прогрес
        </p>
      </section>

      {analyses.length < 2 ? (
        /* Not enough data */
        <section className="animate-in animate-delay-1">
          <div className="glass-card" style={{ padding: "56px 32px", textAlign: "center" }}>
            <div style={{ fontSize: "48px", marginBottom: "16px", opacity: 0.3 }}>📊</div>
            <h2 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "8px" }}>
              Недостатньо даних
            </h2>
            <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginBottom: "20px", maxWidth: "400px", margin: "0 auto 20px" }}>
              Для побудови графіків прогресу потрібно мінімум 2 аналізи. Зробіть ще {2 - analyses.length} аналіз{analyses.length === 0 ? "и" : ""}.
            </p>
            <button className="btn-primary" onClick={() => router.push("/")}>
              Зробити аналіз
            </button>
          </div>
        </section>
      ) : (
        <>
          {/* Summary cards */}
          <section className="animate-in animate-delay-1" style={{ marginBottom: "24px" }}>
            {/* Row 1: General stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", marginBottom: "12px" }}>
              <div className="stat-card" style={{
                borderTop: "2px solid rgba(59,130,246,0.4)",
                background: "linear-gradient(180deg, rgba(59,130,246,0.06) 0%, var(--bg-card) 40%)",
              }}>
                <div className="stat-label">Всього аналізів</div>
                <div className="stat-value gradient-text" style={{ fontSize: "32px" }}>{analyses.length}</div>
              </div>
              <div className="stat-card" style={{
                borderTop: "2px solid rgba(139,92,246,0.4)",
                background: "linear-gradient(180deg, rgba(139,92,246,0.06) 0%, var(--bg-card) 40%)",
              }}>
                <div className="stat-label">Рейтинг (останній)</div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "4px" }}>
                  <span className="stat-value" style={{ fontSize: "28px", color: "#8b5cf6" }}>
                    {getLatest(ratingPoints)?.toFixed(1) ?? "—"}
                  </span>
                  {ratingPoints.length >= 2 && (
                    <DeltaBadge first={getFirst(ratingPoints)!} last={getLatest(ratingPoints)!} />
                  )}
                </div>
              </div>
              <div className="stat-card" style={{
                borderTop: "2px solid rgba(16,185,129,0.4)",
                background: "linear-gradient(180deg, rgba(16,185,129,0.06) 0%, var(--bg-card) 40%)",
              }}>
                <div className="stat-label">BF% (останній)</div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "4px" }}>
                  <span className="stat-value" style={{ fontSize: "28px", color: PROPORTION_COLORS.body_fat }}>
                    {proportionsSeries[2]?.points.length
                      ? getLatest(proportionsSeries[2].points)?.toFixed(1) + "%"
                      : "—"}
                  </span>
                  {proportionsSeries[2]?.points.length >= 2 && (
                    <DeltaBadge
                      first={getFirst(proportionsSeries[2].points)!}
                      last={getLatest(proportionsSeries[2].points)!}
                      suffix="%"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Row 2: All muscle groups */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "10px" }}>
              {muscleSeries.map((ms) => (
                <div key={ms.key} className="stat-card" style={{
                  padding: "16px",
                  borderLeft: `3px solid ${ms.color}40`,
                  background: `linear-gradient(135deg, ${ms.color}08 0%, var(--bg-card) 60%)`,
                }}>
                  <div className="stat-label" style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", marginBottom: "6px" }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: ms.color, boxShadow: `0 0 6px ${ms.color}60`, flexShrink: 0 }} />
                    {ms.name}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "22px", fontWeight: 800, color: ms.color, letterSpacing: "-0.02em" }}>
                      {ms.points.length ? getLatest(ms.points)?.toFixed(1) : "—"}
                    </span>
                    {ms.points.length >= 2 && (
                      <DeltaBadge
                        first={getFirst(ms.points)!}
                        last={getLatest(ms.points)!}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Tab Bar */}
          <section className="animate-in animate-delay-2" style={{ marginBottom: "20px" }}>
            <div className="stats-tabs">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  className={`stats-tab ${activeTab === t.key ? "active" : ""}`}
                  onClick={() => setActiveTab(t.key)}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                    {t.icon} {t.label}
                  </span>
                </button>
              ))}
            </div>
          </section>

          {/* Charts */}
          <section className="animate-in animate-delay-3">
            {activeTab === "rating" && (
              <div className="chart-container">
                <h3 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "4px" }}>
                  Загальний фітнес-рейтинг
                </h3>
                <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "16px" }}>
                  Як змінюється ваш загальний рейтинг від аналізу до аналізу (шкала 1-10)
                </p>
                <LineChart
                  series={ratingSeries}
                  height={340}
                  yMin={0}
                  yMax={10}
                  yLabel="Рейтинг"
                  gradientId="rating-grad"
                  animationKey="rating"
                />
              </div>
            )}

            {activeTab === "muscles" && (
              <div className="chart-container">
                <h3 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "4px" }}>
                  Оцінки м'язових груп
                </h3>
                <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "16px" }}>
                  Прогрес кожної м'язової групи (шкала 1-10). Натисніть легенду щоб приховати/показати лінію
                </p>
                <LineChart
                  series={muscleSeries}
                  height={380}
                  yMin={0}
                  yMax={10}
                  yLabel="Оцінка"
                  showLegend
                  gradientId="muscles-grad"
                  animationKey="muscles"
                />
              </div>
            )}

            {activeTab === "proportions" && (
              <div className="chart-container">
                <h3 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "4px" }}>
                  Пропорції та показники тіла
                </h3>
                <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "16px" }}>
                  Зміни пропорцій, відсотка жиру, сухості та м'язової маси. Натисніть легенду щоб фільтрувати
                </p>
                <LineChart
                  series={proportionsSeries}
                  height={380}
                  showLegend
                  gradientId="props-grad"
                  animationKey="proportions"
                />
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

export default function StatisticsPage() {
  return (
    <AuthGuard>
      <StatisticsContent />
    </AuthGuard>
  );
}
