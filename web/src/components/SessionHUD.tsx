import { useI18n } from "../i18n/index";
import { AGENT_META } from "@clawd-relay/types";

interface HUDDevice {
  id: string;
  host: string;
  agentId: string;
  status: string;
  online: boolean;
}

interface Props {
  devices: HUDDevice[];
  onSelect: (deviceId: string) => void;
}

const HUD_ABBREV: Record<string, string> = {
  working: "hud.working",
  thinking: "hud.thinking",
  idle: "hud.idle",
  error: "hud.error",
};

const STATUS_COLORS: Record<string, string> = {
  working: "bg-green-500",
  thinking: "bg-yellow-500 animate-pulse",
  idle: "bg-zinc-500",
  error: "bg-red-500",
};

export function SessionHUD({ devices, onSelect }: Props) {
  const { t } = useI18n();

  if (devices.length === 0) return null;

  return (
    <div class="fixed bottom-0 left-0 right-0 md:right-4 md:left-auto md:bottom-4 md:w-auto bg-zinc-900/90 md:rounded-lg border-t md:border border-zinc-800 backdrop-blur-sm overflow-x-auto">
      <div class="flex md:flex-col gap-0 md:gap-0.5 p-1.5 md:p-2 min-w-0">
        {devices.map((d) => {
          const agentIcon = AGENT_META[d.agentId]?.icon ?? "?";
          const abbrev = HUD_ABBREV[d.status] ?? "hud.offline";
          const dotColor = d.online ? (STATUS_COLORS[d.status] ?? "bg-zinc-500") : "bg-zinc-600";

          return (
            <button
              key={d.id}
              onClick={() => onSelect(d.id)}
              class="flex items-center gap-1.5 px-2 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors whitespace-nowrap flex-shrink-0"
              title={`${d.host} — ${d.status}`}
            >
              <span class={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor}`} />
              <span class="flex-shrink-0">{agentIcon}</span>
              <span class="hidden md:inline truncate max-w-[80px]">{d.host}</span>
              <span class="text-zinc-600">{t(abbrev)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
