/**
 * Root layout — wraps all pages with AuthProvider and Sidebar.
 */

import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/hooks/useAuth";
import Sidebar from "@/components/layout/Sidebar";

export const metadata: Metadata = {
  title: "AI Body Analyzer — Аналіз фізичної форми",
  description:
    "Автоматичний аналіз фізичної форми за фотографією з використанням комп'ютерного зору та AI. Визначення пропорцій тіла, постави та персоналізовані рекомендації.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="uk">
      <body>
        <AuthProvider>
          <Sidebar />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
