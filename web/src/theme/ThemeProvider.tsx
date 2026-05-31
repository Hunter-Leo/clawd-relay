import { createContext } from "preact";
import { useContext, useState, useEffect, useCallback } from "preact/hooks";

export type ThemeMode = "dark" | "light" | "system";

interface ThemeContextValue {
  mode: ThemeMode;
  resolved: "dark" | "light";
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: "system",
  resolved: "dark",
  setMode: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

function getStoredMode(): ThemeMode {
  try {
    const stored = localStorage.getItem("clawd-theme");
    if (stored === "dark" || stored === "light" || stored === "system") return stored;
  } catch { /* localStorage unavailable */ }
  return "dark";
}

function resolveTheme(mode: ThemeMode): "dark" | "light" {
  if (mode === "dark") return "dark";
  if (mode === "light") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(resolved: "dark" | "light") {
  document.documentElement.classList.toggle("dark", resolved === "dark");
  document.documentElement.classList.toggle("light", resolved === "light");
}

export function ThemeProvider({ children }: { children: preact.ComponentChildren }) {
  const [mode, rawSetMode] = useState<ThemeMode>(getStoredMode);
  const [resolved, setResolved] = useState<"dark" | "light">(() => resolveTheme(mode));

  const setMode = useCallback((m: ThemeMode) => {
    rawSetMode(m);
    try { localStorage.setItem("clawd-theme", m); } catch { /* noop */ }
  }, []);

  useEffect(() => {
    const r = resolveTheme(mode);
    setResolved(r);
    applyTheme(r);
  }, [mode]);

  useEffect(() => {
    if (mode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      const r = resolveTheme("system");
      setResolved(r);
      applyTheme(r);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [mode]);

  return (
    <ThemeContext.Provider value={{ mode, resolved, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}
