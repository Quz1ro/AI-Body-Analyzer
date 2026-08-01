/**
 * Root layout — wraps all pages with AuthProvider, LanguageProvider and Sidebar.
 */

import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/hooks/useAuth";
import { LanguageProvider } from "@/hooks/useLanguage";
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
        <LanguageProvider>
          <AuthProvider>
            <Sidebar />
            {children}
          </AuthProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
