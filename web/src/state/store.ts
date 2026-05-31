import { createContext } from "preact";
import { useContext } from "preact/hooks";
import type {
  DeviceInfo,
  SessionInfo,
  PermissionRequestMsg,
  DNDChangeMsg,
} from "@clawd-relay/types";

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

export interface DeviceState {
  info: DeviceInfo;
  sessions: SessionInfo[];
  online: boolean;
  lastSeen: number;
}

export interface Settings {
  dnd: boolean;
  sound: boolean;
  volume: number;
  language: "zh-CN" | "en";
  theme: "dark" | "light" | "system";
  agentEnabled: Record<string, boolean>;
  agentBubbles: Record<string, boolean>;
}

export type AppAction =
  | { type: "SESSION_UPDATE"; device: DeviceInfo; session: SessionInfo }
  | { type: "DEVICE_ONLINE"; device: DeviceInfo; online: boolean }
  | { type: "SYNC_SNAPSHOT"; devices: DeviceInfo[]; sessions: Record<string, SessionInfo[]> }
  | { type: "PERMISSION_REQUEST"; request: PermissionRequestMsg }
  | { type: "PERMISSION_RESPONDED"; permissionId: string }
  | { type: "CLEAR_PERMISSION"; permissionId: string }
  | { type: "CONNECTION_STATUS"; status: ConnectionStatus }
  | { type: "SETTINGS_UPDATE"; settings: Partial<Settings> }
  | { type: "DND_CHANGE"; dnd: boolean };

export interface AppState {
  devices: Map<string, DeviceState>;
  permissions: PermissionRequestMsg[];
  settings: Settings;
  connectionStatus: ConnectionStatus;
  error: string | null;
}

const DEFAULT_SETTINGS: Settings = {
  dnd: false,
  sound: true,
  volume: 0.5,
  language: "en",
  theme: "dark",
  agentEnabled: {},
  agentBubbles: {},
};

export const initialState: AppState = {
  devices: new Map(),
  permissions: [],
  settings: DEFAULT_SETTINGS,
  connectionStatus: "disconnected",
  error: null,
};

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "SESSION_UPDATE": {
      const id = action.device.id;
      const existing = state.devices.get(id);
      const updated = new Map(state.devices);
      const sessions = existing
        ? updateSession(existing.sessions, action.session)
        : [action.session];
      updated.set(id, {
        info: action.device,
        sessions,
        online: true,
        lastSeen: Date.now(),
      });
      return { ...state, devices: updated };
    }

    case "DEVICE_ONLINE": {
      const id = action.device.id;
      const updated = new Map(state.devices);
      const existing = state.devices.get(id);
      if (existing) {
        updated.set(id, {
          ...existing,
          online: action.online,
          lastSeen: action.online ? Date.now() : existing.lastSeen,
        });
      } else {
        updated.set(id, {
          info: action.device,
          sessions: [],
          online: action.online,
          lastSeen: Date.now(),
        });
      }
      return { ...state, devices: updated };
    }

    case "SYNC_SNAPSHOT": {
      const devices = new Map<string, DeviceState>();
      for (const d of action.devices) {
        devices.set(d.id, {
          info: d,
          sessions: action.sessions[d.id] ?? [],
          online: true,
          lastSeen: Date.now(),
        });
      }
      return { ...state, devices };
    }

    case "PERMISSION_REQUEST": {
      if (state.permissions.some((p) => p.permissionId === action.request.permissionId)) {
        return state; // dedup
      }
      return {
        ...state,
        permissions: [...state.permissions, action.request],
      };
    }

    case "PERMISSION_RESPONDED":
    case "CLEAR_PERMISSION": {
      return {
        ...state,
        permissions: state.permissions.filter(
          (p) => p.permissionId !== action.permissionId,
        ),
      };
    }

    case "CONNECTION_STATUS":
      return { ...state, connectionStatus: action.status };

    case "SETTINGS_UPDATE":
      return {
        ...state,
        settings: { ...state.settings, ...action.settings },
      };

    case "DND_CHANGE":
      return {
        ...state,
        settings: { ...state.settings, dnd: action.dnd },
      };

    default:
      return state;
  }
}

function updateSession(sessions: SessionInfo[], incoming: SessionInfo): SessionInfo[] {
  const idx = sessions.findIndex((s) => s.id === incoming.id);
  if (idx >= 0) {
    const updated = [...sessions];
    updated[idx] = incoming;
    return updated;
  }
  return [...sessions, incoming];
}

interface StoreContextValue {
  state: AppState;
  dispatch: (action: AppAction) => void;
}

export const StoreContext = createContext<StoreContextValue>({
  state: initialState,
  dispatch: () => {},
});

export function useAppState() {
  return useContext(StoreContext).state;
}

export function useAppDispatch() {
  return useContext(StoreContext).dispatch;
}
