/**
 * AI Assistant Page — Chat with the AI trainer.
 */

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { sendChatMessage, getChatHistory, listAnalyses, getAnalysis, getImageUrl, API_URL } from "@/lib/api";
import type { ChatMessage, AnalysisSummary, Analysis } from "@/types";
import { MessageCircleIcon, SearchIcon, AlertTriangleIcon } from "@/components/ui/Icons";
import AuthGuard from "@/components/layout/AuthGuard";

// Helper to format simple markdown elements: bold, headers, lists
function formatMessageContent(content: string) {
  if (!content) return null;
  const lines = content.split("\n");
  return lines.map((line, idx) => {
    let formatted = line;

    // Bold: **text**
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

    // Headings: ### title, ## title, # title
    if (formatted.startsWith("### ")) {
      return (
        <h4 key={idx} style={{ margin: "14px 0 6px 0", fontSize: "15px", fontWeight: 700, color: "#fff" }}>
          {formatted.replace("### ", "")}
        </h4>
      );
    }
    if (formatted.startsWith("## ")) {
      return (
        <h3 key={idx} style={{ margin: "18px 0 8px 0", fontSize: "16px", fontWeight: 700, color: "#fff" }}>
          {formatted.replace("## ", "")}
        </h3>
      );
    }
    if (formatted.startsWith("# ")) {
      return (
        <h2 key={idx} style={{ margin: "22px 0 10px 0", fontSize: "18px", fontWeight: 800, color: "#fff" }}>
          {formatted.replace("# ", "")}
        </h2>
      );
    }

    // List item: * text or - text
    if (formatted.startsWith("* ") || formatted.startsWith("- ")) {
      const bulletContent = formatted.substring(2);
      return (
        <li
          key={idx}
          style={{ marginLeft: "20px", listStyleType: "disc", marginBottom: "4px" }}
          dangerouslySetInnerHTML={{ __html: bulletContent }}
        />
      );
    }

    // Normal text
    return (
      <p
        key={idx}
        style={{ margin: "0 0 8px 0", minHeight: "1em" }}
        dangerouslySetInnerHTML={{ __html: formatted }}
      />
    );
  });
}

function AssistantContent() {
  const { user, loading: authLoading, isLoggedIn } = useAuth();
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [latestAnalysisId, setLatestAnalysisId] = useState<string | undefined>();
  const [selectedAnalysis, setSelectedAnalysis] = useState<any | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!isLoggedIn) return; // AuthGuard handles redirect

    listAnalyses()
      .then((analyses) => {
        const params = new URLSearchParams(window.location.search);
        const urlAnalysisId = params.get("analysis_id");
        const activeId = urlAnalysisId || (analyses.length > 0 ? analyses[0].id : undefined);

        setLatestAnalysisId(activeId);

        if (activeId) {
          return Promise.all([
            getChatHistory(activeId),
            getAnalysis(activeId),
            Promise.resolve(activeId)
          ]) as Promise<[ChatMessage[], Analysis | null, string | undefined]>;
        } else {
          return Promise.resolve<[ChatMessage[], Analysis | null, string | undefined]>([[], null, undefined]);
        }
      })
      .then(([history, analysis, activeId]) => {
        if (activeId && analysis) {
          setSelectedAnalysis(analysis);
          const ratingStr = analysis.gemini_analysis?.overall_rating 
            ? ` з загальним фітнес-рейтингом **${analysis.gemini_analysis.overall_rating.toFixed(1)}/10**` 
            : "";
          const dateStr = new Date(analysis.created_at).toLocaleDateString("uk-UA");
          const welcomeContent = `Привіт! Я твій віртуальний помічник по оцінці та покращенню твоєї фізичної форми. Я підключив твій аналіз від **${dateStr}**${ratingStr} і готовий відповісти на будь-які запитання щодо нього.`;

          setMessages(
            history.length > 0
              ? history
              : [
                  {
                    id: "welcome",
                    role: "assistant",
                    content: welcomeContent,
                    created_at: new Date().toISOString(),
                  },
                ]
          );
        } else {
          setMessages([
            {
              id: "welcome",
              role: "assistant",
              content: "Привіт! Я твій віртуальний помічник по оцінці та покращенню твоєї фізичної форми. Будь ласка, завантаж фото на головній сторінці, щоб розпочати аналіз.",
              created_at: new Date().toISOString(),
            },
          ]);
        }
      })
      .catch((err) => {
        console.error("Помилка завантаження даних чату:", err);
      });
  }, [authLoading, isLoggedIn, router]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    // Only auto-scroll if user is near the bottom (within 200px)
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 200;
    if (isNearBottom) {
      requestAnimationFrame(() => {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: "smooth",
        });
      });
    }
  }, [messages]);

  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    setShowScrollBtn(distanceFromBottom > 300);
  }, []);

  const scrollToBottom = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  }, []);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || sending) return;

    const userMessage = input.trim();
    setInput("");
    await sendMessageToServer(userMessage);
  }

  async function sendSuggestion(text: string) {
    if (sending) return;
    await sendMessageToServer(text);
  }

  async function sendMessageToServer(userMessage: string) {
    setSending(true);

    // Optimistic add user message
    const tempUserMsg: ChatMessage = {
      id: "temp-" + Date.now(),
      role: "user",
      content: userMessage,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    const tempAssistantId = "streaming-" + Date.now();
    // Add placeholder assistant message
    setMessages((prev) => [
      ...prev,
      {
        id: tempAssistantId,
        role: "assistant",
        content: "",
        created_at: new Date().toISOString(),
      },
    ]);

    try {
      const token = localStorage.getItem("access_token");
      const response = await fetch(`${API_URL}/api/assistant/chat/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: userMessage,
          analysis_id: latestAnalysisId,
        }),
      });

      if (!response.ok) {
        throw new Error("Не вдалося отримати відповідь від сервера");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("Потік відповіді недоступний");

      const decoder = new TextDecoder();
      let accumulatedReply = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        accumulatedReply += chunk;

        // Update the placeholder assistant message with accumulated content
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === tempAssistantId ? { ...msg, content: accumulatedReply } : msg
          )
        );
      }
    } catch (err: any) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === tempAssistantId
            ? { ...msg, content: `Помилка: ${err.message}` }
            : msg
        )
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="page-container" style={{ display: "flex", flexDirection: "column", height: "100vh", padding: "0" }}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] py-5 px-8 max-md:pl-16 max-md:py-4">
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ display: "flex", alignItems: "center", color: "var(--accent-teal)" }}><MessageCircleIcon size={28} /></span>
          <div>
            <h1 style={{ fontSize: "18px", fontWeight: 700, margin: 0 }}>Асистент</h1>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: 0 }}>
              Запитайте про результати аналізу, вправи чи харчування
            </p>
          </div>
        </div>
        {latestAnalysisId && (
          <div style={{
            fontSize: "12px",
            background: "rgba(168, 85, 247, 0.12)",
            color: "var(--accent-purple)",
            border: "1px solid rgba(168, 85, 247, 0.3)",
            padding: "6px 12px",
            borderRadius: "20px",
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}>
            <span style={{
              display: "inline-block",
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: "var(--accent-purple)",
              boxShadow: "0 0 8px var(--accent-purple)",
            }} />
            Аналіз підключено
          </div>
        )}
      </div>

      {/* Selected Analysis Context Widget */}
      {selectedAnalysis && (
        <div style={{
          margin: "16px 32px 0 32px",
          padding: "10px 16px",
          background: "rgba(168, 85, 247, 0.08)",
          border: "1px solid rgba(168, 85, 247, 0.2)",
          borderRadius: "12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <img 
              src={getImageUrl(selectedAnalysis.image_path || selectedAnalysis.annotated_image_path || "")} 
              alt="Analyzed" 
              style={{ width: "36px", height: "36px", borderRadius: "6px", objectFit: "cover", border: "1px solid rgba(255,255,255,0.1)" }}
            />
            <div>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "#fff" }}>Контекст аналізу підключено</div>
              <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                Аналізуємо за фото від {new Date(selectedAnalysis.created_at).toLocaleString("uk-UA")}
              </div>
            </div>
          </div>
          <button 
            className="btn-secondary" 
            style={{ fontSize: "11px", padding: "4px 10px", borderRadius: "8px" }}
            onClick={() => router.push(`/analysis/${selectedAnalysis.id}`)}
          >
            <SearchIcon size={14} /> Дивитись звіт
          </button>
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div 
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="overflow-y-auto py-6 px-8 max-md:px-4 max-md:py-4 gap-4 flex flex-col"
        style={{ flex: 1 }}
      >
        {messages.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <div style={{ marginBottom: "16px", color: "var(--text-muted)" }}><MessageCircleIcon size={48} /></div>
            <p style={{ fontSize: "16px", fontWeight: 600, marginBottom: "8px" }}>
              Ваш AI-тренер готовий
            </p>
            <p style={{ color: "var(--text-secondary)", fontSize: "14px", maxWidth: "400px", margin: "0 auto" }}>
              Запитайте про результати аналізу, рекомендації щодо вправ, або загальні поради про тренування та харчування.
            </p>
          </div>
        )}

        {messages.map((msg) => {
          // Hide the empty streaming placeholder — the skeleton loader below handles that state
          if (msg.id.startsWith("streaming-") && sending && msg.content === "") return null;
          return (
          <div
            key={msg.id}
            style={{
              display: "flex",
              justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
            }}
          >
            <div style={{
              maxWidth: "70%",
              padding: "14px 18px",
              borderRadius: msg.role === "user"
                ? "var(--radius-lg) var(--radius-lg) 4px var(--radius-lg)"
                : "var(--radius-lg) var(--radius-lg) var(--radius-lg) 4px",
              background: msg.role === "user"
                ? "var(--gradient-primary)"
                : "var(--bg-card)",
              border: msg.role === "user"
                ? "none"
                : "1px solid var(--border-subtle)",
              fontSize: "14px",
              lineHeight: 1.6,
              whiteSpace: "pre-wrap",
            }}>
              {msg.role === "assistant"
                ? formatMessageContent(msg.content)
                : msg.content}
            </div>
          </div>
          );
        })}

        {sending && messages.every(m => m.id.startsWith("streaming-") ? m.content === "" : true) && messages.some(m => m.id.startsWith("streaming-") && m.content === "") && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div style={{
              padding: "14px 18px",
              borderRadius: "var(--radius-lg) var(--radius-lg) var(--radius-lg) 4px",
              background: "var(--bg-card)",
              border: "1px solid var(--border-subtle)",
              fontSize: "14px",
              color: "var(--text-muted)",
            }}>
              <span className="skeleton" style={{ display: "inline-block", width: 60, height: 16 }} />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Scroll to bottom button */}
      {showScrollBtn && (
        <button
          onClick={scrollToBottom}
          aria-label="Прокрутити вниз"
          style={{
            position: "absolute",
            bottom: "16px",
            left: "50%",
            transform: "translateX(-50%)",
            width: "36px",
            height: "36px",
            borderRadius: "50%",
            background: "var(--bg-card)",
            border: "1px solid var(--border-subtle)",
            color: "var(--text-secondary)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
            transition: "all 0.2s ease",
            zIndex: 10,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--bg-elevated)";
            e.currentTarget.style.color = "#fff";
            e.currentTarget.style.transform = "translateX(-50%) scale(1.1)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "var(--bg-card)";
            e.currentTarget.style.color = "var(--text-secondary)";
            e.currentTarget.style.transform = "translateX(-50%) scale(1)";
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      )}
      </div>

      {/* Suggestions Row */}
      <div className="flex gap-2 overflow-x-auto whitespace-nowrap pt-2 px-8 pb-2 max-md:px-4 hide-scrollbar">
        {[
          "Поясни мій рейтинг",
          "Як покращити грудні м'язи?",
          "Чому не оцінено ноги?",
          "Які вправи мені підходять?",
          "Поради щодо харчування"
        ].map((q) => (
          <button
            key={q}
            className="btn-secondary"
            style={{
              fontSize: "12px",
              padding: "6px 14px",
              borderRadius: "16px",
              border: "1px solid var(--border-subtle)",
              background: "rgba(255, 255, 255, 0.03)",
              color: "var(--text-secondary)",
              cursor: "pointer",
              transition: "all 0.2s ease",
              flexShrink: 0,
            }}
            onClick={() => sendSuggestion(q)}
            disabled={sending}
          >
            {q}
          </button>
        ))}
      </div>

      {/* Input Area */}
      <form
        onSubmit={handleSend}
        className="flex gap-3 pt-2 px-8 pb-6 max-md:px-4 max-md:pb-4 border-t border-[var(--border-subtle)]"
      >
        <input
          type="text"
          className="input-field"
          placeholder="Напишіть повідомлення..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={sending}
          style={{ flex: 1 }}
          id="chat-input"
          autoComplete="off"
        />
        <button
          type="submit"
          className="btn-primary"
          disabled={sending || !input.trim()}
          style={{ padding: "12px 24px", flexShrink: 0 }}
        >
          {sending ? "..." : "Надіслати"}
        </button>
      </form>
    </div>
  );
}

export default function AssistantPage() {
  return (
    <AuthGuard>
      <AssistantContent />
    </AuthGuard>
  );
}
