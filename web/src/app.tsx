import { useState, useEffect, useCallback, useReducer } from "preact/hooks";
import { appReducer, initialState } from "./state/store";
import type { Settings } from "./state/store";
import type { BroadcastMsg, DNDChangeMsg, AlwaysAllowMsg } from "@clawd-relay/types";
import { getWSManager } from "./ws";
import { ThemeProvider, useTheme } from "./theme/ThemeProvider";
import { I18nProvider, useI18n } from "./i18n/index";
import { Dashboard } from "./components/Dashboard";
import { ConnectionIndicator } from "./components/ConnectionIndicator";
import { DNDToggle } from "./components/DNDToggle";
import { PermissionModal } from "./components/PermissionModal";
import { SessionHUD } from "./components/SessionHUD";
import { SettingsPanel } from "./components/SettingsPanel";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { EmptyState } from "./components/EmptyState";

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem("clawd-settings");
    if (raw) return { ...initialState.settings, ...JSON.parse(raw) };
  } catch { /* noop */ }
  return initialState.settings;
}

function saveSettings(s: Settings) {
  try { localStorage.setItem("clawd-settings", JSON.stringify(s)); } catch { /* noop */ }
}

function InnerApp() {
  const [state, dispatch] = useReducer(appReducer, {
    ...initialState,
    settings: loadSettings(),
  });
  const [showSettings, setShowSettings] = useState(false);
  const [serverUrl, setServerUrl] = useState(
    () => new URLSearchParams(window.location.search).get("relay_url") ?? "",
  );
  const { setMode } = useTheme();
  const { setLocale } = useI18n();

  // Persist settings
  useEffect(() => {
    saveSettings(state.settings);
  }, [state.settings]);

  // Sync settings -> theme/i18n
  useEffect(() => { setMode(state.settings.theme as any); }, [state.settings.theme]);
  useEffect(() => { setLocale(state.settings.language as any); }, [state.settings.language]);

  // Demo mode
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("demo")) return;
    dispatch({ type: "CONNECTION_STATUS", status: "connected" });
    const t = setTimeout(() => dispatch({
      type: "SYNC_SNAPSHOT",
      devices: [
        { id: "mac-studio", host: "Mac Studio", platform: "darwin", bridgeVersion: "0.1.0" },
        { id: "dev-laptop", host: "Dev Laptop", platform: "darwin", bridgeVersion: "0.1.0" },
        { id: "linux-box", host: "Linux Box", platform: "linux", bridgeVersion: "0.1.0" },
      ],
      sessions: {
        "mac-studio": [
          { id: "s1", agentId: "claude-code", state: "working", title: "Refactoring auth middleware", cwd: "/Users/me/project/api", model: "claude-sonnet-4-6", toolName: "Bash", toolInput: { command: "npm run build" }, updatedAt: Date.now() },
          { id: "s2", agentId: "claude-code", state: "thinking", title: "Reviewing PR #142", cwd: "/Users/me/project/api", model: "claude-sonnet-4-6", toolName: "Read", toolInput: { file: "src/auth.ts" }, updatedAt: Date.now() - 5000 },
        ],
        "dev-laptop": [
          { id: "s3", agentId: "codex", state: "idle", title: null, cwd: "/home/dev/app", model: "codex-v1", toolName: null, toolInput: null, updatedAt: Date.now() - 120000 },
        ],
        "linux-box": [
          { id: "s4", agentId: "copilot", state: "error", title: "Deploy script failed", cwd: "/opt/deploy", model: "copilot-v2", toolName: "Bash", toolInput: { command: "docker compose up -d" }, updatedAt: Date.now() - 30000 },
        ],
      },
    }), 500);
    return () => clearTimeout(t);
  }, []);

  // Connect WS
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("demo")) return;
    const ws = getWSManager();
    dispatch({ type: "CONNECTION_STATUS", status: "connecting" });

    const unsubMessage = ws.on("message", (data: unknown) => {
      const msg = data as BroadcastMsg;
      if (state.settings.dnd && msg.type !== "permission_request") return;

      switch (msg.type) {
        case "session_state":
          dispatch({ type: "SESSION_UPDATE", device: msg.device, session: msg.session });
          break;
        case "device_online":
          dispatch({ type: "DEVICE_ONLINE", device: msg.device, online: msg.online });
          break;
        case "sync_snapshot":
          dispatch({ type: "SYNC_SNAPSHOT", devices: msg.devices, sessions: msg.sessions });
          break;
        case "permission_request":
          if (!state.settings.dnd) {
            dispatch({ type: "PERMISSION_REQUEST", request: msg });
          }
          break;
      }
    });

    const unsubConnecting = ws.on("connecting", () => dispatch({ type: "CONNECTION_STATUS", status: "connecting" }));
    const unsubConnected = ws.on("connected", () => dispatch({ type: "CONNECTION_STATUS", status: "connected" }));
    const unsubDisconnected = ws.on("disconnected", () => dispatch({ type: "CONNECTION_STATUS", status: "disconnected" }));

    return () => {
      unsubMessage();
      unsubConnecting();
      unsubConnected();
      unsubDisconnected();
    };
  }, [state.settings.dnd]);

  const handleAllow = useCallback((permissionId: string) => {
    getWSManager().sendAll({ type: "permission_response", permissionId, approved: true });
    dispatch({ type: "CLEAR_PERMISSION", permissionId });
  }, []);

  const handleDeny = useCallback((permissionId: string) => {
    getWSManager().sendAll({ type: "permission_response", permissionId, approved: false });
    dispatch({ type: "CLEAR_PERMISSION", permissionId });
  }, []);

  const handleAlwaysAllow = useCallback((permissionId: string, toolName: string, deviceId: string) => {
    getWSManager().sendAll({ type: "permission_response", permissionId, approved: true });
    getWSManager().sendAll({
      type: "always_allow",
      rule: {
        deviceId,
        toolName,
        pattern: "*",
        createdAt: Date.now(),
      },
    } as AlwaysAllowMsg);
    dispatch({ type: "CLEAR_PERMISSION", permissionId });
  }, []);

  const handleElicitationSubmit = useCallback((permissionId: string, answers: Record<string, string>) => {
    getWSManager().sendAll({ type: "permission_response", permissionId, approved: true, answers });
    dispatch({ type: "CLEAR_PERMISSION", permissionId });
  }, []);

  const handleSuggestionSelect = useCallback((permissionId: string, suggestion: string) => {
    getWSManager().sendAll({ type: "permission_response", permissionId, approved: true, suggestion });
    dispatch({ type: "CLEAR_PERMISSION", permissionId });
  }, []);

  const handleDndToggle = useCallback((dnd: boolean) => {
    dispatch({ type: "DND_CHANGE", dnd });
    getWSManager().sendAll({ type: "dnd_change", dnd } as DNDChangeMsg);
  }, []);

  const handleSettingsUpdate = useCallback((partial: Partial<Settings>) => {
    dispatch({ type: "SETTINGS_UPDATE", settings: partial });
  }, []);

  const handleHUDSelect = useCallback((deviceId: string) => {
    const el = document.getElementById(`device-${deviceId}`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const handleTokenConnect = useCallback((token: string) => {
    getWSManager().connect(token);
  }, []);

  const handleRelayUrlChange = useCallback((url: string) => {
    setServerUrl(url);
    if (url) {
      getWSManager().setRelayUrl(url);
    }
  }, []);

  const currentPermission = state.permissions[0];
  const hudDevices = Array.from(state.devices.entries())
    .filter(([_, d]) => d.sessions.length > 0)
    .map(([_, d]) => ({
      id: d.info.id,
      host: d.info.host,
      agentId: d.sessions[0]?.agentId ?? "unknown",
      status: d.sessions[0]?.state ?? "idle",
      online: d.online,
    }));

  return (
    <div class="min-h-[100dvh] flex flex-col">
      {/* Top bar */}
      <header class="top-bar flex items-center justify-between px-4 py-2">
        <div class="flex items-center gap-4">
          <span class="text-mono-sm text-zinc-300 font-semibold tracking-wide">clawd relay</span>
        </div>
        <div class="flex items-center gap-3">
          <ConnectionIndicator status={state.connectionStatus} />
          <DNDToggle dnd={state.settings.dnd} onToggle={handleDndToggle} />
          <button
            onClick={() => setShowSettings(!showSettings)}
            class="text-mono-sm text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            [set]
          </button>
        </div>
      </header>

      {/* Main content */}
      <main class="flex-1 px-4 md:px-6 py-4 max-w-5xl mx-auto w-full">
        <ErrorBoundary>
          {state.devices.size === 0 ? (
            <EmptyState onConnect={handleTokenConnect} onRelayUrlChange={handleRelayUrlChange} serverUrl={serverUrl} />
          ) : (
            <Dashboard devices={state.devices} />
          )}
        </ErrorBoundary>
      </main>

      {/* Permission modal */}
      {currentPermission && !state.settings.dnd && (
        <PermissionModal
          request={currentPermission}
          onAllow={handleAllow}
          onDeny={handleDeny}
          onAlwaysAllow={handleAlwaysAllow}
          onElicitationSubmit={handleElicitationSubmit}
          onSuggestionSelect={handleSuggestionSelect}
          stackCount={state.permissions.length}
        />
      )}

      {/* HUD */}
      <SessionHUD devices={hudDevices} onSelect={handleHUDSelect} />

      {/* Settings */}
      {showSettings && (
        <SettingsPanel
          locale={state.settings.language}
          theme={state.settings.theme}
          dnd={state.settings.dnd}
          sound={state.settings.sound}
          volume={state.settings.volume}
          onLocaleChange={(l) => handleSettingsUpdate({ language: l as any })}
          onThemeChange={(t) => handleSettingsUpdate({ theme: t as any })}
          onDndChange={handleDndToggle}
          onSoundChange={(s) => handleSettingsUpdate({ sound: s })}
          onVolumeChange={(v) => handleSettingsUpdate({ volume: clamp(v, 0, 1) })}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

export function App() {
  return (
    <ThemeProvider>
      <I18nProvider>
        <InnerApp />
      </I18nProvider>
    </ThemeProvider>
  );
}
