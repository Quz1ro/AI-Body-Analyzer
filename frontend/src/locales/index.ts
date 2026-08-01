/**
 * Locale index — types and exports for i18n.
 */

import uk from "./uk";
import en from "./en";
import type { TranslationKeys } from "./uk";

export type Locale = "uk" | "en";

export const translations: Record<Locale, TranslationKeys> = {
  uk,
  en: en as unknown as TranslationKeys,
};

export type { TranslationKeys };
