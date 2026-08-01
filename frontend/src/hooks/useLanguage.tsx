/**
 * Language hook — manages locale state across the app.
 * Stores preference in localStorage, provides t() translation helper.
 */

"use client";

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { translations, type Locale, type TranslationKeys } from "@/locales";

interface LanguageContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: TranslationKeys;
}

const LanguageContext = createContext<LanguageContextType>({
  locale: "uk",
  setLocale: () => {},
  t: translations.uk,
});

const STORAGE_KEY = "locale";

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("uk");
  const [mounted, setMounted] = useState(false);

  // Initialize from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Locale | null;
    if (stored && (stored === "uk" || stored === "en")) {
      setLocaleState(stored);
      document.documentElement.lang = stored;
    }
    setMounted(true);
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem(STORAGE_KEY, newLocale);
    document.documentElement.lang = newLocale;
  }, []);

  const t = translations[locale];

  // Prevent hydration mismatch — render with default locale until mounted
  if (!mounted) {
    return (
      <LanguageContext.Provider value={{ locale: "uk", setLocale, t: translations.uk }}>
        {children}
      </LanguageContext.Provider>
    );
  }

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
