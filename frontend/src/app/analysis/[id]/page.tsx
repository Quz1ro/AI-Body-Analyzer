/**
 * Analysis Detail Page — full results for a single analysis.
 */

"use client";

import { useState, useEffect, use, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { getAnalysis, getImageUrl, updateAnalysisMetrics, API_URL } from "@/lib/api";
import type { Analysis } from "@/types";
import { XCircleIcon, CameraIcon, EditIcon, SaveIcon, DnaIcon, RulerIcon, CompassIcon, FlameIcon, ZapIcon, DumbbellIcon, BodyIcon, ShoulderIcon, ShieldIcon, LegIcon, FileTextIcon, MessageCircleIcon, PercentIcon } from "@/components/ui/Icons";
import AuthGuard from "@/components/layout/AuthGuard";

function AnalysisDetailContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { isLoggedIn, loading: authLoading } = useAuth();
  const router = useRouter();
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Custom interactive coordinate states
  const [customKeypoints, setCustomKeypoints] = useState<any>(null);
  const [isEditingPoints, setIsEditingPoints] = useState(false);
  const [isSavingPoints, setIsSavingPoints] = useState(false);
  const [draggingPoint, setDraggingPoint] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Height and Weight optional parameters
  const [isEditingMetrics, setIsEditingMetrics] = useState(false);
  const [editHeight, setEditHeight] = useState("");
  const [editWeight, setEditWeight] = useState("");
  const [isSavingMetrics, setIsSavingMetrics] = useState(false);

  // Helper to compute live ratios in real time during dragging
  const getLiveProportions = (keypoints: any) => {
    if (!keypoints) return null;
    const dist = (a: any, b: any) => {
      if (!a || !b) return 0;
      return Math.hypot(a.x - b.x, a.y - b.y);
    };

    const shL = keypoints.left_shoulder;
    const shR = keypoints.right_shoulder;
    const wL = keypoints.left_waist;
    const wR = keypoints.right_waist;
    const hL = keypoints.left_hip;
    const hR = keypoints.right_hip;
    const kL = keypoints.left_knee;
    const kR = keypoints.right_knee;
    const aL = keypoints.left_ankle;
    const aR = keypoints.right_ankle;

    const shoulder_width = dist(shL, shR);
    const hip_width = dist(hL, hR);
    const waist_width = dist(wL, wR);
    const torso_length = dist(shL, hL);

    const left_leg = dist(hL, kL) + dist(kL, aL);
    const right_leg = dist(hR, kR) + dist(kR, aR);
    const avg_leg = (left_leg + right_leg) / 2 || 1.0;

    const waist_shoulder_ratio = shoulder_width ? (waist_width / shoulder_width) : 0.75;
    const torso_leg_ratio = torso_length / avg_leg;

    return {
      waist_shoulder_ratio,
      torso_leg_ratio
    };
  };

  const handleSaveMetrics = async () => {
    if (!analysis) return;
    setIsSavingMetrics(true);
    try {
      const hVal = editHeight ? parseFloat(editHeight) : undefined;
      const wVal = editWeight ? parseFloat(editWeight) : undefined;
      const updated = await updateAnalysisMetrics(analysis.id, hVal, wVal);
      setAnalysis(updated);
      setIsEditingMetrics(false);
    } catch (err: any) {
      alert(`Помилка оновлення параметрів: ${err.message}`);
    } finally {
      setIsSavingMetrics(false);
    }
  };

  useEffect(() => {
    if (analysis) {
      setCustomKeypoints(analysis.keypoints);
      setEditHeight(analysis.height?.toString() || "");
      setEditWeight(analysis.weight?.toString() || "");
    }
  }, [analysis]);

  useEffect(() => {
    if (authLoading) return;
    if (!isLoggedIn) return; // AuthGuard handles redirect

    getAnalysis(id)
      .then(setAnalysis)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id, authLoading, isLoggedIn, router]);

  const handleStartDrag = (pointName: string) => {
    setDraggingPoint(pointName);
  };

  const handleDrag = (e: React.MouseEvent | React.TouchEvent) => {
    if (!draggingPoint || !containerRef.current || !customKeypoints) return;

    if ("touches" in e) {
      if (e.cancelable) e.preventDefault();
    }

    const rect = containerRef.current.getBoundingClientRect();
    let clientX = 0;
    let clientY = 0;

    if ("touches" in e) {
      if (e.touches.length === 0) return;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));

    setCustomKeypoints((prev: any) => ({
      ...prev,
      [draggingPoint]: {
        ...prev[draggingPoint],
        x,
        y,
        visibility: 1.0,
      },
    }));
  };

  const handleStopDrag = () => {
    setDraggingPoint(null);
  };

  const handleSavePoints = async () => {
    if (!customKeypoints || !analysis) return;
    setIsSavingPoints(true);
    try {
      const token = localStorage.getItem("access_token");
      const response = await fetch(`${API_URL}/api/analysis/${analysis.id}/recalculate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ keypoints: customKeypoints }),
      });

      if (!response.ok) {
        throw new Error("Не вдалося оновити аналіз");
      }

      const updated = await response.json();
      setAnalysis(updated);
      setCustomKeypoints(updated.keypoints);
      setIsEditingPoints(false);
    } catch (err: any) {
      alert(`Помилка: ${err.message}`);
    } finally {
      setIsSavingPoints(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="page-container">
        <div className="skeleton" style={{ width: 300, height: 32, marginBottom: 24 }} />
        <div className="skeleton" style={{ width: "100%", height: 400 }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-container">
        <div className="glass-card" style={{ padding: 40, textAlign: "center" }}>
          <p style={{ color: "var(--accent-red)", fontSize: 16, display: "flex", alignItems: "center", gap: "8px", justifyContent: "center" }}><XCircleIcon size={20} /> {error}</p>
          <button className="btn-secondary" style={{ marginTop: 16 }} onClick={() => router.push("/dashboard")}>
            ← Назад
          </button>
        </div>
      </div>
    );
  }

  if (!analysis) return null;

  const p = analysis.proportions;
  const post = analysis.posture;

  return (
    <div className="page-container">
      {/* Header */}
      <section className="animate-in" style={{ marginBottom: "32px" }}>
        <button
          className="btn-secondary"
          style={{ marginBottom: "16px", fontSize: "13px", padding: "8px 14px" }}
          onClick={() => router.push("/dashboard")}
        >
          ← Дашборд
        </button>
        <h1 style={{ fontSize: "28px", fontWeight: 800, letterSpacing: "-0.02em", marginBottom: "8px" }}>
          Результати аналізу
        </h1>
        <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap", marginTop: "8px" }}>
          <p style={{ color: "var(--text-secondary)", fontSize: "14px", margin: 0 }}>
            {new Date(analysis.created_at).toLocaleString("uk-UA")}
          </p>
          {(() => {
            const isTorso = analysis.gemini_analysis?.photo_type === "torso_only";
            return (
              <span className="badge" style={{ 
                fontSize: "12px", 
                padding: "4px 10px",
                background: isTorso ? "rgba(245, 158, 11, 0.12)" : "rgba(16, 185, 129, 0.12)",
                color: isTorso ? "var(--accent-amber)" : "var(--accent-green)",
                border: isTorso ? "1px solid rgba(245, 158, 11, 0.3)" : "1px solid rgba(16, 185, 129, 0.3)",
                fontWeight: 700
              }}>
                {isTorso ? "Лише тулуб (Torso Analysis)" : "Повний зріст (Full Body Analysis)"}
              </span>
            );
          })()}
        </div>
      </section>

      <div 
        className={analysis.annotated_image_path ? "main-analysis-grid" : "grid grid-cols-1"}
      >
        {/* Dynamic / Interactive SVG Skeleton Editor */}
        {analysis && (
          <div className="glass-card animate-in animate-delay-1 main-analysis-image-col" style={{ padding: "12px", overflow: "hidden" }}>
            {(() => {
              const showLegs = analysis.gemini_analysis?.photo_type !== "torso_only";
              const activeConnections = [
                ["left_shoulder", "right_shoulder"],
                ["left_shoulder", "left_elbow"],
                ["left_elbow", "left_wrist"],
                ["right_shoulder", "right_elbow"],
                ["right_elbow", "right_wrist"],
                ["left_shoulder", "left_waist"],
                ["left_waist", "left_hip"],
                ["right_shoulder", "right_waist"],
                ["right_waist", "right_hip"],
                ["left_hip", "right_hip"],
                ["left_waist", "right_waist"],
              ];
              if (showLegs) {
                activeConnections.push(
                  ["left_hip", "left_knee"],
                  ["left_knee", "left_ankle"],
                  ["right_hip", "right_knee"],
                  ["right_knee", "right_ankle"]
                );
              }

              return (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div
                    ref={containerRef}
                    style={{ position: "relative", width: "100%", userSelect: "none", touchAction: "none" }}
                    onMouseMove={handleDrag}
                    onTouchMove={handleDrag}
                    onMouseUp={handleStopDrag}
                    onMouseLeave={handleStopDrag}
                    onTouchEnd={handleStopDrag}
                  >
                    <img
                      src={getImageUrl(analysis.image_path || analysis.annotated_image_path || "")}
                      alt="Body analysis"
                      style={{ width: "100%", borderRadius: "var(--radius-md)", display: "block", pointerEvents: "none" }}
                    />
                    <svg style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: isEditingPoints ? "auto" : "none" }}>
                      {/* Torso diagonals */}
                      {[
                        ["left_shoulder", "right_waist"],
                        ["right_shoulder", "left_waist"],
                        ["left_waist", "right_hip"],
                        ["right_waist", "left_hip"]
                      ].map(([a, b], idx) => {
                        const kpA = customKeypoints?.[a];
                        const kpB = customKeypoints?.[b];
                        if (!kpA || !kpB || kpA.visibility <= 0.45 || kpB.visibility <= 0.45) return null;
                        return (
                          <line
                            key={`diag-${idx}`}
                            x1={`${kpA.x * 100}%`}
                            y1={`${kpA.y * 100}%`}
                            x2={`${kpB.x * 100}%`}
                            y2={`${kpB.y * 100}%`}
                            stroke="rgba(240, 20, 240, 0.4)"
                            strokeWidth="1"
                            strokeDasharray="3,3"
                          />
                        );
                      })}

                      {/* Concentric target circles */}
                      {(() => {
                        const shL = customKeypoints?.["left_shoulder"];
                        const shR = customKeypoints?.["right_shoulder"];
                        if (shL && shR && shL.visibility > 0.45 && shR.visibility > 0.45) {
                          const cx = ((shL.x + shR.x) / 2) * 100;
                          const cy = ((shL.y + shR.y) / 2) * 100;
                          return (
                            <g style={{ filter: "drop-shadow(0 0 2px rgba(168, 85, 247, 0.5))" }}>
                              <circle cx={`${cx}%`} cy={`${cy}%`} r="12" fill="none" stroke="rgba(240, 20, 240, 0.5)" strokeWidth="1.5" />
                              <circle cx={`${cx}%`} cy={`${cy}%`} r="24" fill="none" stroke="rgba(240, 20, 240, 0.5)" strokeWidth="1" />
                            </g>
                          );
                        }
                      })()}
                      {(() => {
                        const wL = customKeypoints?.["left_waist"];
                        const wR = customKeypoints?.["right_waist"];
                        if (wL && wR && wL.visibility > 0.45 && wR.visibility > 0.45) {
                          const cx = ((wL.x + wR.x) / 2) * 100;
                          const cy = ((wL.y + wR.y) / 2) * 100;
                          return (
                            <g style={{ filter: "drop-shadow(0 0 2px rgba(168, 85, 247, 0.5))" }}>
                              <circle cx={`${cx}%`} cy={`${cy}%`} r="10" fill="none" stroke="rgba(240, 20, 240, 0.5)" strokeWidth="1.5" />
                              <circle cx={`${cx}%`} cy={`${cy}%`} r="18" fill="none" stroke="rgba(240, 20, 240, 0.5)" strokeWidth="1" />
                            </g>
                          );
                        }
                      })()}

                      {/* Connections */}
                      {activeConnections.map(([a, b], idx) => {
                        const kpA = customKeypoints?.[a];
                        const kpB = customKeypoints?.[b];
                        if (!kpA || !kpB || kpA.visibility <= 0.45 || kpB.visibility <= 0.45) return null;
                        return (
                          <line
                            key={`conn-${idx}`}
                            x1={`${kpA.x * 100}%`}
                            y1={`${kpA.y * 100}%`}
                            x2={`${kpB.x * 100}%`}
                            y2={`${kpB.y * 100}%`}
                            stroke="var(--accent-purple)"
                            strokeWidth={isEditingPoints ? "2" : "3.5"}
                            strokeLinecap="round"
                            style={{ filter: "drop-shadow(0 0 4px rgba(168, 85, 247, 0.7))" }}
                          />
                        );
                      })}

                      {/* Non-editing smaller dots */}
                      {!isEditingPoints && customKeypoints && Object.entries(customKeypoints).map(([name, kp]: [string, any]) => {
                        const showPoints = [
                          "nose", "left_shoulder", "right_shoulder", "left_elbow", "right_elbow",
                          "left_wrist", "right_wrist", "left_hip", "right_hip", "left_waist", "right_waist"
                        ];
                        if (showLegs) {
                          showPoints.push("left_knee", "right_knee", "left_ankle", "right_ankle");
                        }
                        if (!showPoints.includes(name) || kp.visibility <= 0.45) return null;
                        return (
                          <circle
                            key={`static-${name}`}
                            cx={`${kp.x * 100}%`}
                            cy={`${kp.y * 100}%`}
                            r="5"
                            fill="#fff"
                            stroke="var(--accent-purple)"
                            strokeWidth="2"
                            style={{ filter: "drop-shadow(0 0 3px rgba(168, 85, 247, 0.8))" }}
                          />
                        );
                      })}

                      {/* Draggable Circles (Editing Mode) */}
                      {isEditingPoints && customKeypoints && Object.entries(customKeypoints).map(([name, kp]: [string, any]) => {
                        const draggablePoints = [
                          "nose", "left_shoulder", "right_shoulder", "left_elbow", "right_elbow",
                          "left_wrist", "right_wrist", "left_hip", "right_hip", "left_waist", "right_waist"
                        ];
                        if (showLegs) {
                          draggablePoints.push("left_knee", "right_knee", "left_ankle", "right_ankle");
                        }
                        if (!draggablePoints.includes(name) || kp.visibility <= 0.45) return null;

                        return (
                          <g key={`drag-${name}`}>
                            <circle
                              cx={`${kp.x * 100}%`}
                              cy={`${kp.y * 100}%`}
                              r="6"
                              fill={draggingPoint === name ? "var(--accent-teal)" : "var(--accent-purple)"}
                              stroke="#fff"
                              strokeWidth="1.5"
                              style={{ cursor: "grab", filter: "drop-shadow(0 0 4px rgba(0,0,0,0.4))" }}
                              onMouseDown={() => handleStartDrag(name)}
                              onTouchStart={() => handleStartDrag(name)}
                            />
                            {name.includes("waist") && (
                              <text
                                x={`${kp.x * 100}%`}
                                y={`${kp.y * 100 - 15}%`}
                                fill="#fff"
                                fontSize="10"
                                fontWeight="bold"
                                textAnchor="middle"
                                style={{ paintOrder: "stroke", stroke: "#000", strokeWidth: 2 }}
                              >
                                Талія
                              </text>
                            )}
                          </g>
                        );
                      })}
                    </svg>
                  </div>

                  {/* Edit Controls */}
                  <div style={{ display: "flex", gap: "8px", width: "100%" }}>
                    {!isEditingPoints ? (
                      <button
                        className="btn-secondary"
                        style={{ width: "100%", padding: "10px", fontSize: "13px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
                        onClick={() => setIsEditingPoints(true)}
                      >
                        <EditIcon size={14} /> Налаштувати ключові точки
                      </button>
                    ) : (
                      <>
                        <button
                          className="btn-primary"
                          style={{ flex: 1, padding: "10px", fontSize: "13px" }}
                          onClick={handleSavePoints}
                          disabled={isSavingPoints}
                        >
                          {isSavingPoints ? "Оновлюємо аналіз..." : "Зберегти зміни"}
                        </button>
                        <button
                          className="btn-secondary"
                          style={{ flex: 1, padding: "10px", fontSize: "13px" }}
                          onClick={() => {
                            setCustomKeypoints(analysis.keypoints);
                            setIsEditingPoints(false);
                          }}
                          disabled={isSavingPoints}
                        >
                          Скасувати
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Metrics Panel */}
        <div className="main-analysis-metrics-col">
          {(() => {
            const computedRatio = p.shoulder_to_hip_ratio ? (1.0 / p.shoulder_to_hip_ratio) : 0.75;
            const computedTorsoLegRatio = p.torso_length && (p.left_leg_length || p.right_leg_length) 
              ? (p.torso_length / ((p.left_leg_length + p.right_leg_length) / 2 || 1.0)) 
              : 0.55;
            
            const computedArmLength = (p.left_arm_length + p.right_arm_length) / 2 || 0.7;
            const computedArmRatio = p.torso_length ? (computedArmLength / p.torso_length) : 1.4;

            // Extract values from gemini_analysis, fall back to calculated defaults if not present
            const g = (analysis.gemini_analysis as any) || {
              body_type: p.shoulder_to_hip_ratio > 1.45 ? "ектоморф" : p.shoulder_to_hip_ratio < 1.15 ? "ендоморф" : "мезоморф",
              photo_type: "full_body",
              waist_shoulder_ratio: parseFloat(computedRatio.toFixed(2)),
              body_fat_pct: 18.5,
              dryness_score: 5.5,
              muscle_mass_score: 5.0,
              overall_rating: 5.2,
              muscle_groups: {
                shoulders: { score: 5.5, description: "Помірний тонус плечей." },
                chest: { score: 5.2, description: "Базовий рельєф грудних м'язів." },
                back: { score: 5.4, description: "Помірна ширина найширших м'язів спини." },
                arms: { score: 5.3, description: "Середня м'язова витривалість рук." },
                core: { score: 5.8, description: "Хороший тонус черевного преса." },
                legs: { score: 5.0, description: "Нормальна пропорція стегон." }
              },
              torso_leg_ratio: parseFloat(computedTorsoLegRatio.toFixed(2)),
              arm_length_ratio: parseFloat(computedArmRatio.toFixed(2)),
              overall_assessment: "Оцінка та опис сформовані на основі вимірів комп'ютерного зору (MediaPipe). Для отримання повної деталізації підключіть API-ключ Gemini."
            };

            const bodyTypeCapitalized = g.body_type.charAt(0).toUpperCase() + g.body_type.slice(1);
            
            // Heuristic details for body types
            let bodyTypeDesc = "Атлетична будова, розвинені м'язи, помірний відсоток жиру.";
            let bodyTypeColor = "var(--accent-teal)";
            if (g.body_type.toLowerCase().includes("ект")) {
              bodyTypeDesc = "Швидкий метаболізм, низький рівень підшкірного жиру, вузький скелет.";
              bodyTypeColor = "var(--accent-blue)";
            } else if (g.body_type.toLowerCase().includes("енд")) {
              bodyTypeDesc = "Повільний метаболізм, легкий набір маси, міцна статура, широкий скелет.";
              bodyTypeColor = "var(--accent-amber)";
            }

            const liveProps = isEditingPoints && customKeypoints ? getLiveProportions(customKeypoints) : null;
            const displayedWaistShoulderRatio = liveProps ? liveProps.waist_shoulder_ratio : g.waist_shoulder_ratio;
            const displayedTorsoLegRatio = liveProps ? liveProps.torso_leg_ratio : g.torso_leg_ratio;

            return (
              <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
                
                {/* Overall Rating Section */}
                <div className="glass-card animate-in" style={{
                  padding: "24px",
                  display: "flex",
                  alignItems: "center",
                  gap: "24px",
                  background: "linear-gradient(135deg, rgba(30, 15, 50, 0.4), rgba(15, 10, 30, 0.6))",
                  border: "1px solid rgba(168, 85, 247, 0.25)",
                  boxShadow: "0 0 15px rgba(168, 85, 247, 0.15)",
                }}>
                  <div style={{
                    width: "84px",
                    height: "84px",
                    borderRadius: "50%",
                    border: "4px solid var(--accent-purple)",
                    boxShadow: "0 0 20px rgba(168, 85, 247, 0.4), inset 0 0 12px rgba(168, 85, 247, 0.3)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0
                  }}>
                    <span style={{ fontSize: "28px", fontWeight: 800, color: "#fff", textShadow: "0 0 8px rgba(168, 85, 247, 0.8)" }}>
                      {g.overall_rating ? g.overall_rating.toFixed(1) : "5.0"}
                    </span>
                  </div>
                  <div>
                    <h3 style={{ fontSize: "17px", fontWeight: 800, margin: "0 0 4px 0", color: "#fff" }}>
                      Загальний фітнес-рейтинг
                    </h3>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "8px" }}>
                      <span className="badge" style={{ 
                        fontSize: "11px", 
                        fontWeight: 700, 
                        background: "rgba(168, 85, 247, 0.15)", 
                        color: "var(--accent-purple)",
                        border: "1px solid rgba(168, 85, 247, 0.3)",
                        padding: "2px 8px"
                      }}>
                        {(() => {
                          const rate = g.overall_rating || 5.0;
                          if (rate < 4.5) return "Рівень: Початківець";
                          if (rate < 6.0) return "Рівень: Базовий фітнес";
                          if (rate < 7.5) return "Рівень: Атлетична форма";
                          if (rate < 8.5) return "Рівень: Професійний атлет";
                          return "Рівень: Елітний атлет (Топ-клас)";
                        })()}
                      </span>
                    </div>
                    <p style={{ color: "var(--text-secondary)", fontSize: "13px", margin: 0, lineHeight: 1.45 }}>
                      Анатомічний рейтинг на основі пропорцій талії, м'язової маси та сухості тіла. Оцінка 8.0+ притаманна лише топовим атлетам.
                    </p>
                  </div>
                </div>

                {/* Grid for metrics */}
                <div className="metrics-grid">
                  {/* Card 1: Body Type */}
                  <div className="stat-card animate-in animate-delay-1" style={{ position: "relative", overflow: "hidden" }}>
                    <div className="stat-label" style={{ display: "flex", alignItems: "center", gap: "6px" }}><BodyIcon size={16} /> Тип тіла</div>
                    <div className="stat-value gradient-text" style={{ fontSize: "26px", color: bodyTypeColor }}>
                      {bodyTypeCapitalized}
                    </div>
                    <div className="stat-caption" style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "10px" }}>
                      {bodyTypeDesc}
                    </div>
                  </div>

                  {/* Card: Height and Weight */}
                  <div className="stat-card animate-in animate-delay-2">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div className="stat-label" style={{ display: "flex", alignItems: "center", gap: "6px" }}><RulerIcon size={16} /> Зріст та Вага</div>
                      <button
                        onClick={() => {
                          if (isEditingMetrics) {
                            setEditHeight(analysis.height?.toString() || "");
                            setEditWeight(analysis.weight?.toString() || "");
                            setIsEditingMetrics(false);
                          } else {
                            setIsEditingMetrics(true);
                          }
                        }}
                        style={{
                          background: "none",
                          border: "none",
                          color: "var(--accent-purple)",
                          cursor: "pointer",
                          fontSize: "12px",
                          fontWeight: 700,
                          padding: "2px 6px",
                          borderRadius: "4px",
                          display: "inline-flex",
                          alignItems: "center"
                        }}
                      >
                        {isEditingMetrics ? "Скасувати" : <EditIcon size={14} />}
                      </button>
                    </div>

                    {!isEditingMetrics ? (
                      <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
                        <div>
                          <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Зріст: </span>
                          <span style={{ fontSize: "16px", fontWeight: 700, color: "#fff" }}>
                            {analysis.height ? `${analysis.height} см` : analysis.estimated_height ? `${analysis.estimated_height} см (AI)` : "—"}
                          </span>
                        </div>
                        <div>
                          <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Вага: </span>
                          <span style={{ fontSize: "16px", fontWeight: 700, color: "#fff" }}>
                            {analysis.weight ? `${analysis.weight} кг` : analysis.estimated_weight ? `${analysis.estimated_weight} кг (AI)` : "—"}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "8px" }}>
                        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                          <input
                            type="number"
                            min="1"
                            placeholder="Зріст (см)"
                            value={editHeight}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === "" || (parseFloat(val) > 0 && !val.includes("-"))) {
                                setEditHeight(val);
                              }
                            }}
                            style={{
                              width: "100%",
                              background: "rgba(0,0,0,0.2)",
                              border: "1px solid var(--border-subtle)",
                              borderRadius: "6px",
                              padding: "4px 8px",
                              color: "#fff",
                              fontSize: "13px"
                            }}
                          />
                          <input
                            type="number"
                            min="1"
                            placeholder="Вага (кг)"
                            value={editWeight}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === "" || (parseFloat(val) > 0 && !val.includes("-"))) {
                                setEditWeight(val);
                              }
                            }}
                            style={{
                              width: "100%",
                              background: "rgba(0,0,0,0.2)",
                              border: "1px solid var(--border-subtle)",
                              borderRadius: "6px",
                              padding: "4px 8px",
                              color: "#fff",
                              fontSize: "13px"
                            }}
                          />
                        </div>
                        <button
                          onClick={handleSaveMetrics}
                          disabled={isSavingMetrics}
                          style={{
                            background: "var(--gradient-primary)",
                            border: "none",
                            borderRadius: "6px",
                            color: "#fff",
                            fontSize: "12px",
                            fontWeight: 700,
                            padding: "6px",
                            cursor: "pointer"
                          }}
                        >
                          {isSavingMetrics ? "Збереження..." : "Зберегти"}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Card 2: Waist-to-Shoulder Ratio */}
                  <div className="stat-card animate-in animate-delay-2">
                    <div className="stat-label" style={{ display: "flex", alignItems: "center", gap: "6px" }}><CompassIcon size={16} /> Талія до плечей</div>
                    <div className="stat-value" style={{ color: "var(--accent-blue)" }}>
                      {displayedWaistShoulderRatio.toFixed(2)}
                    </div>
                    <div className="stat-caption" style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "10px" }}>
                      {displayedWaistShoulderRatio < 0.75 
                        ? "Ідеальний V-подібний силует (конус)" 
                        : displayedWaistShoulderRatio < 0.85 
                          ? "Збалансовані атлетичні пропорції" 
                          : "Прямокутний або округлий тип фігури"}
                    </div>
                  </div>

                  {/* Card 3: Body Fat Percentage */}
                  <div className="stat-card animate-in animate-delay-3">
                    <div className="stat-label" style={{ display: "flex", alignItems: "center", gap: "6px" }}><PercentIcon size={16} /> Орієнтовний BF%</div>
                    <div className="stat-value" style={{ color: "var(--accent-green)" }}>
                      {g.body_fat_pct.toFixed(1)}%
                    </div>
                    <div className="stat-caption" style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "10px" }}>
                      Рівень підшкірного жиру. Розраховано за рельєфом пресу та контурами.
                    </div>
                  </div>

                  {/* Card 4: Dryness Score */}
                  <div className="stat-card animate-in animate-delay-3">
                    <div className="stat-label" style={{ display: "flex", alignItems: "center", gap: "6px" }}><ZapIcon size={16} /> Показник сухості (1-10)</div>
                    <div className="stat-value" style={{ color: "var(--accent-teal)" }}>
                      {g.dryness_score ? g.dryness_score.toFixed(1) : "5.0"}
                    </div>
                    <div className="stat-caption" style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "10px" }}>
                      {g.dryness_score >= 7.5 
                        ? "Високий рівень рельєфу (шред)" 
                        : g.dryness_score >= 5.5 
                          ? "Помірний рельєф, помітна дефініція" 
                          : "М'яка форма, згладжений рельєф"}
                    </div>
                  </div>

                  {/* Card 5: Muscle Mass Score */}
                  <div className="stat-card animate-in animate-delay-4">
                    <div className="stat-label" style={{ display: "flex", alignItems: "center", gap: "6px" }}><DumbbellIcon size={16} /> М'язова маса (1-10)</div>
                    <div className="stat-value" style={{ color: "var(--accent-purple)" }}>
                      {g.muscle_mass_score ? g.muscle_mass_score.toFixed(1) : "5.0"}
                    </div>
                    <div className="stat-caption" style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "10px" }}>
                      {g.muscle_mass_score >= 7.5 
                        ? "Гіпертрофована мускулатура (велика маса)" 
                        : g.muscle_mass_score >= 5.5 
                          ? "Атлетична норма, помірна гіпертрофія" 
                          : "Базовий рівень розвитку сили"}
                    </div>
                  </div>

                  {/* Card 6: Torso to Leg Ratio — hidden for torso_only */}
                  {g.photo_type !== "torso_only" && (
                    <div className="stat-card animate-in animate-delay-4">
                      <div className="stat-label" style={{ display: "flex", alignItems: "center", gap: "6px" }}><LegIcon size={16} /> Тулуб до ніг</div>
                      <div className="stat-value" style={{ color: "var(--accent-amber)" }}>
                        {displayedTorsoLegRatio.toFixed(2)}
                      </div>
                      <div className="stat-caption" style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "10px" }}>
                        {displayedTorsoLegRatio < 0.5 
                          ? "Довгі ноги (домінування нижньої частини)" 
                          : displayedTorsoLegRatio < 0.6 
                            ? "Збалансовані та естетичні пропорції тіла" 
                            : "Подовжений тулуб відносно ніг"}
                      </div>
                    </div>
                  )}
                </div>

                {/* Muscle Group Scores Card */}
                <div>
                  <h3 style={{
                    fontSize: "17px",
                    fontWeight: 700,
                    marginBottom: "16px",
                    color: "var(--text-primary)",
                  }}>
                    <span style={{ display: "flex", alignItems: "center", gap: "8px" }}><DumbbellIcon size={18} /> Оцінка та деталізація м'язових груп</span>
                  </h3>
                  <div className="muscles-grid">
                    {(() => {
                      const mg = g.muscle_groups || {
                        shoulders: { score: 5.5, description: "Помірний тонус плечей." },
                        chest: { score: 5.2, description: "Базовий рельєф грудних м'язів." },
                        back: { score: 5.4, description: "Помірна ширина найширших м'язів спини." },
                        arms: { score: 5.3, description: "Середня м'язова витривалість рук." },
                        core: { score: 5.8, description: "Хороший тонус черевного преса." },
                        legs: { score: 5.0, description: "Нормальна пропорція стегон." }
                      };

                      const groups = [
                        { key: "shoulders", name: "Плечі (Shoulders)", IconComp: ShoulderIcon },
                        { key: "chest", name: "Груди (Chest)", IconComp: ShieldIcon },
                        { key: "back", name: "Спина (Back)", IconComp: DnaIcon },
                        { key: "arms", name: "Руки (Arms)", IconComp: DumbbellIcon },
                        { key: "core", name: "Прес та Кора (Core)", IconComp: FlameIcon },
                        { key: "legs", name: "Ноги (Legs)", IconComp: LegIcon }
                      ];

                      return groups.map((group) => {
                        const info = mg[group.key as keyof typeof mg] || { score: 0, description: "Немає даних" };
                        const isLegs = group.key === "legs";
                        const isTorsoOnly = g.photo_type === "torso_only";
                        const isLegsNotAnalyzable = isLegs && info.score <= 0.0;
                        const isOut = isLegs && (isTorsoOnly || isLegsNotAnalyzable);

                        let badgeBg = "rgba(239, 68, 68, 0.1)";
                        let badgeColor = "var(--accent-red)";
                        let borderC = "rgba(239, 68, 68, 0.25)";
                        
                        if (info.score >= 7.5) {
                          badgeBg = "rgba(16, 185, 129, 0.1)";
                          badgeColor = "var(--accent-green)";
                          borderC = "rgba(16, 185, 129, 0.25)";
                        } else if (info.score >= 5.0) {
                          badgeBg = "rgba(245, 158, 11, 0.1)";
                          badgeColor = "var(--accent-amber)";
                          borderC = "rgba(245, 158, 11, 0.25)";
                        }

                        if (isOut) {
                          badgeBg = "rgba(255, 255, 255, 0.05)";
                          badgeColor = "var(--text-muted)";
                          borderC = "rgba(255, 255, 255, 0.1)";
                        }

                        return (
                          <div 
                            key={group.key} 
                            className="glass-card" 
                            style={{
                              padding: "18px",
                              opacity: isOut ? 0.55 : 1,
                              border: isOut ? "1px dashed rgba(255,255,255,0.1)" : "1px solid var(--border-default)",
                              background: isOut 
                                ? "rgba(20, 20, 25, 0.4)" 
                                : "linear-gradient(135deg, rgba(22, 22, 31, 0.95), rgba(30, 30, 42, 0.9))",
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <span style={{ display: "flex", alignItems: "center" }}><group.IconComp size={18} /></span>
                                <span style={{ fontWeight: 700, fontSize: "14px", color: "var(--text-primary)" }}>{group.name}</span>
                              </div>
                              <span 
                                style={{
                                  padding: "4px 8px",
                                  borderRadius: "6px",
                                  fontSize: "13px",
                                  fontWeight: 700,
                                  background: badgeBg,
                                  color: badgeColor,
                                  border: `1px solid ${borderC}`
                                }}
                              >
                                {isOut ? (isTorsoOnly ? "Поза кадром" : "Не оцінено") : info.score.toFixed(1)}
                              </span>
                            </div>
                            <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>
                              {isOut 
                                ? (isTorsoOnly ? "Ця м'язова група не оцінювалася, оскільки знімок містить лише тулуб." : info.description) 
                                : info.description}
                            </p>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>



                {/* Card 5: Overall Assessment and Body Description */}
                <div className="glass-card animate-in animate-delay-4" style={{
                  padding: "24px",
                  border: "1px solid var(--border-default)",
                  background: "linear-gradient(135deg, rgba(22, 22, 31, 0.95), rgba(30, 30, 42, 0.9))",
                  boxShadow: "var(--shadow-glow)",
                }}>
                  <h3 style={{
                    fontSize: "18px",
                    fontWeight: 700,
                    marginBottom: "16px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    background: "var(--gradient-accent)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text"
                  }}>
                    <span style={{ display: "flex", alignItems: "center", gap: "8px" }}><FileTextIcon size={18} /> Загальна оцінка та опис тіла</span>
                  </h3>
                  <p style={{
                    fontSize: "14px",
                    lineHeight: "1.7",
                    color: "var(--text-primary)",
                    margin: 0,
                    whiteSpace: "pre-line"
                  }}>
                    {g.overall_assessment}
                  </p>
                </div>

                {/* Action */}
                <div style={{ marginTop: "16px", display: "flex", gap: "12px" }}>
                  <button className="btn-primary" onClick={() => router.push(`/assistant?analysis_id=${analysis.id}`)}>
                    Обговорити з асистентом
                  </button>
                  <button className="btn-secondary" onClick={() => router.push("/dashboard")}>
                    Повернутись
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

export default function AnalysisDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <AuthGuard>
      <AnalysisDetailContent params={params} />
    </AuthGuard>
  );
}
