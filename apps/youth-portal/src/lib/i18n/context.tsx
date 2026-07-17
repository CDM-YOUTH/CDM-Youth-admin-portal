import * as React from "react";
import { en, sw, type TranslationKey } from "./dictionaries";

type Lang = "en" | "sw";
const STORAGE_KEY = "cdm-youth-lang";

const dictionaries: Record<Lang, Partial<Record<TranslationKey, string>>> = { en, sw };

type LanguageContextValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
};

const LanguageContext = React.createContext<LanguageContextValue | null>(null);

function interpolate(template: string, vars?: Record<string, string | number>) {
  if (!vars) return template;
  return Object.entries(vars).reduce(
    (acc, [k, v]) => acc.replaceAll(`{${k}}`, String(v)),
    template,
  );
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = React.useState<Lang>(() => {
    if (typeof window === "undefined") return "en";
    return (window.localStorage.getItem(STORAGE_KEY) as Lang) || "en";
  });

  const setLang = React.useCallback((next: Lang) => {
    setLangState(next);
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const t = React.useCallback<LanguageContextValue["t"]>(
    (key, vars) => {
      const value = dictionaries[lang][key] ?? en[key] ?? key;
      return interpolate(value, vars);
    },
    [lang],
  );

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>{children}</LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = React.useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within a LanguageProvider");
  return ctx;
}
