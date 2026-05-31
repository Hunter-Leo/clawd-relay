import { createContext } from "preact";
import { useContext, useState, useCallback } from "preact/hooks";
import zhCN from "./zh-CN";
import en from "./en";

type Locale = "zh-CN" | "en";

const locales: Record<Locale, Record<string, string>> = { "zh-CN": zhCN, en };

function detectLocale(): Locale {
  try {
    const lang = navigator.language;
    if (lang.startsWith("zh")) return "zh-CN";
  } catch { /* noop */ }
  return "en";
}

interface I18nContextValue {
  locale: Locale;
  t: (key: string, params?: Record<string, string | number>) => string;
  setLocale: (locale: Locale) => void;
}

const I18nContext = createContext<I18nContextValue>({
  locale: "en",
  t: (k: string) => k,
  setLocale: () => {},
});

export function useI18n() {
  return useContext(I18nContext);
}

export function createI18nValue(initialLocale?: Locale): I18nContextValue {
  const [locale, setLocaleState] = useState<Locale>(initialLocale ?? detectLocale());

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      const translations = locales[locale];
      let msg = translations[key];
      if (msg === undefined) {
        console.warn(`[i18n] missing key: ${key} in ${locale}`);
        return key;
      }
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          msg = msg.replace(`{${k}}`, String(v));
        }
      }
      return msg;
    },
    [locale],
  );

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    document.documentElement.lang = l === "zh-CN" ? "zh" : "en";
  }, []);

  return { locale, t, setLocale };
}
