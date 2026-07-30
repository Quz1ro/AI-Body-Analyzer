/**
 * Home Page — Upload photo and trigger analysis.
 */

"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { uploadImage, createAnalysis, getImageUrl, getScanLimit } from "@/lib/api";
import type { Analysis, ScanLimit } from "@/types";
import { UploadIcon, ScanIcon, RulerIcon, ScaleIcon, CompassIcon, DumbbellIcon, AlertTriangleIcon, ZapIcon, CheckIcon, XCircleIcon } from "@/components/ui/Icons";
import TicTacToe from "@/components/ui/TicTacToe";

export default function HomePage() {
  const { user, loading, isLoggedIn, emailVerified } = useAuth();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [dragOver, setDragOver] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [height, setHeight] = useState<string>("");
  const [weight, setWeight] = useState<string>("");
  const [scanLimit, setScanLimit] = useState<ScanLimit | null>(null);

  // Fetch scan limit on load
  useEffect(() => {
    if (isLoggedIn && emailVerified) {
      getScanLimit()
        .then(setScanLimit)
        .catch(() => {});
    }
  }, [isLoggedIn, emailVerified]);

  // Redirect logged-in but unverified users to verify-pending
  useEffect(() => {
    if (!loading && isLoggedIn && !emailVerified) {
      router.push("/auth/verify-pending");
    }
  }, [loading, isLoggedIn, emailVerified, router]);

  const handleFile = useCallback(
    async (file: File) => {
      if (!isLoggedIn) {
        router.push("/auth/login");
        return;
      }

      // Check scan limit before uploading
      if (scanLimit && scanLimit.remaining <= 0) {
        setStatus("Денний ліміт сканувань вичерпано. Спробуйте завтра.");
        return;
      }

      if (!["image/jpeg", "image/png"].includes(file.type)) {
        setStatus("Підтримуються лише JPG та PNG файли.");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setStatus("Файл більший за 10 МБ.");
        return;
      }

      setPreview(URL.createObjectURL(file));
      setProcessing(true);
      setAnalysis(null);
      setProgress(5);
      setProgressMessage("Завантаження фото на сервер...");
      setStatus("");

      // Smooth progress bar increments with >10s warning
      const startTime = Date.now();
      const progressInterval = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        setProgress((prev) => {
          let nextVal = prev;
          if (prev < 95) {
            const diff = prev < 40 ? 6 : prev < 70 ? 4 : prev < 88 ? 2 : 1;
            nextVal = Math.min(95, prev + diff);
          }
          
          if (elapsed > 10) {
            setProgressMessage("Це займає трошки більше часу, будь ласка, зачекайте...");
          } else {
            if (nextVal < 30) {
              setProgressMessage("Сканування контурів та силуету...");
            } else if (nextVal < 55) {
              setProgressMessage("MediaPipe: Визначення скелетних орієнтирів...");
            } else if (nextVal < 75) {
              setProgressMessage("Gemini: Візуальне коригування таза та кінцівок...");
            } else if (nextVal < 88) {
              setProgressMessage("Пошук найвужчої точки талії та плечових вершин...");
            } else {
              setProgressMessage("Формування загальної оцінки та рекомендацій...");
            }
          }
          return nextVal;
        });
      }, 250);

      try {
        const image = await uploadImage(file);
        const result = await createAnalysis(
          image.id,
          height ? parseFloat(height) : undefined,
          weight ? parseFloat(weight) : undefined
        );
        
        clearInterval(progressInterval);
        setProgress(100);
        setProgressMessage("Готово! Перенаправлення до результатів...");
        
        // Update scan limit after successful analysis
        getScanLimit().then(setScanLimit).catch(() => {});
        
        // Slight delay for smooth visual transition
        setTimeout(() => {
          router.push(`/analysis/${result.id}`);
        }, 500);
      } catch (err: any) {
        clearInterval(progressInterval);
        setProgress(0);
        setProgressMessage("");
        setProcessing(false);
        
        // Handle 429 specifically for better UX
        if (err.status === 429) {
          getScanLimit().then(setScanLimit).catch(() => {});
        }
        setStatus(`Помилка: ${err.message}`);
      }
    },
    [isLoggedIn, router, height, weight, scanLimit]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
    },
    [handleFile]
  );

  if (loading) {
    return (
      <div className="page-container" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <div className="skeleton" style={{ width: 200, height: 24 }} />
      </div>
    );
  }

  return (
    <div className="page-container">

      {/* Hero Section */}
      <section className="animate-in" style={{ marginBottom: "40px" }}>

        <h1 style={{
          fontSize: "clamp(32px, 5vw, 48px)",
          fontWeight: 800,
          letterSpacing: "-0.03em",
          lineHeight: 1.1,
          marginBottom: "16px",
        }}>
          Аналіз <span className="gradient-text">фізичної форми</span>
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "16px", maxWidth: "560px", lineHeight: 1.6 }}>
          Завантажте фото в повний зріст — система визначить ключові точки тіла,
          обчислить пропорції, симетрію та поставу.
        </p>

        {/* Scan Limit Indicator */}
        {isLoggedIn && scanLimit && (
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "10px",
            marginTop: "16px",
            padding: "10px 18px",
            borderRadius: "var(--radius-lg)",
            background: scanLimit.remaining > 0
              ? "rgba(45, 212, 191, 0.08)"
              : "rgba(239, 68, 68, 0.08)",
            border: `1px solid ${scanLimit.remaining > 0 ? "rgba(45, 212, 191, 0.2)" : "rgba(239, 68, 68, 0.2)"}`,
          }}>
            <div style={{
              display: "flex",
              gap: "4px",
            }}>
              {Array.from({ length: scanLimit.limit }, (_, i) => (
                <div
                  key={i}
                  style={{
                    width: "10px",
                    height: "10px",
                    borderRadius: "50%",
                    background: i < scanLimit.used
                      ? "var(--text-muted)"
                      : "var(--accent-teal)",
                    opacity: i < scanLimit.used ? 0.3 : 1,
                    boxShadow: i < scanLimit.used ? "none" : "0 0 6px rgba(45, 212, 191, 0.4)",
                    transition: "all 0.3s ease",
                  }}
                />
              ))}
            </div>
            <span style={{
              fontSize: "13px",
              fontWeight: 600,
              color: scanLimit.remaining > 0 ? "var(--accent-teal)" : "var(--accent-red)",
            }}>
              {scanLimit.remaining > 0
                ? `${scanLimit.remaining} з ${scanLimit.limit} сканувань залишилось сьогодні`
                : "Ліміт вичерпано — спробуйте завтра"}
            </span>
          </div>
        )}
      </section>

      {/* Optional Height/Weight Inputs */}
      {isLoggedIn && !processing && (
        <div style={{
          display: "flex",
          gap: "16px",
          justifyContent: "center",
          marginBottom: "20px",
          maxWidth: "400px",
          margin: "0 auto 24px auto"
        }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 700, color: "var(--text-secondary)", marginBottom: "6px" }}>
              <RulerIcon size={14} /> Зріст (см, опціонально)
            </label>
            <input
              type="number"
              min="1"
              className="input-field"
              placeholder="напр. 180"
              value={height}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "" || (parseFloat(val) > 0 && !val.includes("-"))) {
                  setHeight(val);
                }
              }}
              style={{ padding: "10px", width: "100%", background: "rgba(255,255,255,0.03)", borderColor: "var(--border-subtle)" }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 700, color: "var(--text-secondary)", marginBottom: "6px" }}>
              <ScaleIcon size={14} /> Вага (кг, опціонально)
            </label>
            <input
              type="number"
              min="1"
              className="input-field"
              placeholder="напр. 75"
              value={weight}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "" || (parseFloat(val) > 0 && !val.includes("-"))) {
                  setWeight(val);
                }
              }}
              style={{ padding: "10px", width: "100%", background: "rgba(255,255,255,0.03)", borderColor: "var(--border-subtle)" }}
            />
          </div>
        </div>
      )}

      {/* Upload Area */}
      <section className="animate-in animate-delay-1">
        {processing ? (
          <div className="glass-card animate-in" style={{
            padding: "48px 40px",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "220px",
            border: "1px solid var(--border-default)",
            background: "linear-gradient(135deg, rgba(22, 22, 31, 0.95), rgba(30, 30, 42, 0.9))",
            boxShadow: "var(--shadow-glow)",
          }}>
             <div style={{ display: "flex", justifyContent: "center", marginBottom: "16px", color: "var(--accent-teal)", animation: "pulse 1.5s infinite" }}><ScanIcon size={40} /></div>
            <h3 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "8px", color: "var(--text-primary)" }}>
              Виконується аналіз
            </h3>
            
            <p style={{ fontSize: "14px", color: "var(--accent-teal)", fontWeight: 600, marginBottom: "20px" }}>
              {progressMessage} ({progress}%)
            </p>

            <div style={{
              width: "100%",
              maxWidth: "320px",
              height: "6px",
              background: "rgba(255, 255, 255, 0.08)",
              borderRadius: "3px",
              overflow: "hidden",
              position: "relative",
              boxShadow: "inset 0 1px 2px rgba(0,0,0,0.4)"
            }}>
              <div style={{
                width: `${progress}%`,
                height: "100%",
                background: "var(--gradient-primary)",
                borderRadius: "3px",
                transition: "width 0.3s cubic-bezier(0.1, 0.8, 0.25, 1)",
                boxShadow: "0 0 8px var(--color-primary)"
              }} />
            </div>
            
            <TicTacToe />
          </div>
        ) : (
          <div
            className={`dropzone ${dragOver ? "dragover" : ""} ${isLoggedIn && scanLimit && scanLimit.remaining <= 0 ? "dropzone-disabled" : ""}`}
            onClick={() => {
              if (processing) return;
              if (scanLimit && scanLimit.remaining <= 0) {
                setStatus("Денний ліміт сканувань вичерпано. Спробуйте завтра.");
                return;
              }
              fileInputRef.current?.click();
            }}
            onDragOver={(e) => { e.preventDefault(); if (!(scanLimit && scanLimit.remaining <= 0)) setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              if (scanLimit && scanLimit.remaining <= 0) {
                e.preventDefault();
                setStatus("Денний ліміт сканувань вичерпано. Спробуйте завтра.");
                return;
              }
              handleDrop(e);
            }}
            style={{
              opacity: processing || (isLoggedIn && scanLimit && scanLimit.remaining <= 0) ? 0.5 : 1,
              pointerEvents: processing ? "none" : "auto",
              cursor: isLoggedIn && scanLimit && scanLimit.remaining <= 0 ? "not-allowed" : "pointer",
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg, image/png"
              hidden
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
             <div style={{ display: "flex", justifyContent: "center", marginBottom: "12px", color: "var(--text-muted)" }}><UploadIcon size={48} /></div>
            <p style={{ fontSize: "16px", fontWeight: 600, marginBottom: "4px" }}>
              {isLoggedIn ? "Перетягніть фото сюди" : "Увійдіть для аналізу"}
            </p>
            <p style={{ fontSize: "14px", color: "var(--text-muted)" }}>
              {isLoggedIn ? "або натисніть, щоб вибрати • JPG, PNG до 10 МБ" : "Створіть акаунт або увійдіть"}
            </p>
            {!isLoggedIn && (
              <div style={{ marginTop: "16px", display: "flex", gap: "12px", justifyContent: "center" }}>
                <button className="btn-primary" onClick={(e) => { e.stopPropagation(); router.push("/auth/register"); }}>
                  Реєстрація
                </button>
                <button className="btn-secondary" onClick={(e) => { e.stopPropagation(); router.push("/auth/login"); }}>
                  Увійти
                </button>
              </div>
            )}
          </div>
        )}

        {status && !processing && (
          <p style={{ textAlign: "center", marginTop: "16px", fontSize: "14px", color: "var(--text-secondary)" }}>
            {status}
          </p>
        )}
      </section>

      {/* Analysis Results */}
      {analysis && (
        <section className="animate-in" style={{ marginTop: "40px" }}>
          <div 
            className={preview ? "grid grid-cols-1 lg:grid-cols-2 gap-7" : "grid grid-cols-1"}
            style={{ alignItems: "start" }}
          >
            {/* Annotated image */}
            {analysis.annotated_image_path && (
              <div className="glass-card" style={{ padding: "12px", overflow: "hidden" }}>
                <img
                  src={getImageUrl(analysis.annotated_image_path)}
                  alt="Annotated body analysis"
                  style={{ width: "100%", borderRadius: "var(--radius-md)", display: "block" }}
                />
              </div>
            )}

            {/* Metrics */}
            <div>
              <h3 style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "18px", fontWeight: 700, marginBottom: "16px" }}>
                <CompassIcon size={20} /> Метрики
              </h3>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "24px" }}>
                <div className="stat-card">
                  <div className="stat-label">Плечі / Талія</div>
                  <div className="stat-value gradient-text">
                    {analysis.proportions.shoulder_to_hip_ratio?.toFixed(2)}
                  </div>
                  <div className="stat-caption">V-подібний силует при більшому значенні</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Симетрія рук</div>
                  <div className="stat-value" style={{ color: analysis.proportions.arm_symmetry >= 95 ? "var(--accent-green)" : "var(--accent-amber)" }}>
                    {analysis.proportions.arm_symmetry?.toFixed(1)}%
                  </div>
                  <div className="stat-caption">100% = ідеальна симетрія</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Симетрія ніг</div>
                  {analysis.gemini_analysis?.photo_type === "torso_only" || (analysis.proportions.leg_symmetry ?? 0) <= 0 ? (
                    <>
                      <div className="stat-value" style={{ color: "var(--text-muted)", fontSize: "20px" }}>N/A</div>
                      <div className="stat-caption">Ноги не видно в кадрі</div>
                    </>
                  ) : (
                    <>
                      <div className="stat-value" style={{ color: analysis.proportions.leg_symmetry >= 95 ? "var(--accent-green)" : "var(--accent-amber)" }}>
                        {analysis.proportions.leg_symmetry?.toFixed(1)}%
                      </div>
                      <div className="stat-caption">100% = ідеальна симетрія</div>
                    </>
                  )}
                </div>
                <div className="stat-card">
                  <div className="stat-label">Нахил плечей</div>
                  <div className="stat-value" style={{ color: analysis.posture.shoulder_tilt <= 6 ? "var(--accent-green)" : "var(--accent-red)" }}>
                    {analysis.posture.shoulder_tilt?.toFixed(1)}%
                  </div>
                  <div className="stat-caption">Менше = рівніше</div>
                </div>
              </div>

              {/* Weak Zones */}
              {analysis.weak_zones.length > 0 && (
                <>
                  <h3 style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "18px", fontWeight: 700, marginBottom: "12px" }}>
                    <DumbbellIcon size={20} /> Спостереження
                  </h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {analysis.weak_zones.map((zone, i) => (
                      <div
                        key={i}
                        className="glass-card"
                        style={{
                          padding: "14px 18px",
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "12px",
                        }}
                      >
                        <span className={`badge badge-${zone.severity}`} style={{ display: "inline-flex", alignItems: "center" }}>
                          {zone.severity === "high" ? <AlertTriangleIcon size={14} /> : zone.severity === "moderate" ? <ZapIcon size={14} /> : <CheckIcon size={14} />}
                        </span>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: "14px", marginBottom: "4px" }}>
                            {zone.label}
                          </div>
                          <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                            {zone.description}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Actions */}
              <div style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
                <button
                  className="btn-primary"
                  onClick={() => router.push(`/analysis/${analysis.id}`)}
                >
                  Детальний звіт →
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => router.push("/assistant")}
                >
                  Запитати асистента
                </button>
              </div>
            </div>
          </div>

          {/* Disclaimer */}
          <div
            className="glass-card"
            style={{
              marginTop: "24px",
              padding: "16px 20px",
              display: "flex",
              gap: "12px",
              borderColor: "rgba(245, 158, 11, 0.2)",
            }}
          >
            <span style={{ color: "var(--accent-amber)", display: "flex", alignItems: "center" }}><AlertTriangleIcon size={20} /></span>
            <div>
              <div style={{ fontWeight: 600, fontSize: "14px", marginBottom: "4px", color: "var(--accent-amber)" }}>
                Дисклеймер
              </div>
              <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                Це орієнтовна оцінка за 2D-фото, а не медичний висновок. Точність залежить від ракурсу, освітлення та одягу.
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
