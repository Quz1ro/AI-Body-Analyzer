/**
 * Sidebar navigation component.
 */

"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { CameraIcon, BarChartIcon, TrendingUpIcon, MessageCircleIcon, UserIcon, ActivityIcon } from "@/components/ui/Icons";

const navItems = [
  { href: "/", label: "Аналіз", icon: <CameraIcon size={18} /> },
  { href: "/dashboard", label: "Дашборд", icon: <BarChartIcon size={18} /> },
  { href: "/statistics", label: "Статистика", icon: <TrendingUpIcon size={18} /> },
  { href: "/assistant", label: "Асистент", icon: <MessageCircleIcon size={18} /> },
  { href: "/profile", label: "Профіль", icon: <UserIcon size={18} /> },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  // Don't show sidebar on auth pages
  if (pathname?.startsWith("/auth")) return null;

  return (
    <>
      {/* Mobile Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: "fixed",
          top: "16px",
          left: "16px",
          zIndex: 60,
          width: "40px",
          height: "40px",
          borderRadius: "10px",
          background: "rgba(22, 22, 31, 0.8)",
          backdropFilter: "blur(10px)",
          border: "1px solid var(--border-default)",
          color: "var(--text-primary)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          boxShadow: "var(--shadow-md)",
          fontSize: "20px",
          transition: "all 0.2s ease",
        }}
        className="mobile-only-flex"
      >
        {isOpen ? "✕" : "☰"}
      </button>

      {/* Backdrop for mobile sidebar */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.6)",
            backdropFilter: "blur(4px)",
            zIndex: 40,
          }}
          className="mobile-only-block"
        />
      )}

      <aside className={`sidebar ${isOpen ? "open" : ""}`} style={{ zIndex: 50 }}>
        {/* Logo */}
        <div style={{ padding: "24px 20px 20px", borderBottom: "1px solid var(--border-subtle)" }}>
          <Link href="/" onClick={() => setIsOpen(false)} style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ color: "var(--accent-teal)" }}><ActivityIcon size={24} /></span>
            <div>
              <div style={{ fontWeight: 700, fontSize: "15px", color: "var(--text-primary)" }}>
                AI Body Analyzer
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 500 }}>
                Аналіз фізичної форми
              </div>
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: "12px 0" }}>
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setIsOpen(false)}
              className={`sidebar-link ${pathname === item.href ? "active" : ""}`}
            >
              <span style={{ display: "flex", alignItems: "center" }}>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* User section */}
        {user && (
          <div style={{
            padding: "16px 16px",
            borderTop: "1px solid var(--border-subtle)",
          }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginBottom: "12px",
            }}>
              <div style={{
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                background: "var(--gradient-primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "14px",
                fontWeight: 700,
              }}>
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>
                  {user.name}
                </div>
                <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                  {user.email}
                </div>
              </div>
            </div>
            <button
              onClick={() => {
                logout();
                setIsOpen(false);
              }}
              className="btn-secondary"
              style={{ width: "100%", fontSize: "12px", padding: "8px" }}
            >
              Вийти
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
